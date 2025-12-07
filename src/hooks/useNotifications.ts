import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Notification, notificationService } from '@/lib/notifications';
import { useToast } from '@/hooks/use-toast';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadNotifications = async () => {
    const { data } = await notificationService.getNotifications(50, 0);
    setNotifications(data as Notification[]);
    setLoading(false);
  };

  const updateUnreadCount = async () => {
    const count = await notificationService.getUnreadCount();
    setUnreadCount(count);
  };

  useEffect(() => {
    loadNotifications();
    updateUnreadCount();

    // Subscribe to real-time notifications
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;

      console.log('Setting up notifications realtime for user:', data.user.id);

      const channel = supabase
        .channel('notifications-' + data.user.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: 'user_id=eq.' + data.user.id,
          },
          (payload) => {
            console.log('🔔 New notification received via realtime:', payload);
            const newNotification = payload.new as Notification;
            setNotifications((prev) => [newNotification, ...prev]);
            setUnreadCount((prev) => prev + 1);

            // Play notification sound based on type
            let soundFile = '/assets/sound-effects/project-assign.mp3';
            if (newNotification.type === 'project_approved') {
              soundFile = '/assets/sound-effects/project-approve.mp3';
            } else if (newNotification.type === 'deadline_approaching' || newNotification.type === 'deadline_overdue') {
              soundFile = '/assets/sound-effects/deadline.mp3';
            }

            console.log('🔊 Attempting to play sound:', soundFile, 'for type:', newNotification.type);
            try {
              const audio = new Audio(soundFile);
              audio.volume = 0.6;
              audio.play()
                .then(() => console.log('✅ Sound played successfully!'))
                .catch((err) => console.log('❌ Sound failed:', err?.message || err));
            } catch (e) {
              console.log('❌ Audio error:', e);
            }

            // Always show toast for project notifications
            toast({
              title: newNotification.title,
              description: newNotification.message,
              variant: newNotification.priority === 'critical' ? 'destructive' : 'default',
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: 'user_id=eq.' + data.user.id,
          },
          (payload) => {
            const updatedNotification = payload.new as Notification;
            const oldNotification = payload.old as Notification;

            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
            );

            // If the notification was just marked as read, decrement unread count immediately
            if (!oldNotification.read && updatedNotification.read) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
            }
            // If notification was unmarked as read (edge case), increment
            else if (oldNotification.read && !updatedNotification.read) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
          },
          (payload) => {
            setNotifications((prev) => prev.filter((n) => n.id !== payload.old.id));
            updateUnreadCount();
          }
        )
        .subscribe((status) => {
          console.log('Notifications channel subscription status:', status);
        });

      return () => {
        supabase.removeChannel(channel);
      };
    });
  }, []);

  const markAsRead = async (notificationId: string) => {
    const success = await notificationService.markAsRead(notificationId);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    const success = await notificationService.markAllAsRead();
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    const success = await notificationService.delete(notificationId);
    if (success) {
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      updateUnreadCount();
    }
  };

  const deleteAll = async () => {
    const success = await notificationService.deleteAll();
    if (success) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAll,
    refresh: loadNotifications,
  };
}
