-- Add RLS policies for email_templates (admin/service role only)
CREATE POLICY "Service role can manage email templates"
ON public.email_templates
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add RLS policies for email_configurations (admin/service role only)
CREATE POLICY "Service role can manage email configurations"
ON public.email_configurations
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Add RLS policies for email_logs (users can view own, service role can insert)
CREATE POLICY "Users can view own email logs"
ON public.email_logs
FOR SELECT
USING (recipient_user_id = auth.uid());

CREATE POLICY "Service role can manage email logs"
ON public.email_logs
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');