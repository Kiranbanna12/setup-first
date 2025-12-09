import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ChatAccessGate } from "@/components/chat/ChatAccessGate";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

const Chat = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    searchParams.get("project") || null
  );
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData();
      setSearchParams({ project: selectedProjectId });
    }
  }, [selectedProjectId]);

  // Optimized: Combined auth and profile loading
  const loadAllData = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;

      if (!session) {
        toast.error("Please login to access chat", {
          duration: 5000,
          action: {
            label: "Login",
            onClick: () => navigate("/auth")
          }
        });
        navigate("/auth");
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setCurrentUser(profile || session.user);
    } catch (error: any) {
      console.error("Failed to load user data:", error);
      toast.error("Failed to load user data");
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const loadProjectData = async () => {
    if (!selectedProjectId) {
      return;
    }

    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', selectedProjectId)
        .single();

      if (error) throw error;
      setSelectedProject(project);
    } catch (error: any) {
      console.error("Failed to load project:", error);
      toast.error("Failed to load project details");
    }
  };

  const handleSelectProject = (projectId: string) => {
    // Clear existing project first to force reload
    setSelectedProject(null);
    setSelectedProjectId(projectId);
    setSearchParams({ project: projectId });
  };

  // Skeleton loading component for faster perceived loading
  const LoadingSkeleton = () => (
    <SidebarProvider>
      <div className="flex w-full min-h-screen md:h-screen md:overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col bg-background dark:bg-background">
          <header className="flex sticky top-0 border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm z-50 flex-shrink-0">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4 w-full">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Messages</h1>
              </div>
            </div>
          </header>
          <div className="flex-1 flex overflow-hidden">
            {/* Chat list skeleton */}
            <div className="w-full md:w-80 border-r p-3 space-y-3">
              <div className="h-10 bg-muted/50 rounded-lg animate-pulse" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="w-10 h-10 rounded-full bg-muted/50 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-muted/50 rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-muted/40 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
            {/* Empty chat area */}
            <div className="hidden md:flex flex-1 items-center justify-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen md:h-screen md:overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col bg-background dark:bg-background">
          {/* Header - Always visible on desktop, hidden on mobile when chat window is open */}
          <header className={`${selectedProjectId ? 'hidden md:flex' : 'flex'} sticky top-0 border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm z-50 flex-shrink-0`}>
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4 w-full">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Messages</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    Project-based communication
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 flex overflow-hidden md:min-h-0">
            {/* Chat List Sidebar - WhatsApp style: Hidden on mobile when chat is open */}
            <div className={`${selectedProjectId ? 'hidden md:flex' : 'flex'} w-full md:w-auto flex-col h-full overflow-hidden`}>
              <ChatList
                currentUserId={currentUser?.id}
                selectedProjectId={selectedProjectId}
                onSelectProject={handleSelectProject}
              />
            </div>

            {/* Chat Window - WhatsApp style: Full width on mobile, shared width on desktop */}
            {selectedProjectId && selectedProject ? (
              <div className={`${selectedProjectId ? 'flex' : 'hidden md:flex'} flex-1 flex-col w-full h-full overflow-hidden`}>
                <ChatAccessGate
                  projectId={selectedProjectId}
                  currentUserId={currentUser?.id}
                  onAccessGranted={() => { }}
                >
                  <ChatWindow
                    projectId={selectedProjectId}
                    projectName={selectedProject.name}
                    currentUserId={currentUser?.id}
                    projectCreatorId={selectedProject.created_by}
                    onBack={() => setSelectedProjectId(null)}
                  />
                </ChatAccessGate>
              </div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center bg-background dark:bg-background">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground text-lg font-semibold">
                    Select a project to start chatting
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Choose a project from the list to view messages
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Chat;
