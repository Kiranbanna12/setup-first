-- Create notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  tags TEXT[],
  is_favorite BOOLEAN DEFAULT false,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notes
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for notes
CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- Create video_feedback table
CREATE TABLE public.video_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  version_id UUID REFERENCES public.video_versions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT,
  user_email TEXT,
  comment_text TEXT NOT NULL,
  timestamp_seconds NUMERIC,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on video_feedback
ALTER TABLE public.video_feedback ENABLE ROW LEVEL SECURITY;

-- RLS policies for video_feedback (allow project members to view/add feedback)
CREATE POLICY "Users can view feedback on their projects" ON public.video_feedback FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM projects p 
    WHERE p.id = video_feedback.project_id 
    AND (p.created_by = auth.uid() OR p.editor_id IN (SELECT id FROM editors WHERE user_id = auth.uid()) OR p.client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()))
  )
);

CREATE POLICY "Authenticated users can add feedback" ON public.video_feedback FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON public.video_feedback FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback" ON public.video_feedback FOR DELETE 
USING (auth.uid() = user_id);

-- Create push_tokens table for mobile notifications
CREATE TABLE public.push_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token TEXT NOT NULL,
  device_type TEXT DEFAULT 'web',
  device_info JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS on push_tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for push_tokens
CREATE POLICY "Users can manage their own push tokens" ON public.push_tokens FOR ALL USING (auth.uid() = user_id);

-- Create email_templates table for notification emails
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on email_templates (admin only access via service role)
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create email_configurations table
CREATE TABLE public.email_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'smtp',
  from_email TEXT NOT NULL,
  from_name TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_configurations ENABLE ROW LEVEL SECURITY;

-- Create email_logs table
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  configuration_id UUID REFERENCES public.email_configurations(id),
  recipient_email TEXT NOT NULL,
  recipient_user_id UUID,
  subject TEXT NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Add general_settings column to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'general_settings') THEN
    ALTER TABLE public.profiles ADD COLUMN general_settings JSONB DEFAULT '{}';
  END IF;
END $$;

-- Insert default email templates
INSERT INTO public.email_templates (name, subject, body_html) VALUES
('project-assigned', 'New Project Assigned: {projectName}', '<h1>New Project Assigned</h1><p>You have been assigned to project <strong>{projectName}</strong>.</p><p><a href="{link}">View Project</a></p>'),
('project-created', 'Project Created: {projectName}', '<h1>Project Created</h1><p>Project <strong>{projectName}</strong> has been created.</p><p><a href="{link}">View Project</a></p>'),
('project-status-changed', 'Project Status Updated: {projectName}', '<h1>Project Status Updated</h1><p>Project <strong>{projectName}</strong> status changed to <strong>{newStatus}</strong>.</p><p><a href="{link}">View Project</a></p>'),
('deadline-approaching', 'Deadline Approaching: {projectName}', '<h1>Deadline Approaching</h1><p>Project <strong>{projectName}</strong> is due on <strong>{deadline}</strong>.</p><p><a href="{link}">View Project</a></p>'),
('feedback-added', 'New Feedback on {projectName}', '<h1>New Feedback Added</h1><p>New feedback has been added to project <strong>{projectName}</strong>.</p><p><a href="{link}">View Feedback</a></p>'),
('chat-message', 'New Message from {senderName}', '<h1>New Message</h1><p><strong>{senderName}</strong> sent you a message:</p><p>{messagePreview}</p><p><a href="{link}">View Chat</a></p>')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_project_id ON public.notes(project_id);
CREATE INDEX IF NOT EXISTS idx_video_feedback_version_id ON public.video_feedback(version_id);
CREATE INDEX IF NOT EXISTS idx_video_feedback_project_id ON public.video_feedback(project_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;