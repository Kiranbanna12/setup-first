import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatJoinDialogProps {
    projectId: string;
    projectName: string;
    shareId?: string;
    onJoinSuccess: () => void;
}

export const ChatJoinDialog = ({
    projectId,
    projectName,
    shareId,
    onJoinSuccess,
}: ChatJoinDialogProps) => {
    const [open, setOpen] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleJoin = async () => {
        setLoading(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const currentUser = sessionData?.session?.user;

            if (!currentUser) {
                toast.error("Please login to join the chat");
                return;
            }

            // Check if already a member
            const { data: existingMember } = await (supabase as any)
                .from('chat_members')
                .select('id')
                .eq('project_id', projectId)
                .eq('user_id', currentUser.id)
                .maybeSingle();

            if (existingMember) {
                toast.info("You are already a member of this chat");
                setOpen(false);
                onJoinSuccess();
                return;
            }

            // Send join request
            const { error } = await (supabase as any)
                .from('chat_members')
                .insert({
                    project_id: projectId,
                    user_id: currentUser.id,
                    role: 'member',
                    status: 'pending'
                });

            if (error) throw error;

            toast.success("Join request sent!");
            setOpen(false);
            onJoinSuccess();

        } catch (error: any) {
            console.error("Error joining chat:", error);
            toast.error(error.message || "Failed to join chat");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        Join Project Chat
                    </DialogTitle>
                    <DialogDescription>
                        Join the conversation for <strong>{projectName}</strong>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex items-center gap-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <UserPlus className="w-5 h-5 text-primary" />
                        <div className="flex-1">
                            <p className="text-sm font-medium">Ready to collaborate?</p>
                            <p className="text-xs text-muted-foreground">
                                Request access to discuss this project with the team
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button onClick={handleJoin} disabled={loading} className="gradient-primary">
                        {loading ? "Sending Request..." : "Request to Join"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
