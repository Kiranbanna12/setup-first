// @ts-nocheck
import { useState, useEffect } from "react";
import { Users, Crown, UserMinus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMembersProps {
    projectId: string;
    currentUserId: string;
    projectCreatorId: string;
    onMemberRemoved?: () => void;
}

interface Member {
    id: string;
    user_id: string | null;
    guest_name: string | null;
    joined_at: string;
    is_active: boolean;
    user_name?: string;
    user_email?: string;
    role?: 'owner' | 'editor' | 'client' | 'shared';
}

export const ChatMembers = ({ projectId, currentUserId, projectCreatorId, onMemberRemoved }: ChatMembersProps) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [pendingRequests, setPendingRequests] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
    const isAdmin = currentUserId === projectCreatorId;

    useEffect(() => {
        if (open) {
            loadMembers();
        }
    }, [open, projectId]);

    // Realtime subscription for member changes
    useEffect(() => {
        // Subscribe to project_chat_members changes
        const membersChannel = supabase
            .channel(`chatmembers-${projectId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_chat_members',
                    filter: `project_id=eq.${projectId}`
                },
                async (payload) => {
                    // Reload members on any change
                    if (open) {
                        loadMembers();
                    }

                    // Show notifications for member changes
                    if (payload.eventType === 'UPDATE' && payload.new.is_active && payload.new.status === 'approved') {
                        // Member approved
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name, email')
                            .eq('id', payload.new.user_id)
                            .single();

                        const memberName = profile?.full_name || profile?.email || 'Someone';
                        toast.success(`${memberName} joined the chat`);
                    } else if (payload.eventType === 'DELETE') {
                        // Member removed
                        toast.info('A member was removed from the chat');
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(membersChannel);
        };
    }, [projectId, open]);

    const loadMembers = async () => {
        setLoading(true);
        try {
            const allMembers: Member[] = [];
            const pending: any[] = [];

            // 1. Get project details to find owner, editor, and client
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select('created_by, editor_id, client_id')
                .eq('id', projectId)
                .single();

            if (projectError) throw projectError;

            // 2. Add project owner
            if (project?.created_by) {
                const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, avatar_url')
                    .eq('id', project.created_by)
                    .single();

                if (ownerProfile) {
                    allMembers.push({
                        id: `owner-${ownerProfile.id}`,
                        user_id: ownerProfile.id,
                        guest_name: null,
                        joined_at: '',
                        is_active: true,
                        user_name: ownerProfile.full_name || ownerProfile.email || 'Project Owner',
                        user_email: ownerProfile.email,
                        role: 'owner'
                    });
                }
            }

            // 3. Add assigned editor
            if (project?.editor_id) {
                const { data: editor } = await supabase
                    .from('editors')
                    .select('id, user_id, full_name, email')
                    .eq('id', project.editor_id)
                    .single();

                if (editor) {
                    // Get full profile if user_id exists
                    let editorProfile = null;
                    if (editor.user_id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name, email, avatar_url')
                            .eq('id', editor.user_id)
                            .single();
                        editorProfile = profile;
                    }

                    // Avoid duplicate if editor is also owner
                    const isDuplicate = allMembers.some(m => m.user_id === editor.user_id);
                    if (!isDuplicate) {
                        allMembers.push({
                            id: `editor-${editor.id}`,
                            user_id: editor.user_id,
                            guest_name: null,
                            joined_at: '',
                            is_active: true,
                            user_name: editorProfile?.full_name || editor.full_name || editor.email || 'Editor',
                            user_email: editorProfile?.email || editor.email,
                            role: 'editor'
                        });
                    }
                }
            }

            // 4. Add assigned client
            if (project?.client_id) {
                const { data: client } = await supabase
                    .from('clients')
                    .select('id, user_id, full_name, email')
                    .eq('id', project.client_id)
                    .single();

                if (client) {
                    // Get full profile if user_id exists
                    let clientProfile = null;
                    if (client.user_id) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('full_name, email, avatar_url')
                            .eq('id', client.user_id)
                            .single();
                        clientProfile = profile;
                    }

                    // Avoid duplicate if client is also owner
                    const isDuplicate = allMembers.some(m => m.user_id === client.user_id);
                    if (!isDuplicate) {
                        allMembers.push({
                            id: `client-${client.id}`,
                            user_id: client.user_id,
                            guest_name: null,
                            joined_at: '',
                            is_active: true,
                            user_name: clientProfile?.full_name || client.full_name || client.email || 'Client',
                            user_email: clientProfile?.email || client.email,
                            role: 'client'
                        });
                    }
                }
            }

            // 5. Get shared members from project_chat_members table
            const { data: memberData, error: memberError } = await supabase
                .from('project_chat_members' as any)
                .select('*')
                .eq('project_id', projectId)
                .order('joined_at', { ascending: false });

            if (!memberError && memberData) {
                // Cast memberData to proper type
                const members = memberData as any[];
                for (const member of members) {
                    if (member.status === 'pending' || (!member.is_active && member.status !== 'approved')) {
                        // Pending request
                        let userName = "Unknown";
                        if (member.user_id) {
                            const { data: profile } = await supabase
                                .from('profiles')
                                .select('full_name, email')
                                .eq('id', member.user_id)
                                .single();
                            if (profile) {
                                userName = profile.full_name || profile.email || "Unknown";
                            }
                        }
                        pending.push({
                            id: member.id,
                            user_id: member.user_id,
                            guest_name: member.guest_name,
                            joined_at: member.joined_at || member.created_at,
                            is_active: member.is_active,
                            user_name: userName
                        });
                    } else if (member.is_active) {
                        // Active shared member - check for duplicates
                        const isDuplicate = allMembers.some(m => m.user_id === member.user_id);
                        if (!isDuplicate) {
                            let userName = member.guest_name || "Unknown";
                            let userEmail = "";

                            if (member.user_id) {
                                const { data: profile } = await supabase
                                    .from('profiles')
                                    .select('full_name, email')
                                    .eq('id', member.user_id)
                                    .single();
                                if (profile) {
                                    userName = profile.full_name || profile.email || "Unknown";
                                    userEmail = profile.email || "";
                                }
                            }

                            allMembers.push({
                                id: member.id,
                                user_id: member.user_id,
                                guest_name: member.guest_name,
                                joined_at: member.joined_at || member.created_at,
                                is_active: member.is_active,
                                user_name: userName,
                                user_email: userEmail,
                                role: 'shared'
                            });
                        }
                    }
                }
            }

            setMembers(allMembers);
            setPendingRequests(pending);
        } catch (error: any) {
            console.error("Failed to load members:", error);
            toast.error("Failed to load chat members");
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        try {
            const { error } = await supabase
                .from('project_chat_members' as any)
                .delete()
                .eq('id', memberId);

            if (error) throw error;

            toast.success("Member removed successfully");
            setMembers(members.filter(m => m.id !== memberId));
            setRemoveMemberId(null);

            if (onMemberRemoved) {
                onMemberRemoved();
            }
        } catch (error: any) {
            console.error("Failed to remove member:", error);
            toast.error(error.message || "Failed to remove member");
        }
    };

    const getMemberDisplayName = (member: Member) => {
        if (member.user_name) return member.user_name;
        if (member.guest_name) return member.guest_name;
        if (member.user_email) return member.user_email;
        return "Unknown User";
    };

    const getMemberInitials = (member: Member) => {
        const name = getMemberDisplayName(member);
        return name
            .split(" ")
            .map(n => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const isMemberAdmin = (member: Member) => {
        return member.user_id === projectCreatorId;
    };

    const formatJoinedDate = (dateString: string) => {
        if (!dateString) return "Recently";
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    return (
        <>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9">
                        <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                        {members.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                                {members.length}
                            </span>
                        )}
                    </Button>
                </SheetTrigger>
                <SheetContent className="w-[400px] sm:w-[540px]">
                    <SheetHeader>
                        <SheetTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Chat Members ({members.length})
                        </SheetTitle>
                        <SheetDescription>
                            {isAdmin ? "You can manage chat members" : "View all chat members"}
                        </SheetDescription>
                    </SheetHeader>

                    <ScrollArea className="h-[calc(100vh-120px)] mt-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Pending Requests Section - Only visible to admins */}
                                {isAdmin && pendingRequests.length > 0 && (
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                                            <Shield className="h-4 w-4" />
                                            Pending Requests ({pendingRequests.length})
                                        </h4>
                                        {pendingRequests.map((request) => (
                                            <div
                                                key={request.id}
                                                className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20"
                                            >
                                                <Avatar className="h-10 w-10">
                                                    <AvatarFallback className="bg-amber-500/20 text-amber-600 font-medium">
                                                        {getMemberInitials(request)}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">
                                                        {request.user_name || "Unknown User"}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Requested {formatJoinedDate(request.joined_at)}
                                                    </p>
                                                </div>

                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-8 w-8 p-0 border-red-300 hover:bg-red-50 hover:border-red-400"
                                                        onClick={async () => {
                                                            const { error } = await supabase
                                                                .from('project_chat_members' as any)
                                                                .delete()
                                                                .eq('id', request.id);
                                                            if (error) {
                                                                toast.error("Failed to reject request");
                                                            } else {
                                                                toast.success("Request rejected");
                                                                loadMembers();
                                                            }
                                                        }}
                                                    >
                                                        <UserMinus className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        className="h-8 w-8 p-0 bg-success hover:bg-success/80"
                                                        onClick={async () => {
                                                            const { error } = await supabase
                                                                .from('project_chat_members' as any)
                                                                .update({
                                                                    status: 'approved',
                                                                    is_active: true,
                                                                    updated_at: new Date().toISOString()
                                                                })
                                                                .eq('id', request.id);
                                                            if (error) {
                                                                toast.error("Failed to approve request");
                                                            } else {
                                                                toast.success("Request approved");
                                                                loadMembers();
                                                            }
                                                        }}
                                                    >
                                                        <Crown className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Active Members Section */}
                                {members.length === 0 && pendingRequests.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No members yet
                                    </div>
                                ) : members.length > 0 && (
                                    <div className="space-y-2">
                                        {members.map((member) => (
                                            <div
                                                key={member.id}
                                                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                                            >
                                                <Avatar className="h-10 w-10">
                                                    <AvatarFallback className={`font-medium ${member.role === 'owner' ? 'bg-yellow-500/20 text-yellow-600' :
                                                        member.role === 'editor' ? 'bg-primary/20 text-primary' :
                                                            member.role === 'client' ? 'bg-success/20 text-success' :
                                                                'bg-primary/10 text-primary'
                                                        }`}>
                                                        {getMemberInitials(member)}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className="font-medium truncate">
                                                            {getMemberDisplayName(member)}
                                                        </p>
                                                        {/* Role Badge */}
                                                        {member.role === 'owner' && (
                                                            <Badge variant="default" className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                                                <Crown className="h-3 w-3" />
                                                                Owner
                                                            </Badge>
                                                        )}
                                                        {member.role === 'editor' && (
                                                            <Badge variant="default" className="gap-1 bg-primary/10 text-primary border-primary/20">
                                                                Editor
                                                            </Badge>
                                                        )}
                                                        {member.role === 'client' && (
                                                            <Badge variant="default" className="gap-1 bg-success/10 text-success border-success/20">
                                                                Client
                                                            </Badge>
                                                        )}
                                                        {member.role === 'shared' && (
                                                            <Badge variant="outline" className="gap-1 text-muted-foreground">
                                                                Shared
                                                            </Badge>
                                                        )}
                                                        {member.user_id === currentUserId && (
                                                            <Badge variant="outline" className="gap-1 bg-primary/10">
                                                                You
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground truncate">
                                                        {member.role === 'owner' ? 'Project Owner' :
                                                            member.role === 'editor' ? 'Assigned Editor' :
                                                                member.role === 'client' ? 'Assigned Client' :
                                                                    member.joined_at ? `Joined ${formatJoinedDate(member.joined_at)}` : 'Member'}
                                                    </p>
                                                </div>

                                                {/* Only show remove button for shared members */}
                                                {isAdmin && member.role === 'shared' && member.user_id !== currentUserId && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => setRemoveMemberId(member.id)}
                                                    >
                                                        <UserMinus className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {isAdmin && (
                        <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <div className="flex items-start gap-2">
                                <Shield className="h-4 w-4 text-yellow-600 mt-0.5" />
                                <div className="text-sm text-yellow-700">
                                    <p className="font-medium">Admin Privileges</p>
                                    <p className="text-xs text-yellow-600 mt-1">
                                        You can manage chat members and approve join requests
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Remove Member Confirmation Dialog */}
            <AlertDialog open={!!removeMemberId} onOpenChange={(open) => !open && setRemoveMemberId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This member will be removed from the chat and won't be able to send or view messages.
                            They can rejoin if they have access to the share link.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => removeMemberId && handleRemoveMember(removeMemberId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
