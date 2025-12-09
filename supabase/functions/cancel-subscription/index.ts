import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
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

    const { subscriptionId, cancelAtEnd } = await req.json();

    // Get the subscription from database
    const { data: dbSub, error: dbError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (dbError || !dbSub) {
      throw new Error('Subscription not found');
    }

    // Determine effective cancellation mode
    // Only allow cancelAtEnd if the subscription is actually active
    const effectiveCancelAtEnd = cancelAtEnd && dbSub.status === 'active';

    if (!dbSub.razorpay_subscription_id) {
      // No Razorpay subscription, just update locally
      await supabase
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);

      await supabase
        .from('profiles')
        .update({
          subscription_active: false,
          subscription_tier: 'basic',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      return new Response(
        JSON.stringify({ success: true, message: 'Subscription cancelled immediately' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Cancel Razorpay subscription
    let cancelledSub: any = null;

    try {
      const cancelResponse = await fetch(
        `https://api.razorpay.com/v1/subscriptions/${dbSub.razorpay_subscription_id}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cancel_at_cycle_end: effectiveCancelAtEnd ? 1 : 0
          })
        }
      );

      if (!cancelResponse.ok) {
        const error = await cancelResponse.json();
        console.error('Razorpay cancel error:', error);

        // Force local cancel if 'created' status or if already cancelled/bad request/not found
        if (dbSub.status === 'created' || cancelResponse.status === 400 || cancelResponse.status === 404 || dbSub.status !== 'active') {
          console.log('Proceeding with local cancellation despite Razorpay error (400/404/NotActive)');
          cancelledSub = { id: dbSub.razorpay_subscription_id, status: 'cancelled' };
        } else {
          throw new Error(`Failed to cancel subscription: ${JSON.stringify(error)}`);
        }
      } else {
        cancelledSub = await cancelResponse.json();
      }
    } catch (e) {
      console.error("Exception during Razorpay cancellation:", e);
      // Fallback for non-active subscriptions to ensure they don't get stuck
      if (dbSub.status !== 'active') {
        console.log('Proceeding with local cancellation for non-active subscription');
        cancelledSub = { id: dbSub.razorpay_subscription_id, status: 'cancelled' };
      } else {
        throw e;
      }
    }

    // Update database
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({
        status: effectiveCancelAtEnd ? 'cancelling' : 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId);

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error(`Failed to update subscription status: ${updateError.message}`);
    }

    if (!effectiveCancelAtEnd) {
      // Immediate cancellation - downgrade profile immediately
      await supabase
        .from('profiles')
        .update({
          subscription_active: false,
          subscription_tier: 'basic',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
    }

    // Create notification
    await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        type: 'subscription',
        title: 'Subscription Cancelled',
        message: effectiveCancelAtEnd
          ? 'Your subscription will be cancelled at the end of the current billing period.'
          : 'Your subscription has been cancelled immediately.',
        priority: 'important',
        link: '/subscription-management'
      });

    console.log('Subscription cancelled:', cancelledSub ? cancelledSub.id : 'locally');

    return new Response(
      JSON.stringify({
        success: true,
        message: effectiveCancelAtEnd
          ? 'Subscription will be cancelled at end of billing period'
          : 'Subscription cancelled immediately',
        subscription: cancelledSub
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
