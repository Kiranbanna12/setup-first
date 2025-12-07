// @ts-nocheck
/**
 * useChatRealtime Hook
 * Centralized hook for managing all chat-related realtime subscriptions
 * Provides realtime updates for messages, members, and notifications
 */
import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseChatRealtimeOptions {
    currentUserId: string;
    // Callback when any message changes (for ChatList updates)
    onMessageChange?: (payload: any) => void;
    // Callback when member status changes
    onMemberChange?: (payload: any) => void;
    // Whether to show notifications for new messages
    showNotifications?: boolean;
    // Current active project ID (to avoid notifications for current chat)
    activeProjectId?: string | null;
}

interface UseChatRealtimeReturn {
    isConnected: boolean;
}

export const useChatRealtime = ({
    currentUserId,
    onMessageChange,
    onMemberChange,
    showNotifications = true,
    activeProjectId = null,
}: UseChatRealtimeOptions): UseChatRealtimeReturn => {
    const isConnectedRef = useRef(false);
    const channelRef = useRef<any>(null);
    const memberChannelRef = useRef<any>(null);

    // Play notification sound for messages outside active chat
    const playNotificationSound = useCallback(() => {
        try {
            const audio = new Audio('/assets/sound-effects/message.mp3');
            audio.volume = 0.6;
            audio.play().catch(() => {
                // Silently fail if audio can't play (e.g., user hasn't interacted with page yet)
            });
        } catch (error) {
            // Audio not supported
            console.debug('Notification sound not available');
        }
    }, []);

    // Show browser notification
    const showBrowserNotification = useCallback((title: string, body: string) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' });
        }
    }, []);

    useEffect(() => {
        if (!currentUserId) return;

        // Request notification permission on mount
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }

        // Subscribe to all messages for the user's accessible projects
        const messagesChannel = supabase
            .channel('global-messages-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages'
                },
                async (payload) => {
                    // Call the callback for any message change
                    if (onMessageChange) {
                        onMessageChange(payload);
                    }

                    // Handle notifications for new messages
                    if (payload.eventType === 'INSERT' && showNotifications) {
                        const newMessage = payload.new;

                        // Don't notify for own messages or messages in active chat
                        if (newMessage.sender_id !== currentUserId && newMessage.project_id !== activeProjectId) {
                            // Fetch sender profile
                            const { data: senderProfile } = await supabase
                                .from('profiles')
                                .select('full_name, email')
                                .eq('id', newMessage.sender_id)
                                .single();

                            const senderName = senderProfile?.full_name || senderProfile?.email || 'Someone';
                            const messagePreview = newMessage.content?.substring(0, 50) + (newMessage.content?.length > 50 ? '...' : '');

                            // Show toast notification
                            toast.info(`${senderName}: ${messagePreview}`, {
                                duration: 4000,
                                action: {
                                    label: 'View',
                                    onClick: () => {
                                        // Navigate to chat
                                        window.location.href = `/chat?project=${newMessage.project_id}`;
                                    }
                                }
                            });

                            // Play sound
                            playNotificationSound();

                            // Browser notification if tab is not focused
                            if (document.visibilityState === 'hidden') {
                                showBrowserNotification(`New message from ${senderName}`, messagePreview);
                            }
                        }
                    }
                }
            )
            .subscribe((status) => {
                isConnectedRef.current = status === 'SUBSCRIBED';
            });

        channelRef.current = messagesChannel;

        // Subscribe to member changes
        const memberChannel = supabase
            .channel('global-members-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'project_chat_members'
                },
                (payload) => {
                    if (onMemberChange) {
                        onMemberChange(payload);
                    }
                }
            )
            .subscribe();

        memberChannelRef.current = memberChannel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
            if (memberChannelRef.current) {
                supabase.removeChannel(memberChannelRef.current);
            }
        };
    }, [currentUserId, activeProjectId, onMessageChange, onMemberChange, showNotifications, playNotificationSound, showBrowserNotification]);

    return {
        isConnected: isConnectedRef.current,
    };
};
