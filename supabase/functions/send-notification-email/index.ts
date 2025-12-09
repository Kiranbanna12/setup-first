import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  recipientId: string;
  templateName: string;
  variables: Record<string, string>;
  priority?: 'high' | 'normal';
}

// Helper function to send email via SMTP
async function sendEmailViaSMTP(to: string, subject: string, htmlBody: string, textBody?: string): Promise<boolean> {
  const SMTP_HOST = Deno.env.get('SMTP_HOST');
  const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '465');
  const SMTP_USER = Deno.env.get('SMTP_USER');
  const SMTP_PASS = Deno.env.get('SMTP_PASS');
  const SMTP_FROM_NOREPLY = Deno.env.get('SMTP_FROM_NOREPLY') || 'noreply@xrozen.com';

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log('SMTP not configured. Required: SMTP_HOST, SMTP_USER, SMTP_PASS');
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
      content: textBody || "auto",
      html: htmlBody,
    });

    await client.close();
    console.log(`Email sent successfully via SMTP to ${to}`);
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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { recipientId, templateName, variables, priority = 'normal' }: EmailRequest = await req.json();

    // Get recipient email
    const { data, error: userError } = await supabaseClient.auth.admin.getUserById(recipientId);
    if (userError || !data?.user) {
      throw new Error('User not found');
    }
    const user = data.user;

    // Check user's email preferences (Granular)
    const { data: preferences } = await supabaseClient
      .from('notification_preferences')
      .select('email_notifications')
      .eq('user_id', recipientId)
      .single();

    const emailNotifications = preferences?.email_notifications || {};
    const eventType = templateName.replace('_', '-');
    const granularKey = templateName.includes('-') ? templateName.replace('-', '_') : templateName;

    // Check if user has granularly disabled this event
    if (emailNotifications[templateName] === false || emailNotifications[granularKey] === false || emailNotifications[eventType] === false) {
      console.log(`Email skipped: User ${recipientId} has disabled ${templateName} emails`);
      return new Response(JSON.stringify({ skipped: true, reason: 'granular_preference' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check Global Settings (profiles.general_settings)
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('general_settings')
      .eq('id', recipientId)
      .single();

    if (profile?.general_settings) {
      const generalSettings = typeof profile.general_settings === 'string'
        ? JSON.parse(profile.general_settings)
        : profile.general_settings;

      if (generalSettings.email_notifications === false) {
        console.log(`Email skipped: User ${recipientId} has disabled global email notifications`);
        return new Response(JSON.stringify({ skipped: true, reason: 'global_preference' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get email template
    const { data: template, error: templateError } = await supabaseClient
      .from('email_templates')
      .select('*')
      .eq('name', templateName)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error('Email template not found');
    }

    // Get active email configuration (for from_name if needed)
    const { data: config } = await supabaseClient
      .from('email_configurations')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    // Replace variables in template
    let subject = template.subject;
    let bodyHtml = template.body_html;
    let bodyText = template.body_text || '';

    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      bodyHtml = bodyHtml.replace(new RegExp(placeholder, 'g'), value);
      bodyText = bodyText.replace(new RegExp(placeholder, 'g'), value);
    });

    // Create email log entry
    const { data: logEntry } = await supabaseClient
      .from('email_logs')
      .insert({
        configuration_id: config?.id,
        recipient_email: user.email!,
        recipient_user_id: recipientId,
        subject,
        body: bodyHtml,
        status: 'pending',
      })
      .select()
      .single();

    // Send email using SMTP
    const emailSent = await sendEmailViaSMTP(user.email!, subject, bodyHtml, bodyText);

    if (emailSent) {
      // Update log status
      if (logEntry) {
        await supabaseClient
          .from('email_logs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', logEntry.id);
      }

      console.log(`Email sent successfully to ${user.email}`);

      return new Response(JSON.stringify({ success: true, logId: logEntry?.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Update log with error
      if (logEntry) {
        await supabaseClient
          .from('email_logs')
          .update({
            status: 'failed',
            error_message: 'SMTP send failed',
          })
          .eq('id', logEntry.id);
      }

      throw new Error('Email sending failed via SMTP');
    }

  } catch (error: any) {
    console.error('Error in send-notification-email function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
