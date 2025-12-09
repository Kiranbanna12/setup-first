/**
 * Message Info Dialog Component
 * Shows message delivery and read information
 */

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Check, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface MessageInfoDialogProps {
    messageId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

interface ReadInfo {
    user_id: string;
    user_name: string;
    user_avatar?: string;
    read_at?: string;
    delivered_at?: string;
}

export const MessageInfoDialog = ({ messageId, open, onOpenChange }: MessageInfoDialogProps) => {
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<any>(null);
    const [readInfo, setReadInfo] = useState<ReadInfo[]>([]);

    useEffect(() => {
        if (open && messageId) {
            loadMessageInfo();
        }
    }, [open, messageId]);

    const loadMessageInfo = async () => {
        setLoading(true);
        try {
            // Get message details - use 'as any' to handle missing type definitions
            const { data: messageData } = await supabase
                .from('messages')
                .select('*')
                .eq('id', messageId)
                .single();

            if (messageData) {
                setMessage(messageData);

                // Get read_by and delivered_to user info (these fields may not exist in all schemas)
                const msgAny = messageData as any;
                const readBy = msgAny.read_by || [];
                const deliveredTo = msgAny.delivered_to || [];
                const allUserIds = [...new Set([...readBy, ...deliveredTo])];

                if (allUserIds.length > 0) {
                    const { data: profiles } = await supabase
                        .from('profiles')
                        .select('id, full_name, email, avatar_url')
                        .in('id', allUserIds);

                    const info: ReadInfo[] = (profiles || []).map(profile => ({
                        user_id: profile.id,
                        user_name: profile.full_name || profile.email || 'Unknown',
                        user_avatar: profile.avatar_url,
                        read_at: readBy.includes(profile.id) ? msgAny.updated_at : undefined,
                        delivered_at: deliveredTo.includes(profile.id) ? messageData.created_at : undefined
                    }));

                    setReadInfo(info);
                } else {
                    setReadInfo([]);
                }
            }
        } catch (error) {
            console.error('Failed to load message info:', error);
        } finally {
            setLoading(false);
        }
    };

    const getUserInitials = (name: string) => {
        const words = name.split(' ');
        if (words.length >= 2) {
            return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
        }
        return name.charAt(0).toUpperCase();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Message Info</DialogTitle>
                    <DialogDescription>Read receipts and delivery status</DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Message Preview */}
                        {message && (
                            <div className="bg-muted p-3 rounded-lg">
                                <p className="text-sm line-clamp-3">{message.content}</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {format(new Date(message.created_at), 'PPp')}
                                </p>
                            </div>
                        )}

                        {/* Read By Section */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCheck className="h-4 w-4 text-[#53BDEB]" />
                                <span className="text-sm font-medium">Read by</span>
                            </div>
                            {readInfo.filter(r => r.read_at).length > 0 ? (
                                <div className="space-y-2">
                                    {readInfo.filter(r => r.read_at).map(info => (
                                        <div key={info.user_id} className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={info.user_avatar} />
                                                <AvatarFallback>{getUserInitials(info.user_name)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm truncate">{info.user_name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">No one yet</p>
                            )}
                        </div>

                        {/* Delivered To Section */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCheck className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium">Delivered to</span>
                            </div>
                            {readInfo.filter(r => r.delivered_at && !r.read_at).length > 0 ? (
                                <div className="space-y-2">
                                    {readInfo.filter(r => r.delivered_at && !r.read_at).map(info => (
                                        <div key={info.user_id} className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={info.user_avatar} />
                                                <AvatarFallback>{getUserInitials(info.user_name)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm truncate">{info.user_name}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {readInfo.filter(r => r.read_at).length > 0 ? 'All read' : 'No one yet'}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
