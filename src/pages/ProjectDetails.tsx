import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Video, User, FileText, CheckCircle, AlertCircle, MessageSquare, BookOpen, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { VersionManagement } from "@/components/project-details/VersionManagement";
import { ShareButton } from "@/components/project-share/ShareButton";

const ProjectDetails = () => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [project, setProject] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [editor, setEditor] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [subProjects, setSubProjects] = useState<any[]>([]);
  const [subProjectVersions, setSubProjectVersions] = useState<Record<string, any[]>>({});
  const [mobileShareOpen, setMobileShareOpen] = useState(false);

  const [myEditorIds, setMyEditorIds] = useState<string[]>([]);
  const [myClientIds, setMyClientIds] = useState<string[]>([]);

  useEffect(() => {
    if (projectId) {
      setLoading(true);
      setVersions([]);
      setSubProjects([]);
      setSubProjectVersions({});

      loadProjectDetails();
      loadUserRole();
      loadCurrentUser();
    }
  }, [projectId]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);

        // Get all editor records associated with this user
        const { data: editors } = await supabase
          .from('editors')
          .select('id')
          .eq('user_id', user.id);

        if (editors) {
          setMyEditorIds(editors.map(e => e.id));
        }

        // Get all client records associated with this user
        const { data: clients } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id);

        if (clients) {
          setMyClientIds(clients.map(c => c.id));
        }
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const loadUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roles) {
        setUserRole(roles.role);
      }
    } catch (error) {
      console.error("Error loading user role:", error);
    }
  };

  const loadProjectDetails = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError || !projectData) {
        toast.error("Project not found");
        navigate("/projects");
        return;
      }

      setProject(projectData);

      // Load editor info if assigned
      if (projectData.editor_id) {
        const { data: editorData } = await supabase
          .from('editors')
          .select('*')
          .eq('id', projectData.editor_id)
          .maybeSingle();
        if (editorData) setEditor(editorData);
      }

      // Load client info if assigned
      if (projectData.client_id) {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('id', projectData.client_id)
          .maybeSingle();
        if (clientData) setClient(clientData);
      }

      // Load versions
      const { data: versionsData } = await supabase
        .from('video_versions')
        .select('*')
        .eq('project_id', projectId)
        .order('version_number', { ascending: false });

      setVersions(versionsData || []);

      // Load sub-projects
      const { data: subProjectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('parent_project_id', projectId);

      setSubProjects(subProjectsData || []);

      // Load versions for sub-projects
      if (subProjectsData && subProjectsData.length > 0) {
        const versionsMap: Record<string, any[]> = {};
        for (const subProject of subProjectsData) {
          const { data: subVersions } = await supabase
            .from('video_versions')
            .select('*')
            .eq('project_id', subProject.id)
            .order('version_number', { ascending: false });

          versionsMap[subProject.id] = subVersions || [];
        }
        setSubProjectVersions(versionsMap);
      }

    } catch (error: any) {
      console.error("Error loading project details:", error);
      toast.error("Failed to load project details");
    } finally {
      setLoading(false);
    }
  };

  const loadSubProjectVersions = async (subProjectId: string) => {
    try {
      const { data: versionsData } = await supabase
        .from('video_versions')
        .select('*')
        .eq('project_id', subProjectId)
        .order('version_number', { ascending: false });

      setSubProjectVersions(prev => ({
        ...prev,
        [subProjectId]: versionsData || []
      }));
    } catch (error) {
      console.error("Error loading sub-project versions:", error);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus as any })
        .eq('id', projectId);

      if (error) throw error;

      setProject((prev: any) => ({ ...prev, status: newStatus }));
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(error.message || "Failed to update status");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      draft: { variant: "secondary", label: "Draft", icon: FileText },
      in_review: { variant: "default", label: "In Review", icon: AlertCircle },
      approved: { variant: "default", label: "Approved", icon: CheckCircle, className: "bg-success" },
      completed: { variant: "default", label: "Completed", icon: CheckCircle, className: "bg-success" }
    };

    const config = variants[status] || variants.draft;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  // Check if current user is the assigned editor or client for the main project
  const isAssignedToMainProject =
    (project.editor_id && myEditorIds.includes(project.editor_id)) ||
    (project.client_id && myClientIds.includes(project.client_id));

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <AppSidebar />
        <div className="flex-1 bg-background dark:bg-background">
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4">
                <SidebarTrigger />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-3"
                  onClick={() => navigate("/projects")}
                >
                  <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Back to Projects</span>
                </Button>
              </div>
            </div>
          </header>

          <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            {/* Project Header */}
            <div className="mb-4 sm:mb-6 lg:mb-8">
              <div className="flex flex-row items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2 break-words leading-tight">{project.name}</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{project.description || "No description"}</p>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 w-auto flex-shrink-0 justify-end">
                  {getStatusBadge(project.status)}

                  {/* Desktop Actions */}
                  <div className="hidden sm:flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-sm"
                      onClick={() => navigate(`/projects/${projectId}/notes`)}
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Notes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-sm"
                      onClick={() => navigate(`/chat?project=${projectId}`)}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Chat
                    </Button>
                    <ShareButton
                      projectId={projectId!}
                      projectName={project.name}
                      variant="outline"
                      size="sm"
                    />
                  </div>

                  {/* Mobile Actions Dropdown */}
                  <div className="sm:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/projects/${projectId}/notes`)}>
                          <BookOpen className="w-4 h-4 mr-2" />
                          Notes
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate(`/chat?project=${projectId}`)}>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Chat
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setMobileShareOpen(true)}>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-4 h-4 mr-2"
                          >
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                            <polyline points="16 6 12 2 8 6" />
                            <line x1="12" y1="2" x2="12" y2="15" />
                          </svg>
                          Share
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Hidden Controlled Share Button for Mobile */}
                    <ShareButton
                      projectId={projectId!}
                      projectName={project.name}
                      open={mobileShareOpen}
                      onOpenChange={setMobileShareOpen}
                      variant="ghost"
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4 lg:mt-6">
                {/* Project Info Cards */}
                <Card className="shadow-elegant">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                      <Video className="w-3 h-3 sm:w-4 sm:h-4" />
                      Project Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm sm:text-base font-semibold">{project.project_type || "Not specified"}</p>
                  </CardContent>
                </Card>

                <Card className="shadow-elegant">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                      <User className="w-3 h-3 sm:w-4 sm:h-4" />
                      Editor
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm sm:text-base font-semibold">{editor?.full_name || "Not assigned"}</p>
                    {editor?.employment_type && (
                      <Badge variant="outline" className="mt-2 text-xs">
                        {editor.employment_type}
                      </Badge>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-elegant">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-2">
                      <User className="w-3 h-3 sm:w-4 sm:h-4" />
                      Client
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm sm:text-base font-semibold">{client?.full_name || "Not assigned"}</p>
                    {client?.company && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{client.company}</p>
                    )}
                  </CardContent>
                </Card>
              </div>



              {/* Dates and Fee */}
              <Card className="shadow-elegant mt-3 sm:mt-4">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Assigned Date</p>
                      <p className="font-medium text-xs sm:text-sm mt-0.5">
                        {project.assigned_date
                          ? new Date(project.assigned_date).toLocaleDateString()
                          : "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Deadline</p>
                      <p className="font-medium text-xs sm:text-sm mt-0.5">
                        {project.deadline
                          ? new Date(project.deadline).toLocaleDateString()
                          : "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Project Fee</p>
                      <p className="font-medium text-xs sm:text-sm mt-0.5">
                        {project.fee ? `₹${project.fee.toLocaleString()}` : "Not set"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-muted-foreground">Raw Footage</p>
                      {project.raw_footage_link ? (
                        <a
                          href={project.raw_footage_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs sm:text-sm"
                        >
                          View Link
                        </a>
                      ) : (
                        <p className="font-medium text-xs sm:text-sm mt-0.5">Not provided</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Workflow */}
            <Card className="shadow-elegant mb-4 sm:mb-6 lg:mb-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">Status Workflow</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Update project status based on current progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                  {[
                    { value: 'draft', label: 'Draft', icon: FileText },
                    { value: 'in_review', label: 'In Review', icon: AlertCircle },
                    { value: 'approved', label: 'Approved', icon: CheckCircle },
                    { value: 'completed', label: 'Completed', icon: CheckCircle }
                  ].map((statusOption) => {
                    const Icon = statusOption.icon;
                    const isActive = project.status === statusOption.value;
                    return (
                      <Button
                        key={statusOption.value}
                        variant="outline"
                        size="sm"
                        onClick={() => handleStatusUpdate(statusOption.value)}
                        className={`h-9 text-xs sm:text-sm ${isActive ? 'bg-primary/10 border-primary/30 text-primary' : ''}`}
                      >
                        <Icon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        {statusOption.label}
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Main Project Version Management */}
            {!loading && (
              <VersionManagement
                key={`main-${projectId}-v${versions.length}`}
                projectId={projectId!}
                versions={versions}
                onVersionsUpdate={loadProjectDetails}
                userRole={userRole}
                isProjectCreator={project?.created_by === currentUserId || isAssignedToMainProject}
                sectionTitle={project.name}
              />
            )}

            {/* Sub-Projects Version Management Sections */}
            {!loading && subProjects.length > 0 && subProjects.map((subProject) => {
              const isAssignedToSubProject =
                (subProject.editor_id && myEditorIds.includes(subProject.editor_id)) ||
                (subProject.client_id && myClientIds.includes(subProject.client_id));

              return (
                <div key={subProject.id} className="mt-8">
                  <VersionManagement
                    key={`sub-${subProject.id}-v${(subProjectVersions[subProject.id] || []).length}`}
                    projectId={subProject.id}
                    versions={subProjectVersions[subProject.id] || []}
                    onVersionsUpdate={() => loadSubProjectVersions(subProject.id)}
                    userRole={userRole}
                    isProjectCreator={project?.created_by === currentUserId || isAssignedToSubProject}
                    sectionTitle={subProject.name}
                  />
                </div>
              );
            })}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ProjectDetails;
