import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Video, MessageSquare, Eye, Edit, Lock, CheckCircle, AlertCircle, FileText, LogIn } from "lucide-react";
import { toast } from "sonner";
import { SharedVersionManagement } from "@/components/project-share/SharedVersionManagement";

const SharedProject = () => {
    const navigate = useNavigate();
    const { shareToken } = useParams();
    const [project, setProject] = useState<any>(null);
    const [shareInfo, setShareInfo] = useState<any>(null);
    const [versions, setVersions] = useState<any[]>([]);
    const [subProjects, setSubProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasJoinedChat, setHasJoinedChat] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setIsAuthenticated(!!user);
        } catch {
            setIsAuthenticated(false);
        }
    };

    useEffect(() => {
        if (shareToken) {
            loadSharedProject();
            logAccess();
        }
    }, [shareToken, isAuthenticated]);

    const logAccess = async () => {
        try {
            await (supabase.rpc as any)('log_share_access_rpc', {
                token: shareToken!,
                agent: navigator.userAgent
            });
        } catch (error) {
            console.error("Error logging access:", error);
        }
    };

    const loadSharedProject = async () => {
        try {
            const { data, error } = await (supabase.rpc as any)('get_shared_project_data', {
                share_token_input: shareToken!
            });

            if (error || !data || (data as any).error) {
                toast.error("This share link is invalid or has been deactivated");
                navigate("/");
                return;
            }

            const shareData = data as any;
            setShareInfo(shareData.share);
            setProject(shareData.project);
            setVersions(shareData.versions || []);
            setSubProjects(shareData.sub_projects || []);

            // Record access for authenticated users with edit/chat permissions
            // Note: recordSharedAccess checks for user internally, so we just need to check permissions
            if (shareData.share.can_edit || shareData.share.can_chat) {
                recordSharedAccess(shareData.share, shareData.project.id);
            }

            if (shareData.share.can_chat) {
                checkChatMembership(shareData.share.project_id);
            }

        } catch (error: any) {
            console.error("Error loading shared project:", error);
            toast.error("Failed to load project");
            navigate("/");
        } finally {
            setLoading(false);
        }
    };

    const recordSharedAccess = async (share: any, projectId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Upsert to record access (update accessed_at if already exists)
            await supabase
                .from('user_accessed_shares' as any)
                .upsert({
                    user_id: user.id,
                    share_id: share.id,
                    project_id: projectId,
                    can_edit: share.can_edit || false,
                    can_chat: share.can_chat || false,
                    accessed_at: new Date().toISOString()
                }, {
                    onConflict: 'user_id,share_id'
                });
        } catch (error) {
            console.error("Error recording shared access:", error);
        }
    };

    const checkChatMembership = async (projectId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: member } = await (supabase
                .from('project_chat_members' as any) as any)
                .select('*')
                .eq('project_id', projectId)
                .eq('user_id', user.id)
                .maybeSingle();

            setHasJoinedChat(!!member && member.is_active);
        } catch (error) {
            console.error("Error checking chat membership:", error);
        }
    };

    const handleJoinChat = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                toast.error("Please login to join the chat", {
                    duration: 5000,
                    action: {
                        label: "Login",
                        onClick: () => navigate("/auth")
                    }
                });
                navigate("/auth");
                return;
            }

            // Check if already a member first to avoid error
            const { data: existing } = await (supabase
                .from('project_chat_members' as any) as any)
                .select('*')
                .eq('project_id', shareInfo.project_id)
                .eq('user_id', user.id)
                .maybeSingle();

            if (!existing) {
                // Insert as pending - project owner will approve
                const { error } = await (supabase
                    .from('project_chat_members' as any) as any)
                    .insert({
                        project_id: shareInfo.project_id,
                        user_id: user.id,
                        status: 'pending',
                        is_active: false
                    });

                if (error) throw error;
                toast.success("Join request sent! Waiting for approval.");
            } else if (existing.status === 'pending') {
                toast.info("Your join request is pending approval.");
            } else if (existing.is_active) {
                toast.success("You are already in the chat!");
                navigate(`/chat?project=${shareInfo.project_id}`);
                return;
            }

            setHasJoinedChat(existing?.is_active || false);
        } catch (error: any) {
            toast.error(error.message || "Failed to join chat");
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

    // Skeleton loading component
    const LoadingSkeleton = () => (
        <div className="min-h-screen bg-background dark:bg-background">
            <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary/50 animate-pulse" />
                        <div>
                            <div className="h-6 w-40 bg-muted/50 rounded animate-pulse mb-1" />
                            <div className="h-4 w-24 bg-muted/40 rounded animate-pulse" />
                        </div>
                    </div>
                </div>
            </header>
            <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto">
                <div className="mb-6">
                    <div className="h-8 w-64 bg-muted/50 rounded animate-pulse mb-2" />
                    <div className="h-4 w-96 bg-muted/40 rounded animate-pulse" />
                </div>
                <Card className="shadow-elegant mb-4">
                    <CardContent className="pt-6">
                        <div className="h-16 w-full bg-muted/30 rounded animate-pulse" />
                    </CardContent>
                </Card>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                        <Card key={i} className="shadow-elegant">
                            <CardHeader className="pb-3">
                                <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
                            </CardHeader>
                            <CardContent>
                                <div className="h-5 w-32 bg-muted/40 rounded animate-pulse" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
                <Card className="shadow-elegant mt-6">
                    <CardHeader>
                        <div className="h-5 w-32 bg-muted/50 rounded animate-pulse" />
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {[1, 2].map((i) => (
                                <div key={i} className="h-20 w-full bg-muted/30 rounded animate-pulse" />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </main>
        </div>
    );

    if (loading) {
        return <LoadingSkeleton />;
    }

    if (!project || !shareInfo) {
        return null;
    }

    // Main content component
    const ProjectContent = () => (
        <div className="min-h-screen bg-zinc-950 text-white dark">
            {/* Header */}
            <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* Add sidebar trigger if authenticated */}
                        {isAuthenticated && <SidebarTrigger />}

                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
                                <Video className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                            </div>
                            <div>
                                <h1 className="text-base sm:text-xl font-bold">{project.name}</h1>
                                <p className="text-xs sm:text-sm text-muted-foreground">Shared Project</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* Access Permissions Badge - Hidden on mobile */}
                        <div className="hidden sm:flex gap-1">
                            {shareInfo.can_view && (
                                <Badge variant="outline" className="gap-1">
                                    <Eye className="w-3 h-3" />
                                    View
                                </Badge>
                            )}
                            {shareInfo.can_edit && (
                                <Badge variant="outline" className="gap-1">
                                    <Edit className="w-3 h-3" />
                                    Edit
                                </Badge>
                            )}
                            {shareInfo.can_chat && (
                                <Badge variant="outline" className="gap-1">
                                    <MessageSquare className="w-3 h-3" />
                                    Chat
                                </Badge>
                            )}
                        </div>

                        {/* Chat Button */}
                        {shareInfo.can_chat && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div>
                                            <Button
                                                variant="default"
                                                onClick={() => {
                                                    if (!isAuthenticated) {
                                                        toast.info("Redirecting to login...", {
                                                            duration: 2000
                                                        });
                                                        navigate("/auth");
                                                        return;
                                                    }

                                                    if (!hasJoinedChat) {
                                                        handleJoinChat();
                                                    } else {
                                                        navigate(`/chat?project=${shareInfo.project_id}`);
                                                    }
                                                }}
                                                className={!isAuthenticated ? "gradient-primary opacity-90 hover:opacity-100" : "gradient-primary"}
                                            >
                                                {!isAuthenticated ? (
                                                    <>
                                                        <LogIn className="w-4 h-4 mr-2" />
                                                        Login to Join Chat
                                                    </>
                                                ) : (
                                                    <>
                                                        <MessageSquare className="w-4 h-4 mr-2" />
                                                        {hasJoinedChat ? "Open Chat" : "Join Chat"}
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </TooltipTrigger>
                                    {!isAuthenticated && (
                                        <TooltipContent>
                                            <p>Click to login and join the project chat</p>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>
                        )}
                    </div>
                </div>
            </header>

            <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto">
                {/* Project Header */}
                <div className="mb-4 sm:mb-6 lg:mb-8">
                    <div className="flex flex-row items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2 break-words leading-tight">{project.name}</h1>
                            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{project.description || "No description"}</p>
                        </div>
                        {getStatusBadge(project.status)}
                    </div>

                    {/* Access Notice */}
                    <Card className="shadow-elegant border-primary/20">
                        <CardContent className="pt-4 sm:pt-6">
                            <div className="flex items-start gap-2 sm:gap-3">
                                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-primary mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="text-sm sm:text-base font-semibold mb-1">Limited Access View</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                        You're viewing this project with {shareInfo.can_edit ? 'edit' : 'read-only'} access.
                                        {shareInfo.can_chat && " You can also access the project chat."}
                                        {!shareInfo.can_edit && " You cannot modify project settings or add feedback."}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Project Info Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4 lg:mt-6">
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
                                    <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                                    Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm sm:text-base font-semibold capitalize">
                                    {project.status.replace('_', ' ')}
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Dates */}
                    {(project.assigned_date || project.deadline) && (
                        <Card className="shadow-elegant mt-3 sm:mt-4">
                            <CardContent className="pt-4 sm:pt-6">
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    {project.assigned_date && (
                                        <div>
                                            <p className="text-xs sm:text-sm text-muted-foreground">Assigned Date</p>
                                            <p className="font-medium text-xs sm:text-sm mt-0.5">
                                                {new Date(project.assigned_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    )}
                                    {project.deadline && (
                                        <div>
                                            <p className="text-xs sm:text-sm text-muted-foreground">Deadline</p>
                                            <p className="font-medium text-xs sm:text-sm mt-0.5">
                                                {new Date(project.deadline).toLocaleDateString()}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Version Management */}
                {shareInfo.can_view && (
                    <SharedVersionManagement
                        projectId={shareInfo.project_id}
                        versions={versions}
                        onVersionsUpdate={loadSharedProject}
                        canEdit={shareInfo.can_edit}
                        shareToken={shareToken!}
                    />
                )}

                {/* Sub-Projects */}
                {shareInfo.can_view && subProjects.length > 0 && (
                    <div className="mt-4 sm:mt-6 lg:mt-8 space-y-4 sm:space-y-6 lg:space-y-8">
                        <h2 className="text-base sm:text-lg lg:text-xl font-bold border-b pb-2">Sub Projects</h2>
                        {subProjects.map((sp: any) => (
                            <div key={sp.id} className="space-y-3 sm:space-y-4">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm sm:text-base lg:text-lg font-semibold">{sp.name}</h3>
                                        {sp.description && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{sp.description}</p>}
                                    </div>
                                    {getStatusBadge(sp.status)}
                                </div>

                                <SharedVersionManagement
                                    projectId={sp.id}
                                    versions={sp.versions || []}
                                    onVersionsUpdate={loadSharedProject}
                                    canEdit={shareInfo.can_edit}
                                    shareToken={shareToken!}
                                    sectionTitle={`Versions for ${sp.name}`}
                                    isSubProject={true}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {!shareInfo.can_view && (
                    <Card className="shadow-elegant">
                        <CardContent className="pt-4 sm:pt-6 text-center py-8 sm:py-12">
                            <Lock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-muted-foreground opacity-50" />
                            <p className="text-muted-foreground text-sm sm:text-base lg:text-lg font-semibold">
                                You don't have permission to view project versions
                            </p>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                                Contact the project owner for additional access
                            </p>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );

    // Return with or without sidebar based on authentication
    if (isAuthenticated) {
        return (
            <SidebarProvider>
                <div className="flex w-full min-h-screen">
                    <AppSidebar />
                    <div className="flex-1">
                        <ProjectContent />
                    </div>
                </div>
            </SidebarProvider>
        );
    }

    return <ProjectContent />;
};

export default SharedProject;
