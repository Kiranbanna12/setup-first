// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Activity, Video, CheckCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityItem {
  id: string;
  type: 'project' | 'approval' | 'deadline';
  title: string;
  description: string;
  timestamp: string;
  status?: string;
}

export function RecentActivity() {
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
  }, []);

  const loadActivities = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const activities: ActivityItem[] = [];

      // Get recent projects
      const { data: projects } = await (supabase as any)
        .from('projects')
        .select('id, name, status, updated_at')
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (projects) {
        projects.forEach((project: any) => {
          activities.push({
            id: project.id,
            type: 'project',
            title: project.name,
            description: `Status: ${project.status}`,
            timestamp: project.updated_at,
            status: project.status,
          });
        });
      }



      // Sort all activities by timestamp
      activities.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(activities.slice(0, 10));
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'project':
        return <Video className="h-4 w-4" />;

      case 'approval':
        return <CheckCircle className="h-4 w-4" />;
      case 'deadline':
        return <Clock className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'in_review':
        return 'default';
      case 'approved':
        return 'success';
      default:
        return 'secondary';
    }
  };

  const handleActivityClick = (activity: ActivityItem) => {
    switch (activity.type) {
      case 'project':
        navigate(`/projects/${activity.id}`);
        break;
      case 'approval':
        navigate(`/projects/${activity.id}`);
        break;
      case 'deadline':
        navigate(`/projects/${activity.id}`);
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <Card className="shadow-elegant">
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <div className="space-y-2 sm:space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border bg-card">
                <div className="h-4 w-4 bg-muted/50 rounded animate-pulse mt-1" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-muted/50 rounded animate-pulse" />
                  <div className="h-3 w-1/4 bg-muted/50 rounded animate-pulse" />
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
          <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        <ScrollArea className="h-[350px] sm:h-[400px] pr-2 sm:pr-4">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm sm:text-base">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  onClick={() => handleActivityClick(activity)}
                  className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border bg-card hover:bg-[#f5f6f6] dark:hover:bg-[#202428] transition-colors cursor-pointer"
                >
                  <div className="mt-0.5 sm:mt-1 flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-1 sm:gap-2">
                      <p className="font-medium text-xs sm:text-sm break-words flex-1">{activity.title}</p>
                      {activity.status && (
                        <Badge variant={getStatusColor(activity.status) as any} className="text-xs shrink-0">
                          {activity.status.replace('_', ' ')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground break-words">
                      {activity.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
