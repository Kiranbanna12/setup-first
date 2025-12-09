import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Razorpay config
    const { data: config } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'razorpay_config')
      .single();

    if (!config || !(config.value as any).key_id || !(config.value as any).key_secret) {
      throw new Error('Razorpay credentials not configured');
    }

    const razorpayKeyId = (config.value as any).key_id;
    const razorpayKeySecret = (config.value as any).key_secret;

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { planId, isTrial, startAt } = await req.json();

    // Get the plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error('Plan not found');
    }

    // Check if Razorpay plan exists
    if (!plan.razorpay_plan_id) {
      throw new Error('Razorpay plan not configured for this subscription plan');
    }

    // Get user profile to check trial eligibility
    const { data: profile } = await supabase
      .from('profiles')
      .select('trial_used, razorpay_customer_id, email, full_name')
      .eq('id', user.id)
      .single();

    const canUseTrial = isTrial && !profile?.trial_used;
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Create or get Razorpay customer
    let customerId = profile?.razorpay_customer_id;

    if (!customerId) {
      const customerResponse = await fetch('https://api.razorpay.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: profile?.full_name || user.email?.split('@')[0] || 'Customer',
          email: profile?.email || user.email,
          contact: '',
          fail_existing: '0'
        })
      });

      if (!customerResponse.ok) {
        const error = await customerResponse.json();
        console.error('Customer creation error:', error);
        throw new Error(`Failed to create Razorpay customer: ${JSON.stringify(error)}`);
      }

      const customer = await customerResponse.json();
      customerId = customer.id;

      // Save customer ID to profile
      await supabase
        .from('profiles')
        .update({ razorpay_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create Razorpay subscription
    const subscriptionData: any = {
      plan_id: plan.razorpay_plan_id,
      customer_id: customerId,
      total_count: 12, // 12 billing cycles
      quantity: 1,
      customer_notify: 1,
      notes: {
        user_id: user.id,
        plan_id: planId,
        is_trial: canUseTrial ? 'true' : 'false'
      }
    };

    // If startAt is provided, use it (for resuming/scheduling)
    if (startAt) {
      // Razorpay expects start_at as unix timestamp in seconds
      const startTime = new Date(startAt).getTime() / 1000;
      // Ensure start time is at least 15 minutes in future as per Razorpay docs (safe buffer)
      // If it's too close or significantly past, Razorpay might error or start immediately.
      // For safe logic: if startAt is in future > 15 mins, set it. Else start immediately (default).
      if (startTime > (Date.now() / 1000) + 900) {
        subscriptionData.start_at = Math.floor(startTime);
      }
    } else if (canUseTrial) {
      // If trial, add offer for ₹1 first month
      // Create a one-time addon for trial
      subscriptionData.start_at = Math.floor(Date.now() / 1000) + 60; // Start after 1 minute
      subscriptionData.offer_id = null; // Will handle trial differently
    }

    const subscriptionResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriptionData)
    });

    if (!subscriptionResponse.ok) {
      const error = await subscriptionResponse.json();
      console.error('Subscription creation error:', error);
      throw new Error(`Failed to create Razorpay subscription: ${JSON.stringify(error)}`);
    }

    const subscription = await subscriptionResponse.json();

    // Calculate end date based on billing period
    const endDate = new Date();
    if (plan.billing_period === 'annual') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Create subscription record in database
    const { data: dbSubscription, error: dbError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: user.id,
        plan_id: planId,
        razorpay_subscription_id: subscription.id,
        razorpay_customer_id: customerId,
        status: 'created',
        is_trial: canUseTrial,
        trial_amount: canUseTrial ? 1 : plan.price_inr,
        start_date: new Date().toISOString(),
        end_date: endDate.toISOString()
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB subscription creation error:', dbError);
    }

    console.log('Razorpay subscription created:', subscription.id);

    return new Response(
      JSON.stringify({
        subscription_id: subscription.id,
        short_url: subscription.short_url,
        status: subscription.status,
        db_subscription_id: dbSubscription?.id,
        is_trial: canUseTrial,
        amount: canUseTrial ? 1 : plan.price_inr
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error creating Razorpay subscription:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
