import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContactRequest {
    name: string;
    email: string;
    subject: string;
    message: string;
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

        const { name, email, subject, message }: ContactRequest = await req.json();

        // Validate input
        if (!name || !email || !subject || !message) {
            throw new Error('All fields are required');
        }

        // Store contact message in database
        const { data: savedMessage, error: insertError } = await supabaseClient
            .from('contact_messages')
            .insert({
                name,
                email,
                subject,
                message,
                status: 'new'
            })
            .select()
            .single();

        if (insertError) {
            console.error('Error saving contact message:', insertError);
            // Don't throw - continue without DB save
        } else {
            console.log('Contact message saved successfully:', savedMessage?.id);
        }

        // Get SMTP credentials from environment
        const SMTP_HOST = Deno.env.get('SMTP_HOST');
        const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465');
        const SMTP_USER = Deno.env.get('SMTP_USER');
        const SMTP_PASS = Deno.env.get('SMTP_PASS');
        // Use noreply for sending the notification email
        const SMTP_FROM_NOREPLY = Deno.env.get('SMTP_FROM_NOREPLY') || 'noreply@xrozen.com';
        // Contact form submissions go to support email
        const SMTP_TO_SUPPORT = Deno.env.get('SMTP_TO_SUPPORT') || 'support@xrozen.com';

        // Try to send email if SMTP is configured
        if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
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

                const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 8px 8px 0 0;">
              <table style="width: 100%;">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="https://workflow.xrozen.com/logo.png" alt="Xrozen" style="width: 40px; height: 40px; border-radius: 50%; vertical-align: middle;" />
                    <span style="color: #ffffff; font-size: 18px; font-weight: 700; margin-left: 10px; vertical-align: middle;">Xrozen Workflow</span>
                  </td>
                </tr>
              </table>
              <h2 style="color: #ffffff; margin: 15px 0 0 0; font-size: 16px;">📬 New Contact Form Submission</h2>
            </div>
            <div style="border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; width: 100px;"><strong>Name:</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${name}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Email:</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><a href="mailto:${email}" style="color: #10b981;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;"><strong>Subject:</strong></td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">${subject}</td>
                </tr>
              </table>
              <div style="margin-top: 20px;">
                <h3 style="color: #374151; margin-bottom: 10px;">Message:</h3>
                <div style="background: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                  ${message.replace(/\n/g, '<br>')}
                </div>
              </div>
              <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                  📅 Received: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST<br/>
                  💡 Reply directly to this email to respond to the customer.
                </p>
              </div>
            </div>
          </div>
        `;

                await client.send({
                    from: SMTP_FROM_NOREPLY,
                    to: SMTP_TO_SUPPORT,
                    subject: `[Contact Form] ${subject}`,
                    content: "auto",
                    html: htmlBody,
                    replyTo: email,  // Reply goes to the person who submitted the form
                });

                await client.close();
                console.log('Contact email sent successfully via SMTP to', SMTP_TO_SUPPORT);

            } catch (emailError: any) {
                console.error('SMTP email error:', emailError.message || emailError);
                // Don't fail the request if email fails - message is saved in DB
            }
        } else {
            console.log('SMTP not configured - message saved to database only');
            console.log('Required secrets: SMTP_HOST, SMTP_USER, SMTP_PASS');
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: 'Your message has been received. We will get back to you soon.',
                id: savedMessage?.id
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );

    } catch (error: any) {
        console.error('Error in send-contact-email function:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    }
});
