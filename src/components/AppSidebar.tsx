// @ts-nocheck
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  UserCircle,
  MessageSquare,
  FileText,
  User,
  Settings,
  Sparkles,
  Bell,
  BookOpen,
  Lock,
  Crown,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNotifications } from "@/hooks/useNotifications";
import { SubscriptionLimitDialog } from "@/components/subscription/SubscriptionLimitDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type UserRole = "editor" | "client" | "agency" | "admin";

interface NavItem {
  title: string;
  url: string;
  icon: any;
  roles: UserRole[];
}

// All navigation items - shown to all users
const navItems: NavItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    roles: ["editor", "client", "agency", "admin"],
  },
  {
    title: "Projects",
    url: "/projects",
    icon: FolderKanban,
    roles: ["editor", "client", "agency", "admin"],
  },
  {
    title: "Notes",
    url: "/notes",
    icon: BookOpen,
    roles: ["editor", "client", "agency", "admin"],
  },
  {
    title: "Editors",
    url: "/editors",
    icon: UserCircle,
    roles: ["client", "agency", "admin"],
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
    roles: ["editor", "agency", "admin"],
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageSquare,
    roles: ["editor", "client", "agency", "admin"],
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
    roles: ["editor", "client", "agency", "admin"],
  },
  {
    title: "Invoices",
    url: "/invoices",
    icon: FileText,
    roles: ["editor", "client", "agency", "admin"],
  },

  {
    title: "XrozenAI",
    url: "/xrozen-ai",
    icon: Sparkles,
    roles: ["editor", "client", "agency", "admin"],
  },
  {
    title: "Profile",
    url: "/profile",
    icon: User,
    roles: ["editor", "client", "agency", "admin"],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    roles: ["editor", "client", "agency", "admin"],
  },
];

// Cache for user data to avoid repeated fetches
let cachedUserData: { userId: string; userRole: UserRole } | null = null;

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole, setUserRole] = useState<UserRole | null>(cachedUserData?.userRole || null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [userId, setUserId] = useState<string | null>(cachedUserData?.userId || null);
  const activeProjectRef = useRef<string | null>(null);
  const isOnChatPageRef = useRef<boolean>(false);

  // Upgrade dialog state
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  // Get notification unread count (realtime updates)
  const { unreadCount: notificationUnreadCount } = useNotifications();

  // Check if user has access to a page based on their role
  const hasAccess = useCallback((item: NavItem): boolean => {
    if (!userRole) return true; // Show as accessible while loading
    return item.roles.includes(userRole);
  }, [userRole]);

  // Handle logout
  const handleLogout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      // Clear cached data
      cachedUserData = null;
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }, [navigate]);

  // Handle navigation - show upgrade dialog for locked pages
  const handleNavigation = useCallback((item: NavItem) => {
    if (hasAccess(item)) {
      navigate(item.url);
    } else {
      // Show upgrade dialog with appropriate message
      const roleMessages: Record<string, string> = {
        "Editors": "The Editors page is available for Clients and Agencies. Upgrade your account to manage your editors.",
        "Clients": "The Clients page is available for Editors and Agencies. Upgrade your account to manage your clients.",
      };
      setUpgradeMessage(
        roleMessages[item.title] ||
        `Upgrade your plan to access ${item.title}. This feature is not available for your current account type.`
      );
      setShowUpgradeDialog(true);
    }
  }, [hasAccess, navigate]);

  // Track current active chat project and if on chat page in refs for realtime callbacks
  useEffect(() => {
    const isOnChat = location.pathname === '/chat' || location.pathname.startsWith('/chat');
    isOnChatPageRef.current = isOnChat;

    if (isOnChat) {
      const searchParams = new URLSearchParams(location.search);
      activeProjectRef.current = searchParams.get('project');
    } else {
      activeProjectRef.current = null;
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    // If we have cached data, use it immediately
    if (cachedUserData) {
      setUserId(cachedUserData.userId);
      setUserRole(cachedUserData.userRole);
    }

    // Load user role directly with Supabase
    const loadUserRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);

        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }

        // Direct Supabase query
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_category')
          .eq('id', user.id)
          .single();

        if (profile) {
          const role = profile.user_category as UserRole;
          setUserRole(role);
          // Cache the data
          cachedUserData = { userId: user.id, userRole: role };
        }
      } catch (error) {
        console.error("Error loading user role:", error);
      }
    };

    loadUserRole();
  }, []);

  // Load unread message count with realtime updates
  useEffect(() => {
    if (!userId) return;

    let projectIds: string[] = [];

    const loadUnreadCount = async () => {
      try {
        // Get projects the user owns
        const { data: ownedProjects } = await supabase
          .from('projects')
          .select('id')
          .eq('created_by', userId);

        // Get projects where user is a chat member
        const { data: memberProjects } = await supabase
          .from('project_chat_members' as any)
          .select('project_id')
          .eq('user_id', userId)
          .eq('is_active', true);

        // Get projects user is editor of
        const { data: editorData } = await supabase
          .from('editors')
          .select('id')
          .eq('user_id', userId);

        let assignedProjectIds: string[] = [];
        if (editorData && editorData.length > 0) {
          const editorIds = editorData.map(e => e.id);
          const { data: assignedProjects } = await supabase
            .from('projects')
            .select('id')
            .in('editor_id', editorIds);
          assignedProjectIds = (assignedProjects || []).map(p => p.id);
        }

        // Combine all project IDs
        const allProjectIds = new Set([
          ...(ownedProjects || []).map(p => p.id),
          ...(memberProjects || []).map((p: any) => p.project_id),
          ...assignedProjectIds
        ]);

        projectIds = [...allProjectIds];

        if (projectIds.length === 0) {
          setTotalUnread(0);
          return;
        }

        // Count unread messages in user's projects (not sent by user)
        const { count, error } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('project_id', projectIds)
          .eq('is_read', false)
          .neq('sender_id', userId);

        if (!error) {
          setTotalUnread(count || 0);
        }
      } catch (error) {
        // Silently fail - unread count is not critical
        console.error("Error loading unread count:", error);
        setTotalUnread(0);
      }
    };

    loadUnreadCount();

    // Subscribe to messages for realtime updates
    const messagesChannel = supabase
      .channel(`sidebar-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          // On INSERT - increment if it's not from current user
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new;
            // Check if message is in user's projects and not from user
            if (newMessage.sender_id !== userId && projectIds.includes(newMessage.project_id)) {
              setTotalUnread(prev => prev + 1);

              // Check if on chat page and if on active chat
              const isOnChatPage = isOnChatPageRef.current;
              const isOnActiveChat = activeProjectRef.current === newMessage.project_id;

              // If on active chat - ChatWindow handles sound, do nothing here
              if (isOnActiveChat) {
                // Do nothing - ChatWindow plays in-chat-message.mp3
              }
              // If on chat page but different project - just play sound, no toast
              else if (isOnChatPage) {
                try {
                  const audio = new Audio('/assets/sound-effects/message.mp3');
                  audio.volume = 0.6;
                  audio.play().catch(() => { });
                } catch (e) { }
              }
              // If NOT on chat page - play sound + show toast notification
              else {
                // Play message notification sound
                try {
                  const audio = new Audio('/assets/sound-effects/message.mp3');
                  audio.volume = 0.6;
                  audio.play().catch(() => { });
                } catch (e) { }

                // Fetch sender name and project name for toast
                Promise.all([
                  supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', newMessage.sender_id)
                    .single(),
                  supabase
                    .from('projects')
                    .select('name')
                    .eq('id', newMessage.project_id)
                    .single()
                ]).then(([profileResult, projectResult]) => {
                  const senderName = profileResult.data?.full_name || profileResult.data?.email || 'Someone';
                  const projectName = projectResult.data?.name || 'a project';
                  const messagePreview = newMessage.content?.substring(0, 40) + (newMessage.content?.length > 40 ? '...' : '');

                  // Import toast dynamically to avoid circular deps
                  import('sonner').then(({ toast }) => {
                    toast.info(`💬 ${senderName} in ${projectName}`, {
                      description: messagePreview,
                      duration: 4000,
                      action: {
                        label: 'View',
                        onClick: () => {
                          navigate(`/chat?project=${newMessage.project_id}`);
                        }
                      }
                    });
                  });

                  // Browser notification if tab not focused
                  if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
                    new Notification(`${senderName} in ${projectName}`, {
                      body: messagePreview,
                      icon: '/favicon.ico'
                    });
                  }
                });
              }
            }
          }
          // On UPDATE - check if message was marked as read
          else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new;
            const oldMessage = payload.old;
            // If message was just marked as read
            if (!oldMessage.is_read && updatedMessage.is_read && updatedMessage.sender_id !== userId) {
              setTotalUnread(prev => Math.max(0, prev - 1));
            }
          }
        }
      )
      .subscribe();

    // Fallback refresh every 2 minutes (less aggressive, realtime handles most updates)
    const interval = setInterval(loadUnreadCount, 120000);

    return () => {
      supabase.removeChannel(messagesChannel);
      clearInterval(interval);
    };
  }, [userId]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <Sidebar className="border-r bg-sidebar dark:bg-sidebar">
        <SidebarHeader className="border-b px-3 sm:px-4 lg:px-6 py-3 sm:py-4 bg-sidebar dark:bg-sidebar">
          <h2 className="text-base sm:text-lg lg:text-xl font-bold gradient-text">Xrozen Workflow</h2>
        </SidebarHeader>

        <SidebarContent className="px-2 sm:px-3 bg-sidebar dark:bg-sidebar">
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {navItems.map((item) => {
                  const isLocked = !hasAccess(item);

                  return (
                    <SidebarMenuItem key={item.title}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton
                            onClick={() => handleNavigation(item)}
                            isActive={isActive(item.url)}
                            tooltip={isLocked ? `Upgrade to access ${item.title}` : item.title}
                            className={`h-9 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm ${isLocked ? 'opacity-60 hover:opacity-80' : ''
                              }`}
                          >
                            <item.icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] flex-shrink-0" />
                            <span className="truncate">{item.title}</span>

                            {/* Lock icon for restricted pages */}
                            {isLocked && (
                              <Badge
                                variant="outline"
                                className="ml-auto h-5 px-1.5 text-xs border-amber-500/50 text-amber-500 flex items-center gap-1 flex-shrink-0"
                              >
                                <Lock className="h-3 w-3" />
                                <span className="hidden sm:inline">Upgrade</span>
                              </Badge>
                            )}

                            {/* Chat unread badge */}
                            {!isLocked && item.title === "Chat" && totalUnread > 0 && (
                              <Badge
                                variant="default"
                                className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs bg-[#25D366] hover:bg-[#25D366] text-white animate-in fade-in zoom-in duration-200 flex-shrink-0"
                              >
                                {totalUnread > 99 ? '99+' : totalUnread}
                              </Badge>
                            )}

                            {/* Notifications unread badge */}
                            {!isLocked && item.title === "Notifications" && notificationUnreadCount > 0 && (
                              <Badge
                                variant="default"
                                className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs bg-red-500 hover:bg-red-500 text-white animate-in fade-in zoom-in duration-200 flex-shrink-0"
                              >
                                {notificationUnreadCount > 99 ? '99+' : notificationUnreadCount}
                              </Badge>
                            )}
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        {isLocked && (
                          <TooltipContent side="right" className="flex items-center gap-2">
                            <Crown className="h-4 w-4 text-amber-500" />
                            <span>Upgrade to access {item.title}</span>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t p-3 sm:p-4 bg-sidebar dark:bg-sidebar">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            © 2025 Xrozen
          </p>
        </SidebarFooter>
      </Sidebar>

      {/* Upgrade Dialog */}
      <SubscriptionLimitDialog
        open={showUpgradeDialog}
        onOpenChange={setShowUpgradeDialog}
        title="Upgrade Your Plan"
        description={upgradeMessage}
      />
    </>
  );
}
