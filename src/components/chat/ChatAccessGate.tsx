// @ts-nocheck
/**
 * ChatAccessGate - Optimized for instant loading
 * Shows chat immediately for project owners, assigned editors/clients
 * Only checks membership for other users
 */
import { useState, useEffect, useMemo } from "react";
import { AlertCircle, Lock, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatAccessGateProps {
    projectId: string;
    currentUserId: string;
    onAccessGranted: () => void;
    children: React.ReactNode;
}

// Cache for access status to avoid repeated checks
const accessCache = new Map<string, { status: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

export const ChatAccessGate = ({
    projectId,
    currentUserId,
    onAccessGranted,
    children,
}: ChatAccessGateProps) => {
    const [accessStatus, setAccessStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [requesting, setRequesting] = useState(false);

    // Check cache first
    const cacheKey = `${projectId}-${currentUserId}`;

    useEffect(() => {
        // Check cache first for instant response
        const cached = accessCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            setAccessStatus(cached.status);
            setLoading(false);
            if (cached.status.hasAccess) {
                onAccessGranted();
            }
            return;
        }

        // If not cached, check access
        checkAccess();
    }, [projectId, currentUserId]);

    const checkAccess = async () => {
        try {
            setLoading(true);

            // Quick check: Get project and see if user is creator
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('created_by, editor_id, client_id')
                .eq('id', projectId)
                .single();

            if (projectError) {
                // Project not found - show children anyway (let ChatWindow handle errors)
                const status = { hasAccess: true, status: 'approved' };
                setAccessStatus(status);
                accessCache.set(cacheKey, { status, timestamp: Date.now() });
                return;
            }

            // 1. Project creator - instant access
            if (project.created_by === currentUserId) {
                const status = { hasAccess: true, status: 'approved' };
                setAccessStatus(status);
                accessCache.set(cacheKey, { status, timestamp: Date.now() });
                return;
            }

            // 2. Check if user is assigned editor or client (parallel queries)
            const [editorResult, clientResult] = await Promise.all([
                project.editor_id ? supabase.from('editors').select('user_id').eq('id', project.editor_id).maybeSingle() : null,
                project.client_id ? supabase.from('clients').select('user_id').eq('id', project.client_id).maybeSingle() : null
            ]);

            if (editorResult?.data?.user_id === currentUserId || clientResult?.data?.user_id === currentUserId) {
                const status = { hasAccess: true, status: 'approved' };
                setAccessStatus(status);
                accessCache.set(cacheKey, { status, timestamp: Date.now() });
                return;
            }

            // 3. Check chat membership (only for non-assigned users)
            const { data: member, error: memberError } = await supabase
                .from('project_chat_members' as any)
                .select('status, is_active')
                .eq('project_id', projectId)
                .eq('user_id', currentUserId)
                .maybeSingle();

            if (member) {
                const status = {
                    hasAccess: member.is_active,
                    status: member.status || (member.is_active ? 'approved' : 'pending')
                };
                setAccessStatus(status);
                accessCache.set(cacheKey, { status, timestamp: Date.now() });
                return;
            }

            // No membership found - can request access
            const status = { hasAccess: false, status: 'can_request' };
            setAccessStatus(status);
            accessCache.set(cacheKey, { status, timestamp: Date.now() });
        } catch (error: any) {
            console.error("Failed to check access:", error);
            // On error, default to showing access (graceful degradation)
            const status = { hasAccess: true, status: 'approved' };
            setAccessStatus(status);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestAccess = async () => {
        try {
            setRequesting(true);
            const { error } = await supabase
                .from('project_chat_members' as any)
                .insert({
                    project_id: projectId,
                    user_id: currentUserId,
                    status: 'pending',
                    is_active: false
                });

            if (error) throw error;

            toast.success("Request sent successfully");

            // Update local state and cache
            const status = { hasAccess: false, status: 'pending' };
            setAccessStatus(status);
            accessCache.set(cacheKey, { status, timestamp: Date.now() });
        } catch (error: any) {
            console.error("Error requesting access:", error);
            toast.error("Failed to request access");
        } finally {
            setRequesting(false);
        }
    };

    // Show loading only briefly
    if (loading) {
        return (
            <div className="flex items-center justify-center h-full px-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary mx-auto mb-3 sm:mb-4"></div>
                </div>
            </div>
        );
    }

    // User has access - show chat immediately
    if (accessStatus?.hasAccess) {
        return <>{children}</>;
    }

    // User needs to request or is pending
    return (
        <div className="flex items-center justify-center h-full p-3 sm:p-4 md:p-6 bg-background dark:bg-background">
            <Card className="w-full max-w-sm sm:max-w-md">
                <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                        {accessStatus?.status === "pending" && (
                            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-[#25D366]" />
                        )}
                        {accessStatus?.status === "removed" && (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
                        )}
                        {accessStatus?.status === "rejected" && (
                            <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600" />
                        )}
                        {accessStatus?.status === "can_request" && (
                            <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                        )}
                    </div>
                    <CardTitle className="text-base sm:text-lg md:text-xl">
                        {accessStatus?.status === "pending" && "Join Request Pending"}
                        {accessStatus?.status === "removed" && "Access Removed"}
                        {accessStatus?.status === "rejected" && "Request Rejected"}
                        {accessStatus?.status === "can_request" && "Chat Access Required"}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                        {accessStatus?.status === "pending" && (
                            "Your request to join this chat is pending admin approval."
                        )}
                        {accessStatus?.status === "removed" && (
                            "You were removed from this chat by the admin."
                        )}
                        {accessStatus?.status === "rejected" && (
                            "Your previous join request was rejected."
                        )}
                        {accessStatus?.status === "can_request" && (
                            "This is a private project chat. Request access to join."
                        )}
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                    {accessStatus?.status === "pending" ? (
                        <div className="flex items-center gap-1.5 sm:gap-2 p-3 sm:p-4 bg-[#25D366]/10 dark:bg-[#25D366]/20 rounded-lg">
                            <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#25D366] flex-shrink-0" />
                            <p className="text-xs sm:text-sm text-[#1a8c4a] dark:text-[#25D366]">
                                Waiting for admin approval...
                            </p>
                        </div>
                    ) : (
                        <Button
                            className="w-full text-xs sm:text-sm h-9 sm:h-10"
                            onClick={handleRequestAccess}
                            disabled={requesting}
                        >
                            {requesting ? "Sending Request..." : "Request to Join Chat"}
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
