import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OTPRequest {
    email?: string;
    userId: string;
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    let step = 'init';
    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        step = 'parse_body';
        const { userId }: OTPRequest = await req.json();

        if (!userId) {
            throw new Error('User ID is required');
        }

        step = 'fetch_user';
        const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(userId);

        if (userError || !userData.user) {
            throw new Error(`User fetch failed: ${userError?.message || 'User not found'}`);
        }

        const user = userData.user;
        const email = user.email;

        if (!email) {
            throw new Error('User has no email address');
        }

        step = 'generate_otp';
        const { data: otpCode, error: otpError } = await supabaseClient.rpc('generate_otp', {
            p_user_id: user.id,
            p_email: email
        });

        if (otpError) {
            throw new Error(`OTP generation failed: ${otpError.message}`);
        }

        if (!otpCode) {
            throw new Error('OTP code generation returned null');
        }

        step = 'prepare_email';
        let resendApiKey = Deno.env.get('RESEND_API_KEY');

        if (resendApiKey) {
            resendApiKey = resendApiKey.replace(/^["']|["']$/g, '').trim();
        }

        if (!resendApiKey) {
            throw new Error('RESEND_API_KEY not configured');
        }

        step = 'send_email';
        console.log(`Sending email to ${email}`);

        const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: 'Xrozen Flow <onboarding@resend.dev>',
                to: [email],
                subject: 'Your Login Verification Code',
                html: `
          <!DOCTYPE html>
          <html>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h1 style="color: #3b82f6; margin-bottom: 20px; font-size: 24px;">Verification Code</h1>
                <p style="color: #666; margin-bottom: 30px;">Enter the following code to complete your login:</p>
                <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px dashed #3b82f6;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1d4ed8;">${otpCode}</span>
                </div>
                <p style="color: #888; font-size: 14px;">This code expires in 10 minutes.</p>
            </div>
          </body>
          </html>
        `,
            }),
        });

        if (!emailResponse.ok) {
            const errorText = await emailResponse.text();
            throw new Error(`Resend API error (${emailResponse.status}): ${errorText}`);
        }

        step = 'success';
        return new Response(
            JSON.stringify({
                success: true,
                message: 'OTP sent to your email',
                userId: user.id
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        );

    } catch (error: any) {
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                failed_at_step: step,
                details: error.stack
            }),
            {
                status: 200, // Return 200 to allow client error parsing
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
