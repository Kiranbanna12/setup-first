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

    const { planId, name, description, amount, period, interval } = await req.json();

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Create Razorpay plan
    const planData = {
      period: period || 'monthly',
      interval: interval || 1,
      item: {
        name: name,
        description: description || `${name} subscription plan`,
        amount: Math.round(amount * 100), // Convert to paise
        currency: 'INR'
      },
      notes: {
        plan_id: planId
      }
    };

    console.log('Creating Razorpay plan with data:', planData);

    const planResponse = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(planData)
    });

    if (!planResponse.ok) {
      const error = await planResponse.json();
      console.error('Razorpay plan creation error:', error);
      throw new Error(`Failed to create Razorpay plan: ${JSON.stringify(error)}`);
    }

    const razorpayPlan = await planResponse.json();

    // Update the subscription_plans table with Razorpay plan ID
    const { error: updateError } = await supabase
      .from('subscription_plans')
      .update({ razorpay_plan_id: razorpayPlan.id })
      .eq('id', planId);

    if (updateError) {
      console.error('Error updating plan with Razorpay ID:', updateError);
      throw new Error('Failed to save Razorpay plan ID');
    }

    console.log('Razorpay plan created and saved:', razorpayPlan.id);

    return new Response(
      JSON.stringify({
        success: true,
        razorpay_plan_id: razorpayPlan.id,
        plan: razorpayPlan
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error creating Razorpay plan:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
