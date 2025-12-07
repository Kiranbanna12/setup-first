import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyOTPRequest {
    userId: string;
    code: string;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { userId, code }: VerifyOTPRequest = await req.json();

        if (!userId || !code) {
            throw new Error('User ID and OTP code are required');
        }

        // Verify OTP using database function
        const { data: isValid, error: verifyError } = await supabaseClient.rpc('verify_otp', {
            p_user_id: userId,
            p_code: code
        });

        if (verifyError) {
            console.error('OTP verification error:', verifyError);
            throw new Error('Failed to verify OTP');
        }

        if (!isValid) {
            return new Response(
                JSON.stringify({
                    success: false,
                    error: 'Invalid or expired OTP code'
                }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 400,
                }
            );
        }

        console.log(`OTP verified successfully for user ${userId}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: 'OTP verified successfully'
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error: any) {
        console.error('Error in verify-otp function:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
