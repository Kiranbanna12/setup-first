import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OTPRequest {
    email?: string;
    userId: string;
}

// Helper function to send email via SMTP
async function sendEmailViaSMTP(to: string, subject: string, htmlBody: string): Promise<boolean> {
    const SMTP_HOST = Deno.env.get('SMTP_HOST');
    const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const SMTP_USER = Deno.env.get('SMTP_USER');
    const SMTP_PASS = Deno.env.get('SMTP_PASS');
    const SMTP_FROM_NOREPLY = Deno.env.get('SMTP_FROM_NOREPLY') || 'noreply@xrozen.com';

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        console.error('SMTP not configured. Required: SMTP_HOST, SMTP_USER, SMTP_PASS');
        return false;
    }

    try {
        const client = new SMTPClient({
            connection: {
                hostname: SMTP_HOST,
                port: SMTP_PORT,
                tls: true,
                auth: {
                    username: SMTP_USER,
                    password: SMTP_PASS,
                },
            },
        });

        await client.send({
            from: SMTP_FROM_NOREPLY,
            to: to,
            subject: subject,
            content: "auto",
            html: htmlBody,
        });

        await client.close();
        console.log(`OTP email sent successfully via SMTP to ${to}`);
        return true;
    } catch (error: any) {
        console.error('SMTP email error:', error.message || error);
        return false;
    }
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

        step = 'send_email';
        console.log(`Sending OTP email to ${email}`);

        const htmlBody = `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5; padding: 20px; margin: 0;">
        <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="margin-bottom: 25px;">
            <img src="https://workflow.xrozen.com/logo.png" alt="Xrozen Workflow" style="width: 60px; height: 60px; border-radius: 50%;" />
            <h2 style="color: #16a34a; margin: 10px 0 0 0; font-size: 20px; font-weight: 700;">Xrozen Workflow</h2>
          </div>
          <h1 style="color: #1f2937; margin-bottom: 15px; font-size: 22px;">Verification Code</h1>
          <p style="color: #6b7280; margin-bottom: 25px;">Enter the following code to complete your login:</p>
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 25px; border-radius: 12px; margin-bottom: 25px;">
            <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #ffffff;">${otpCode}</span>
          </div>
          <p style="color: #9ca3af; font-size: 14px; margin-bottom: 8px;">This code expires in 10 minutes.</p>
          <p style="color: #d1d5db; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;"/>
          <p style="color: #9ca3af; font-size: 11px;">© ${new Date().getFullYear()} Xrozen Workflow. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;

        const emailSent = await sendEmailViaSMTP(email, 'Your Xrozen Login Verification Code', htmlBody);

        if (!emailSent) {
            throw new Error('Failed to send OTP email via SMTP');
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
        console.error(`Error at step ${step}:`, error.message);
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message,
                failed_at_step: step,
            }),
            {
                status: 200, // Return 200 to allow client error parsing
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
