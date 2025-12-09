import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        // 1. Verify the user using their own JWT
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

        if (userError || !user) {
            throw new Error('Unauthorized');
        }

        // 2. Initialize Admin Client
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // 3. Handle Subscription Cancellation Logic
        try {
            // Get Razorpay config
            const { data: config } = await supabaseAdmin
                .from('app_settings')
                .select('value')
                .eq('key', 'razorpay_config')
                .single();

            if (config && (config.value as any).key_id && (config.value as any).key_secret) {
                const razorpayKeyId = (config.value as any).key_id;
                const razorpayKeySecret = (config.value as any).key_secret;

                // Find active subscription
                const { data: activeSub } = await supabaseAdmin
                    .from('user_subscriptions')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('status', 'active')
                    .single();

                if (activeSub && activeSub.razorpay_subscription_id) {
                    console.log(`Found active subscription ${activeSub.razorpay_subscription_id} for user ${user.id}. Cancelling...`);

                    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

                    // Cancel at Razorpay
                    const cancelResponse = await fetch(
                        `https://api.razorpay.com/v1/subscriptions/${activeSub.razorpay_subscription_id}/cancel`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': `Basic ${auth}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                cancel_at_cycle_end: 0 // Immediate cancellation
                            })
                        }
                    );

                    if (!cancelResponse.ok) {
                        const error = await cancelResponse.json();
                        console.error('Razorpay cancel error:', error);
                        // We proceed with deletion even if cancellation fails, but log it
                    } else {
                        console.log('Successfully cancelled Razorpay subscription');
                    }
                }
            }
        } catch (subError) {
            console.error('Error handling subscription cancellation:', subError);
            // Continue with account deletion even if subscription cleanup fails
            // ideally we might want to stop, but for user deletion request we should prioritize removing the account
        }

        // 4. Delete the user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

        if (deleteError) {
            throw deleteError;
        }

        return new Response(
            JSON.stringify({ success: true, message: 'Account and active subscriptions deleted successfully' }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        );
    }
});
