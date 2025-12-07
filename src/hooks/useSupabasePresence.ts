// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PresenceUser {
    user_id: string;
    full_name?: string;
    email?: string;
    is_typing?: boolean;
    online_at?: string;
}

interface UseSupabasePresenceOptions {
    channelName: string;
    currentUserId: string;
    userInfo?: {
        full_name?: string;
        email?: string;
    };
}

export const useSupabasePresence = ({
    channelName,
    currentUserId,
    userInfo
}: UseSupabasePresenceOptions) => {
    const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
    const [typingUsers, setTypingUsers] = useState<PresenceUser[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const channelRef = useRef<any>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!channelName || !currentUserId) return;

        // Create a presence channel
        const channel = supabase.channel(`presence-${channelName}`, {
            config: {
                presence: {
                    key: currentUserId,
                },
            },
        });

        channelRef.current = channel;

        // Handle presence sync (initial state and updates)
        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const users: PresenceUser[] = [];
            const typing: PresenceUser[] = [];

            Object.entries(state).forEach(([userId, presences]: [string, any[]]) => {
                if (presences && presences.length > 0) {
                    const latestPresence = presences[presences.length - 1];
                    const user: PresenceUser = {
                        user_id: userId,
                        full_name: latestPresence.full_name,
                        email: latestPresence.email,
                        is_typing: latestPresence.is_typing,
                        online_at: latestPresence.online_at,
                    };
                    users.push(user);

                    // Don't show current user in typing list
                    if (latestPresence.is_typing && userId !== currentUserId) {
                        typing.push(user);
                    }
                }
            });

            setOnlineUsers(users);
            setTypingUsers(typing);
        });

        // Handle user join (silently)
        channel.on('presence', { event: 'join' }, () => {
            // Presence sync handles state updates
        });

        // Handle user leave (silently)
        channel.on('presence', { event: 'leave' }, () => {
            // Presence sync handles state updates
        });

        // Subscribe and track presence
        channel
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    setIsConnected(true);
                    // Track this user's presence
                    await channel.track({
                        user_id: currentUserId,
                        full_name: userInfo?.full_name || '',
                        email: userInfo?.email || '',
                        is_typing: false,
                        online_at: new Date().toISOString(),
                    });
                } else {
                    setIsConnected(false);
                }
            });

        return () => {
            if (channelRef.current) {
                channelRef.current.untrack();
                supabase.removeChannel(channelRef.current);
            }
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, [channelName, currentUserId, userInfo?.full_name, userInfo?.email]);

    // Send typing indicator
    const sendTypingIndicator = useCallback(async (isTyping: boolean) => {
        if (!channelRef.current) return;

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        // Update presence with typing status
        await channelRef.current.track({
            user_id: currentUserId,
            full_name: userInfo?.full_name || '',
            email: userInfo?.email || '',
            is_typing: isTyping,
            online_at: new Date().toISOString(),
        });

        // Auto-stop typing after 3 seconds
        if (isTyping) {
            typingTimeoutRef.current = setTimeout(async () => {
                if (channelRef.current) {
                    await channelRef.current.track({
                        user_id: currentUserId,
                        full_name: userInfo?.full_name || '',
                        email: userInfo?.email || '',
                        is_typing: false,
                        online_at: new Date().toISOString(),
                    });
                }
            }, 3000);
        }
    }, [currentUserId, userInfo?.full_name, userInfo?.email]);

    return {
        onlineUsers,
        typingUsers,
        isConnected,
        sendTypingIndicator,
        onlineCount: onlineUsers.length,
    };
};
