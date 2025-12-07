import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(today.getDate() + 3);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Check for projects with deadlines
    const { data: projects, error } = await supabaseClient
      .from('projects')
      .select(`
        *,
        editor:editors!projects_editor_id_fkey(full_name, user_id),
        client:clients!projects_client_id_fkey(full_name, user_id)
      `)
      .not('deadline', 'is', null)
      .gte('deadline', today.toISOString().split('T')[0])
      .lte('deadline', threeDaysFromNow.toISOString().split('T')[0]);

    if (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }

    console.log(`Found ${projects?.length || 0} projects with upcoming deadlines`);

    // Process each project
    for (const project of projects || []) {
      const deadline = new Date(project.deadline);
      deadline.setHours(0, 0, 0, 0);
      
      const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const priority = daysRemaining === 0 ? 'critical' : daysRemaining === 1 ? 'important' : 'info';
      
      const userIds = [project.creator_id];
      if (project.editor?.user_id) userIds.push(project.editor.user_id);
      if (project.client?.user_id) userIds.push(project.client.user_id);

      // Create notifications
      for (const userId of userIds) {
        const { error: notifError } = await supabaseClient
          .from('notifications')
          .insert({
            user_id: userId,
            type: daysRemaining === 0 ? 'deadline_overdue' : 'deadline_approaching',
            priority,
            title: daysRemaining === 0 ? 'Deadline Today!' : `Deadline in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
            message: `Project "${project.name}" deadline is ${daysRemaining === 0 ? 'today' : `in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`}.`,
            link: `/projects/${project.id}`,
            metadata: { projectId: project.id, deadline: project.deadline, daysRemaining },
          });

        if (notifError) {
          console.error(`Error creating notification for user ${userId}:`, notifError);
        }

        // Send email for critical deadlines (today or tomorrow)
        if (daysRemaining <= 1) {
          await supabaseClient.functions.invoke('send-notification-email', {
            body: {
              recipientId: userId,
              templateName: 'deadline_reminder',
              variables: {
                projectName: project.name,
                daysRemaining: daysRemaining.toString(),
                link: `${Deno.env.get('SUPABASE_URL')}/projects/${project.id}`,
              },
            },
          });
        }
      }
    }

    // Check for overdue projects
    const { data: overdueProjects } = await supabaseClient
      .from('projects')
      .select(`
        *,
        editor:editors!projects_editor_id_fkey(full_name, user_id),
        client:clients!projects_client_id_fkey(full_name, user_id)
      `)
      .not('deadline', 'is', null)
      .lt('deadline', today.toISOString().split('T')[0])
      .neq('status', 'completed');

    // Create overdue notifications
    for (const project of overdueProjects || []) {
      const userIds = [project.creator_id];
      if (project.editor?.user_id) userIds.push(project.editor.user_id);
      if (project.client?.user_id) userIds.push(project.client.user_id);

      for (const userId of userIds) {
        await supabaseClient
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'deadline_overdue',
            priority: 'critical',
            title: 'Project Overdue!',
            message: `Project "${project.name}" is overdue.`,
            link: `/projects/${project.id}`,
            metadata: { projectId: project.id, deadline: project.deadline },
          });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: projects?.length || 0,
        overdue: overdueProjects?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in deadline-reminder-cron:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
