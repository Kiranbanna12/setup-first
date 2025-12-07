import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Copy, Check, Users, Eye, MessageSquare, Edit, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";

interface ShareButtonProps {
    projectId: string;
    projectName: string;
    variant?: "default" | "outline" | "ghost";
    size?: "default" | "sm" | "lg" | "icon";
    className?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    showLabel?: boolean;
}

interface ShareLink {
    id: string;
    share_token: string;
    can_view: boolean;
    can_edit: boolean;
    can_chat: boolean;
    is_active: boolean;
    created_at: string;
}

interface AccessLog {
    id: string;
    user_id?: string;
    guest_identifier?: string;
    accessed_at: string;
    user_agent?: string;
    profile?: {
        full_name?: string;
        email?: string;
    };
}

export const ShareButton = ({
    projectId,
    projectName,
    variant = "default",
    size = "default",
    showLabel = true,
    className,
    open: controlledOpen,
    onOpenChange: setControlledOpen
}: ShareButtonProps) => {
    const [internalOpen, setInternalOpen] = useState(false);

    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;
    const setOpen = isControlled ? (setControlledOpen || (() => { })) : setInternalOpen;

    const [shares, setShares] = useState<ShareLink[]>([]);
    const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);

    // New share permissions
    const [canView, setCanView] = useState(true);
    const [canEdit, setCanEdit] = useState(false);
    const [canChat, setCanChat] = useState(false);
    const { canCreateEditableShare, hasActiveSubscription } = useSubscriptionLimits();

    useEffect(() => {
        if (open) {
            loadShares();
            loadAccessLogs();
        }
    }, [open]);

    const loadShares = async () => {
        try {
            const { data, error } = await supabase
                .from('project_shares' as any)
                .select('*')
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setShares((data as any[]) || []);
        } catch (error) {
            console.error("Error loading shares:", error);
            // toast.error("Failed to load share links");
        }
    };

    const loadAccessLogs = async () => {
        try {
            // First, get all share IDs for this project
            const { data: shares, error: sharesError } = await supabase
                .from('project_shares' as any)
                .select('id')
                .eq('project_id', projectId);

            if (sharesError) throw sharesError;

            if (!shares || shares.length === 0) {
                setAccessLogs([]);
                return;
            }

            const shareIds = shares.map((s: any) => s.id);

            // Get access logs for these shares
            const { data: logs, error: logsError } = await supabase
                .from('project_share_access_logs' as any)
                .select('*')
                .in('share_id', shareIds)
                .order('accessed_at', { ascending: false });

            if (logsError) throw logsError;

            // Get unique user IDs to fetch profiles
            const userIds = [...new Set((logs as any[])?.filter((l: any) => l.user_id).map((l: any) => l.user_id) || [])];

            let profilesMap: Record<string, any> = {};
            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles' as any)
                    .select('id, full_name, email')
                    .in('id', userIds);

                profilesMap = (profiles as any[] || []).reduce((acc: Record<string, any>, p: any) => {
                    acc[p.id] = p;
                    return acc;
                }, {});
            }

            // Transform data to match interface
            const formattedLogs = (logs as any[])?.map((log: any) => ({
                ...log,
                profile: log.user_id ? profilesMap[log.user_id] : null
            })) as any[];

            setAccessLogs(formattedLogs || []);
        } catch (error) {
            console.error("Error loading access logs:", error);
        }
    };

    const handleCreateShare = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            const { data, error } = await supabase
                .from('project_shares' as any)
                .insert({
                    project_id: projectId,
                    can_view: canView,
                    can_edit: canEdit,
                    can_chat: canChat,
                    created_by: user.id
                })
                .select()
                .single();

            if (error) throw error;

            setShares([data as any, ...shares]);
            toast.success("Share link created successfully!");

            // Reset permissions
            setCanView(true);
            setCanEdit(false);
            setCanChat(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to create share link");
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = (token: string) => {
        const shareUrl = `${window.location.origin}/shared/${token}`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(token);
        toast.success("Link copied to clipboard!");

        setTimeout(() => setCopied(null), 2000);
    };

    const handleToggleShare = async (shareId: string, isActive: boolean) => {
        try {
            const { error } = await supabase
                .from('project_shares' as any)
                .update({ is_active: !isActive })
                .eq('id', shareId);

            if (error) throw error;

            setShares(shares.map(s =>
                s.id === shareId ? { ...s, is_active: !isActive } : s
            ));
            toast.success(isActive ? "Share link deactivated" : "Share link activated");
        } catch (error) {
            toast.error("Failed to update share link");
        }
    };

    const handleDeleteShare = async (shareId: string) => {
        try {
            const { error } = await supabase
                .from('project_shares' as any)
                .delete()
                .eq('id', shareId);

            if (error) throw error;

            setShares(shares.filter(s => s.id !== shareId));
            toast.success("Share link deleted");
        } catch (error) {
            toast.error("Failed to delete share link");
        }
    };

    const getPermissionBadges = (share: ShareLink) => {
        const badges = [];
        if (share.can_view) badges.push(<Badge key="view" variant="outline" className="text-xs"><Eye className="w-3 h-3 mr-1" />View</Badge>);
        if (share.can_edit) badges.push(<Badge key="edit" variant="outline" className="text-xs"><Edit className="w-3 h-3 mr-1" />Edit</Badge>);
        if (share.can_chat) badges.push(<Badge key="chat" variant="outline" className="text-xs"><MessageSquare className="w-3 h-3 mr-1" />Chat</Badge>);
        return badges;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const uniqueAccessCount = accessLogs.reduce((acc, log) => {
        const identifier = log.user_id || log.guest_identifier;
        if (identifier && !acc.includes(identifier)) {
            acc.push(identifier);
        }
        return acc;
    }, [] as string[]).length;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant={variant} size={size} className={`${size === "icon" ? "" : "text-xs sm:text-sm h-8 sm:h-9"} ${className || ""}`}>
                    <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    {showLabel && size !== "icon" && <span className="ml-1 sm:ml-2">Share</span>}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                        <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="text-sm sm:text-base">Share: {projectName}</span>
                    </DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                        Create shareable links with custom permissions for collaborators
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="create" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 h-9 sm:h-10">
                        <TabsTrigger value="create" className="text-xs sm:text-sm">Create</TabsTrigger>
                        <TabsTrigger value="links" className="text-xs sm:text-sm">Links ({shares.filter(s => s.is_active).length})</TabsTrigger>
                        <TabsTrigger value="access" className="text-xs sm:text-sm">Access ({uniqueAccessCount})</TabsTrigger>
                    </TabsList>

                    <TabsContent value="create" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm sm:text-base">Create New Share Link</CardTitle>
                                <CardDescription className="text-xs sm:text-sm">
                                    Set permissions for what recipients can do with this project
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 sm:space-y-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                    <div className="space-y-0.5 flex-1">
                                        <Label className="text-xs sm:text-sm flex items-center gap-2">
                                            <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
                                            View Access
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Can view project details and versions (always enabled)
                                        </p>
                                    </div>
                                    <Switch checked={canView} disabled className="flex-shrink-0" />
                                </div>

                                <Separator />

                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                    <div className="space-y-0.5 flex-1">
                                        <Label className="text-xs sm:text-sm flex items-center gap-2">
                                            <Edit className="w-3 h-3 sm:w-4 sm:h-4" />
                                            Edit Access
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Can add feedback and request corrections on versions
                                            {!canCreateEditableShare && " (Paid plan required)"}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={canEdit}
                                        onCheckedChange={setCanEdit}
                                        className="flex-shrink-0"
                                        disabled={!canCreateEditableShare}
                                    />
                                </div>

                                <Separator />

                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                    <div className="space-y-0.5 flex-1">
                                        <Label className="text-xs sm:text-sm flex items-center gap-2">
                                            <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                                            Chat Access
                                        </Label>
                                        <p className="text-xs text-muted-foreground">
                                            Can access and participate in project chat
                                            {!canCreateEditableShare && " (Paid plan required)"}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={canChat}
                                        onCheckedChange={setCanChat}
                                        className="flex-shrink-0"
                                        disabled={!canCreateEditableShare}
                                    />
                                </div>

                                <Button
                                    onClick={handleCreateShare}
                                    disabled={loading}
                                    variant="outline"
                                    size="sm"
                                    className="w-full text-xs sm:text-sm h-9 bg-primary/10 border-primary/30 text-primary mt-2"
                                >
                                    {loading ? "Creating..." : "Create Share Link"}
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="links" className="space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                        {shares.length === 0 ? (
                            <Card>
                                <CardContent className="pt-6 pb-6 text-center">
                                    <Share2 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                                    <p className="text-sm sm:text-base text-muted-foreground">No share links created yet</p>
                                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                        Create your first share link to collaborate with others
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            shares.map((share) => (
                                <Card key={share.id} className={!share.is_active ? "opacity-60" : ""}>
                                    <CardContent className="pt-4 pb-4">
                                        <div className="space-y-2 sm:space-y-3">
                                            <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-3">
                                                <div className="flex-1 min-w-0 w-full">
                                                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2 flex-wrap">
                                                        {getPermissionBadges(share)}
                                                        {!share.is_active && (
                                                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                                        )}
                                                    </div>
                                                    <code className="text-xs bg-muted px-2 py-1 rounded break-all block">
                                                        {window.location.origin}/shared/{share.share_token}
                                                    </code>
                                                    <p className="text-xs text-muted-foreground mt-1.5 sm:mt-2">
                                                        Created: {formatDate(share.created_at)}
                                                    </p>
                                                </div>

                                                <div className="flex gap-1 flex-shrink-0">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8"
                                                        onClick={() => handleCopyLink(share.share_token)}
                                                    >
                                                        {copied === share.share_token ? (
                                                            <Check className="w-3.5 h-3.5 text-success" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8"
                                                        onClick={() => window.open(`/shared/${share.share_token}`, '_blank')}
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8"
                                                        onClick={() => handleToggleShare(share.id, share.is_active)}
                                                    >
                                                        <Eye className={`w-3.5 h-3.5 ${share.is_active ? '' : 'opacity-50'}`} />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8"
                                                        onClick={() => handleDeleteShare(share.id)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </TabsContent>

                    <TabsContent value="access" className="space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
                                    <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                                    Access Statistics
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                    <div>
                                        <p className="text-lg sm:text-2xl font-bold">{uniqueAccessCount}</p>
                                        <p className="text-xs sm:text-sm text-muted-foreground">Unique viewers</p>
                                    </div>
                                    <div>
                                        <p className="text-lg sm:text-2xl font-bold">{accessLogs.length}</p>
                                        <p className="text-xs sm:text-sm text-muted-foreground">Total accesses</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {accessLogs.length === 0 ? (
                            <Card>
                                <CardContent className="pt-6 pb-6 text-center">
                                    <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                                    <p className="text-sm sm:text-base text-muted-foreground">No access logs yet</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {accessLogs.map((log) => (
                                    <Card key={log.id}>
                                        <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs sm:text-sm font-medium truncate">
                                                        {log.profile?.full_name || log.profile?.email || log.guest_identifier || 'Anonymous'}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatDate(log.accessed_at)}
                                                    </p>
                                                </div>
                                                <Badge variant="outline" className="text-xs flex-shrink-0">
                                                    <Eye className="w-3 h-3 mr-1" />
                                                    Viewed
                                                </Badge>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
