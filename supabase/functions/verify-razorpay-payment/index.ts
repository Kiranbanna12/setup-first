import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

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

    const { razorpay_order_id, razorpay_payment_id, razorpay_subscription_id, razorpay_signature, isResume, subscriptionId, isTrial, planId } = await req.json();

    // Get Razorpay config
    const { data: config } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'razorpay_config')
      .single();

    if (!config || !(config.value as any).key_secret) {
      throw new Error('Razorpay not configured');
    }

    const razorpayKeySecret = (config.value as any).key_secret;

    let isValidSignature = false;

    // Verify signature based on payment type (Subscription vs Order)
    if (razorpay_subscription_id) {
      // Subscription payment verification: razorpay_payment_id + "|" + razorpay_subscription_id
      const text = `${razorpay_payment_id}|${razorpay_subscription_id}`;
      const generated_signature = createHmac('sha256', razorpayKeySecret)
        .update(text)
        .digest('hex');
      isValidSignature = generated_signature === razorpay_signature;
    } else {
      // Standard order payment verification: razorpay_order_id + "|" + razorpay_payment_id
      const text = `${razorpay_order_id}|${razorpay_payment_id}`;
      const generated_signature = createHmac('sha256', razorpayKeySecret)
        .update(text)
        .digest('hex');
      isValidSignature = generated_signature === razorpay_signature;
    }

    if (!isValidSignature) {
      throw new Error('Payment signature verification failed');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Record payment transaction
    const paymentAmount = (isResume || isTrial) ? 1 : 0;

    await supabase
      .from('payment_transactions')
      .insert({
        user_id: user.id,
        amount: paymentAmount,
        status: 'completed',
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_subscription_id,
        payment_method: 'razorpay',
        currency: 'INR'
      });

    // Also record in payments table for billing history
    if (isResume || isTrial) {
      await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          amount: paymentAmount,
          currency: 'INR',
          status: 'captured',
          payment_id: razorpay_payment_id,
          order_id: razorpay_order_id,
          payment_date: new Date().toISOString()
        });
    }

    // Handle Resume Subscription (₹1 verification payment)
    if (isResume && subscriptionId) {
      // Update existing subscription from 'cancelling' to 'active'
      const { data: resumedSub, error: resumeError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .eq('user_id', user.id)
        .select(`
          *,
          subscription_plans (
            id,
            tier,
            user_category
          )
        `)
        .single();

      if (resumeError) {
        console.error('Error resuming subscription:', resumeError);
      } else if (resumedSub && resumedSub.subscription_plans) {
        const plan = resumedSub.subscription_plans;

        // Update profile to ensure subscription is marked active
        await supabase
          .from('profiles')
          .update({
            subscription_active: true,
            subscription_tier: plan.tier,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        // Create notification for subscription resume
        await supabase
          .from('notifications')
          .insert({
            user_id: user.id,
            type: 'subscription',
            title: '🔄 Subscription Resumed!',
            message: `Your subscription has been resumed. Welcome back!`,
            priority: 'high',
            link: '/subscription-management'
          });

        console.log('Subscription resumed successfully:', subscriptionId);
      }
    }
    // Handle Trial Subscription (₹1 trial payment via order API)
    else if (isTrial && planId) {
      // Get plan details
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single();

      if (planError || !plan) {
        console.error('Plan not found for trial:', planError);
        throw new Error(`Plan not found: ${planId}`);
      } else {
        // Calculate end date based on billing period
        const endDate = new Date();
        if (plan.billing_period === 'annual') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        } else {
          endDate.setMonth(endDate.getMonth() + 1);
        }

        console.log('Creating trial subscription for user:', user.id, 'plan:', planId);

        // Create trial subscription record
        const { data: trialSub, error: trialError } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: user.id,
            plan_id: planId,
            status: 'active',
            is_trial: true,
            trial_amount: 1,
            payment_id: razorpay_payment_id,
            start_date: new Date().toISOString(),
            end_date: endDate.toISOString()
          })
          .select()
          .single();

        if (trialError) {
          console.error('Error creating trial subscription:', trialError);
          throw new Error(`Failed to create trial subscription: ${trialError.message}`);
        } else {
          // Update profile with subscription details
          await supabase
            .from('profiles')
            .update({
              subscription_active: true,
              subscription_tier: plan.tier,
              user_category: plan.user_category,
              subscription_plan_id: plan.id,
              subscription_start_date: new Date().toISOString(),
              subscription_end_date: endDate.toISOString(),
              trial_used: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          // Create notification for trial activation
          await supabase
            .from('notifications')
            .insert({
              user_id: user.id,
              type: 'subscription',
              title: '🎉 Trial Activated!',
              message: `Your ${plan.name} trial has been activated. Enjoy premium features for 30 days!`,
              priority: 'important',
              link: '/subscription-management'
            });

          console.log('Trial subscription created:', trialSub?.id);
        }
      }
    }
    // Handle Subscription Activation (new subscription via subscription API)
    else if (razorpay_subscription_id) {
      // 1. Update user_subscriptions status to 'active'
      const { data: subscription, error: subError } = await supabase
        .from('user_subscriptions')
        .update({
          status: 'active',
          payment_id: razorpay_payment_id,
          updated_at: new Date().toISOString()
        })
        .eq('razorpay_subscription_id', razorpay_subscription_id)
        .select(`
          *,
          subscription_plans (
            id,
            tier,
            user_category,
            price_inr
          )
        `)
        .single();

      if (subError) {
        console.error('Error activating subscription:', subError);
        // Continue to try updating profile if we can find the sub, otherwise log error
      }

      if (subscription && subscription.subscription_plans) {
        const plan = subscription.subscription_plans;
        const isTrial = subscription.is_trial === true;

        // 2. Update user profile with new plan details and mark trial as used if applicable
        const profileUpdateData: any = {
          subscription_active: true,
          subscription_tier: plan.tier, // e.g., 'agency', 'basic'
          user_category: plan.user_category, // e.g., 'client', 'editor'
          subscription_plan_id: plan.id,
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: subscription.end_date,
          updated_at: new Date().toISOString()
        };

        if (isTrial) {
          profileUpdateData.trial_used = true;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .update(profileUpdateData)
          .eq('id', user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
        } else {
          // Create notification for subscription activation
          await supabase
            .from('notifications')
            .insert({
              user_id: user.id,
              type: 'subscription',
              title: isTrial ? '🎉 Trial Activated!' : '✅ Subscription Activated!',
              message: isTrial
                ? `Your ${plan.name || 'subscription'} trial has been activated. Enjoy premium features for 30 days!`
                : `Your ${plan.name || 'subscription'} has been activated. Thank you for subscribing!`,
              priority: 'important',
              link: '/subscription-management'
            });

          console.log("Profile updated successfully", profileUpdateData);
        }
      }
    }

    console.log('Payment verified successfully:', razorpay_payment_id);

    return new Response(
      JSON.stringify({ success: true, message: 'Payment verified and processed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error verifying payment:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
