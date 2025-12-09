import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function should be called by a cron job to check and update subscription statuses
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();

    // Find subscriptions that have passed their grace period
    const { data: expiredSubs, error: expiredError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'pending')
      .lt('grace_period_end', now.toISOString());

    if (expiredError) {
      console.error('Error fetching expired subscriptions:', expiredError);
    }

    // Deactivate expired subscriptions
    for (const sub of expiredSubs || []) {
      console.log('Deactivating expired subscription:', sub.id);

      await supabase
        .from('user_subscriptions')
        .update({
          status: 'expired',
          updated_at: now.toISOString()
        })
        .eq('id', sub.id);

      // Revert user to free tier
      await supabase
        .from('profiles')
        .update({
          subscription_active: false,
          subscription_tier: 'basic',
          is_trial: false,
          updated_at: now.toISOString()
        })
        .eq('id', sub.user_id);

      // Notify user
      await supabase
        .from('notifications')
        .insert({
          user_id: sub.user_id,
          type: 'subscription',
          title: 'Subscription Expired',
          message: 'Your subscription has expired due to failed payment. Your account has been reverted to the free plan.',
          priority: 'high',
          link: '/subscription-management'
        });
    }

    // Check for subscriptions about to expire (1 day warning)
    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);

    const { data: expiringTrial, error: expiringError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('status', 'active')
      .eq('is_trial', true)
      .gte('end_date', now.toISOString())
      .lte('end_date', oneDayFromNow.toISOString());

    if (expiringError) {
      console.error('Error fetching expiring trials:', expiringError);
    }

    // Notify users about expiring trials
    for (const sub of expiringTrial || []) {
      // Check if we already sent a notification recently
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', sub.user_id)
        .eq('type', 'subscription')
        .like('title', '%Trial Ending%')
        .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (!existingNotif || existingNotif.length === 0) {
        await supabase
          .from('notifications')
          .insert({
            user_id: sub.user_id,
            type: 'subscription',
            title: 'Trial Ending Soon',
            message: 'Your trial period is ending tomorrow. Full subscription charges will apply from the next billing cycle.',
            priority: 'high',
            link: '/subscription-management'
          });
      }
    }

    console.log(`Processed ${expiredSubs?.length || 0} expired, ${expiringTrial?.length || 0} expiring trials`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: {
          expired: expiredSubs?.length || 0,
          expiringTrials: expiringTrial?.length || 0
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error checking subscription status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
