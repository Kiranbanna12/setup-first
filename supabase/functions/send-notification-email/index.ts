import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const eventType = templateName.replace('_', '-'); // Normalize to kebab-case (e.g. project_created -> project-created)
    const granularKey = templateName.includes('-') ? templateName.replace('-', '_') : templateName; // Try snake_case for granular key lookup (e.g. project-created -> project_created)

    // Check if user has granularly disabled this event
    // We check both kebab and snake case keys just to be safe with how frontend saves it
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

    // Get active email configuration
    const { data: config, error: configError } = await supabaseClient
      .from('email_configurations')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    if (configError || !config) {
      throw new Error('No active email configuration found');
    }

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
        configuration_id: config.id,
        recipient_email: user.email!,
        recipient_user_id: recipientId,
        subject,
        body: bodyHtml,
        status: 'pending',
      })
      .select()
      .single();

    // Send email using SMTP
    try {
      // Here you would integrate with your email service (Resend, SendGrid, etc.)
      // For now, we'll use a simple SMTP implementation
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${config.from_name} <${config.from_email}>`,
          to: [user.email],
          subject,
          html: bodyHtml,
          text: bodyText,
        }),
      });

      if (!emailResponse.ok) {
        throw new Error(`Email sending failed: ${await emailResponse.text()}`);
      }

      // Update log status
      await supabaseClient
        .from('email_logs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id);

      console.log(`Email sent successfully to ${user.email}`);

      return new Response(JSON.stringify({ success: true, logId: logEntry.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (emailError: any) {
      // Update log with error
      await supabaseClient
        .from('email_logs')
        .update({
          status: 'failed',
          error_message: emailError.message,
        })
        .eq('id', logEntry.id);

      throw emailError;
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
