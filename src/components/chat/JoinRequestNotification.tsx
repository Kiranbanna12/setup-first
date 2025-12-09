/**
 * Join Request Notification Component
 * Shows pending join requests for project owners/members to approve or reject
 * Note: The chat_join_requests table needs to be created for full functionality.
 * For now, this component is ready but the backend table may not exist yet.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface JoinRequest {
    id: string;
    user_id: string;
    user_name?: string;
    user_avatar?: string;
    created_at: string;
}

interface JoinRequestNotificationProps {
    request: JoinRequest;
    projectId: string;
    onRequestProcessed: () => void;
}

export const JoinRequestNotification = ({
    request,
    projectId,
    onRequestProcessed
}: JoinRequestNotificationProps) => {
    const [processing, setProcessing] = useState<'approve' | 'reject' | null>(null);

    const handleApprove = async () => {
        setProcessing('approve');
        try {
            // Use RPC to approve (bypasses RLS with internal authorization)
            const { data, error } = await (supabase.rpc as any)('approve_chat_join_request', {
                request_id: request.id,
                project_id_input: projectId
            });

            if (error) throw error;

            if (data && !data.success) {
                throw new Error(data.error || 'Failed to approve request');
            }

            toast.success(`${request.user_name || 'User'} approved to join chat`);
            onRequestProcessed();
        } catch (error: any) {
            console.error('Failed to approve request:', error);
            toast.error(error.message || 'Failed to approve request');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async () => {
        setProcessing('reject');
        try {
            // Use RPC to reject (bypasses RLS with internal authorization)
            const { data, error } = await (supabase.rpc as any)('reject_chat_join_request', {
                request_id: request.id,
                project_id_input: projectId
            });

            if (error) throw error;

            if (data && !data.success) {
                throw new Error(data.error || 'Failed to reject request');
            }

            toast.success(`Request from ${request.user_name || 'User'} rejected`);
            onRequestProcessed();
        } catch (error: any) {
            console.error('Failed to reject request:', error);
            toast.error(error.message || 'Failed to reject request');
        } finally {
            setProcessing(null);
        }
    };

    const getUserInitials = () => {
        if (request.user_name) {
            const words = request.user_name.split(' ');
            if (words.length >= 2) {
                return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
            }
            return request.user_name.charAt(0).toUpperCase();
        }
        return 'U';
    };

    return (
        <div className="bg-white dark:bg-slate-800 border-2 border-success dark:border-success rounded-xl p-4 mb-3 shadow-xl z-10 relative">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <Avatar className="h-11 w-11 flex-shrink-0 ring-2 ring-primary/30">
                        <AvatarImage src={request.user_avatar} />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                            {getUserInitials()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                        <span className="text-[8px] text-white font-bold">!</span>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">
                        {request.user_name || 'Unknown User'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Wants to join this chat
                    </p>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-9 w-9 p-0 border-destructive/50 hover:bg-destructive/10 hover:border-destructive rounded-full"
                        onClick={handleReject}
                        disabled={processing !== null}
                        title="Reject request"
                    >
                        {processing === 'reject' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <X className="h-4 w-4 text-destructive" />
                        )}
                    </Button>
                    <Button
                        size="sm"
                        className="h-9 w-9 p-0 bg-success hover:bg-success/80 rounded-full"
                        onClick={handleApprove}
                        disabled={processing !== null}
                        title="Approve request"
                    >
                        {processing === 'approve' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                        ) : (
                            <Check className="h-4 w-4 text-white" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
