// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, AlertTriangle, Bell, Loader2 } from "lucide-react";
import { format, differenceInDays, isPast, isFuture } from "date-fns";
import { notificationTriggers } from "@/lib/notificationTriggers";
import { toast } from "sonner";

interface Project {
  id: string;
  name: string;
  deadline: string;
  status: string;
}

export function UpcomingDeadlines() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);

  useEffect(() => {
    loadDeadlines();
  }, []);

  const loadDeadlines = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await (supabase as any)
        .from('projects')
        .select('id, name, deadline, status')
        .eq('created_by', user.id)
        .not('deadline', 'is', null)
        .not('status', 'eq', 'completed')
        .order('deadline', { ascending: true })
        .limit(10);

      if (data) {
        setProjects(data as Project[]);
      }
    } catch (error) {
      console.error('Error loading deadlines:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDeadlineStatus = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const daysRemaining = differenceInDays(deadlineDate, new Date());

    if (isPast(deadlineDate)) {
      return { label: 'Overdue', variant: 'destructive' as const, days: Math.abs(daysRemaining) };
    } else if (daysRemaining <= 3) {
      return { label: 'Due Soon', variant: 'warning' as const, days: daysRemaining };
    } else {
      return { label: 'Upcoming', variant: 'default' as const, days: daysRemaining };
    }
  };

  const handleSendReminder = async (e: React.MouseEvent, project: Project) => {
    e.stopPropagation(); // Prevent navigation

    try {
      setSendingReminder(project.id);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const daysRemaining = differenceInDays(new Date(project.deadline), new Date());

      await notificationTriggers.deadlineReminder({
        projectId: project.id,
        projectName: project.name,
        deadline: project.deadline,
        daysRemaining: Math.max(0, daysRemaining),
        senderId: user.id,
      });

      toast.success('Reminder sent to all project members!');
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(null);
    }
  };

  if (loading) {
    return (
      <Card className="shadow-elegant">
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
            Upcoming Deadlines
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="space-y-2 sm:space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3 sm:p-4 rounded-lg border bg-card">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className="h-5 w-3/4 bg-muted/50 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-muted/50 rounded animate-pulse" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
                  <div className="h-4 w-20 bg-muted/50 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-elegant">
      <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
          Upcoming Deadlines
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <ScrollArea className="h-[350px] sm:h-[400px] pr-2 sm:pr-4">
          {projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm sm:text-base">No upcoming deadlines</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {projects.map((project) => {
                const deadlineStatus = getDeadlineStatus(project.deadline);
                return (
                  <div
                    key={project.id}
                    className="p-3 sm:p-4 rounded-lg border bg-card hover:bg-[#f5f6f6] dark:hover:bg-[#202428] transition-colors cursor-pointer"
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <h4 className="font-medium text-sm sm:text-base truncate flex-1">{project.name}</h4>
                      <Badge variant={deadlineStatus.variant === 'warning' ? 'destructive' : deadlineStatus.variant} className="text-xs shrink-0">
                        {deadlineStatus.label}
                      </Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate">{format(new Date(project.deadline), 'MMM dd, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {isPast(new Date(project.deadline)) ? (
                          <>
                            <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                            <span className="text-destructive">
                              {deadlineStatus.days} days overdue
                            </span>
                          </>
                        ) : (
                          <span>
                            {deadlineStatus.days} days remaining
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {project.status.replace('_', ' ')}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={(e) => handleSendReminder(e, project)}
                        disabled={sendingReminder === project.id}
                      >
                        {sendingReminder === project.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Bell className="h-3 w-3 mr-1" />
                            Send Reminder
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
