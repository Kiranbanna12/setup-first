import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, Trash2, ArrowLeft, RefreshCw, Filter } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Notifications = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    markAllAsRead,
    deleteAll,
    refresh,
  } = useNotifications();

  const [filterPriority, setFilterPriority] = useState<string[]>(['info', 'important', 'critical', 'high', 'normal']);
  const [filterType, setFilterType] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
      toast.success("Notifications refreshed");
    } catch (error) {
      toast.error("Failed to refresh notifications");
    } finally {
      setRefreshing(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      toast.success("All notifications marked as read");
    } catch (error) {
      toast.error("Failed to mark notifications as read");
    }
  };

  const handleDeleteAll = async () => {
    try {
      await deleteAll();
      toast.success("All notifications cleared");
    } catch (error) {
      toast.error("Failed to clear notifications");
    }
  };

  // Filter notifications based on priority and type
  const filteredNotifications = notifications.filter((n) => {
    const priorityMatch = filterPriority.length === 0 || filterPriority.includes(n.priority);
    // Assuming 'type' exists on Notification interface. If not, this might need adjustment based on schema.
    // The old app used 'type', the new hook types need to be checked.
    // For now, retaining old logic, will verify types if it errors.
    const typeMatch = filterType.length === 0 || (n.type && filterType.includes(n.type));
    return priorityMatch && typeMatch;
  });

  const unreadNotifications = filteredNotifications.filter((n) => !n.read);

  // Get unique types for filter
  const uniqueTypes = Array.from(new Set(notifications.map(n => n.type))).filter(Boolean);

  // Skeleton loading component
  const LoadingSkeleton = () => (
    <SidebarProvider>
      <div className="flex w-full min-h-screen overflow-hidden">
        <AppSidebar />
        <div className="flex-1 bg-background dark:bg-background overflow-x-hidden overflow-y-auto">
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4 w-full max-w-full">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Notifications</h1>
              </div>
            </div>
          </header>
          <main className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 w-full max-w-full">
            <div className="mb-4 sm:mb-6 lg:mb-8">
              <div className="h-7 w-48 bg-muted/50 rounded animate-pulse mb-2" />
              <div className="h-4 w-72 bg-muted/40 rounded animate-pulse" />
            </div>
            <Card className="shadow-elegant">
              <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
                  <div className="h-5 w-32 bg-muted/50 rounded animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="w-10 h-10 rounded-full bg-muted/50 animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
                        <div className="h-3 w-1/2 bg-muted/40 rounded animate-pulse" />
                        <div className="h-3 w-1/4 bg-muted/30 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen overflow-hidden">
        <AppSidebar />
        <div className="flex-1 bg-background dark:bg-background overflow-x-hidden overflow-y-auto">
          {/* Header - Matching Dashboard and Projects style */}
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4 w-full max-w-full">
              <SidebarTrigger />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="hidden sm:flex h-9 w-9 sm:h-10 sm:w-10"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Notifications</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="h-9 w-9 sm:h-10 sm:w-10"
                >
                  <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
                <NotificationBell />
              </div>
            </div>
          </header>

          <main className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 w-full max-w-full overflow-x-hidden">
            {/* Page title section - Matching Dashboard and Projects style */}
            <div className="mb-4 sm:mb-6 lg:mb-8 max-w-full">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2 break-words">Your Notifications</h2>
              <p className="text-xs sm:text-sm text-muted-foreground break-words">
                Stay updated with real-time notifications from your projects and activities
              </p>
            </div>

            <Card className="shadow-elegant w-full max-w-full overflow-hidden">
              <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 w-full">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg flex-shrink-0">
                    <Bell className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span className="truncate">All Notifications</span>
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    {/* Filter Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
                        >
                          <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          <span className="hidden sm:inline">Filter</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 sm:w-56">
                        <DropdownMenuLabel className="text-xs sm:text-sm">Priority</DropdownMenuLabel>
                        <DropdownMenuCheckboxItem
                          checked={filterPriority.includes('info')}
                          onCheckedChange={(checked) => {
                            setFilterPriority(prev =>
                              checked ? [...prev, 'info'] : prev.filter(p => p !== 'info')
                            );
                          }}
                        >
                          Info
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={filterPriority.includes('important')}
                          onCheckedChange={(checked) => {
                            setFilterPriority(prev =>
                              checked ? [...prev, 'important'] : prev.filter(p => p !== 'important')
                            );
                          }}
                        >
                          Important
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuCheckboxItem
                          checked={filterPriority.includes('critical')}
                          onCheckedChange={(checked) => {
                            setFilterPriority(prev =>
                              checked ? [...prev, 'critical'] : prev.filter(p => p !== 'critical')
                            );
                          }}
                        >
                          Critical
                        </DropdownMenuCheckboxItem>
                        {uniqueTypes.length > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs sm:text-sm">Type</DropdownMenuLabel>
                            {uniqueTypes.map((type) => (
                              <DropdownMenuCheckboxItem
                                key={type}
                                checked={filterType.includes(type)}
                                onCheckedChange={(checked) => {
                                  setFilterType(prev =>
                                    checked ? [...prev, type] : prev.filter(t => t !== type)
                                  );
                                }}
                              >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                              </DropdownMenuCheckboxItem>
                            ))}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      disabled={unreadCount === 0}
                      className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
                    >
                      <CheckCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Mark all read</span>
                      <span className="sm:hidden">Read</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDeleteAll}
                      disabled={notifications.length === 0}
                      className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
                    >
                      <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Clear all</span>
                      <span className="sm:hidden">Clear</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0 sm:px-6 pb-4 sm:pb-6 w-full max-w-full overflow-hidden">
                <Tabs defaultValue="unread" className="w-full max-w-full">
                  <TabsList className="grid w-full max-w-full grid-cols-2 mx-4 sm:mx-0 mb-4">
                    <TabsTrigger value="unread" className="text-xs sm:text-sm truncate">
                      <span className="truncate">Unread ({unreadNotifications.length})</span>
                    </TabsTrigger>
                    <TabsTrigger value="all" className="text-xs sm:text-sm truncate">
                      <span className="truncate">All ({filteredNotifications.length})</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="unread" className="mt-0 w-full max-w-full overflow-hidden">
                    <ScrollArea className="h-[calc(100vh-400px)] sm:h-[600px] pr-2 sm:pr-4 w-full">
                      {unreadNotifications.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground px-4 w-full">
                          <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="text-sm sm:text-base break-words">No unread notifications</p>
                          <p className="text-xs sm:text-sm mt-2 opacity-70 break-words">You're all caught up!</p>
                        </div>
                      ) : (
                        <div className="space-y-1 sm:space-y-2 w-full max-w-full">
                          {unreadNotifications.map((notification) => (
                            <NotificationItem
                              key={notification.id}
                              notification={notification}
                            />
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="all" className="mt-0 w-full max-w-full overflow-hidden">
                    <ScrollArea className="h-[calc(100vh-400px)] sm:h-[600px] pr-2 sm:pr-4 w-full">
                      {filteredNotifications.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground px-4 w-full">
                          <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p className="text-sm sm:text-base break-words">
                            {notifications.length === 0 ? 'No notifications yet' : 'No notifications match your filters'}
                          </p>
                          <p className="text-xs sm:text-sm mt-2 opacity-70 break-words">
                            {notifications.length === 0
                              ? 'Notifications will appear here when you have activity'
                              : 'Try adjusting your filter settings'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1 sm:space-y-2 w-full max-w-full">
                          {filteredNotifications.map((notification) => (
                            <NotificationItem
                              key={notification.id}
                              notification={notification}
                            />
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Notifications;
