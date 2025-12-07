import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | 'project_created'
  | 'project_assigned'
  | 'project_status_changed'
  | 'version_added'
  | 'deadline_approaching'
  | 'deadline_overdue'
  | 'feedback_added'
  | 'feedback_replied'
  | 'correction_requested'
  | 'project_approved'
  | 'project_rejected'
  | 'invoice_generated'
  | 'invoice_due'
  | 'invoice_overdue'
  | 'payment_received'
  | 'payment_failed'
  | 'chat_message'
  | 'subscription_expiring'
  | 'subscription_renewed'
  | 'system_alert'
  | 'user_mentioned';

export type NotificationPriority = 'info' | 'important' | 'critical';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  link?: string | null;
  metadata?: any;
  read: boolean;
  created_at: string;
  read_at?: string | null;
  expires_at?: string | null;
}

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  link?: string;
  metadata?: Record<string, any>;
  expiresInDays?: number;
  emailTemplate?: string;
  emailVariables?: Record<string, string>;
}

// ...

// Type-safe wrapper for notifications table (not in generated types)
const notificationsTable = () => (supabase as any).from('notifications');

export const notificationService = {
  /**
   * Create a new notification for a user (In-App and Email)
   */
  async create(params: CreateNotificationParams): Promise<Notification | null> {
    console.log('Creating notification for user:', params.userId, 'type:', params.type);

    const expiresAt = params.expiresInDays
      ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    // Try RPC first
    const { error: rpcError } = await (supabase as any).rpc('create_notification', {
      recipient_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link,
      metadata: params.metadata || {},
      priority: params.priority || 'info'
    });

    if (rpcError) {
      console.error('RPC create_notification failed:', rpcError);

      // Fallback: Direct insert into notifications table
      console.log('Attempting direct insert fallback...');
      const { error: insertError } = await notificationsTable().insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        metadata: params.metadata || {},
        priority: params.priority || 'info',
        read: false,
        created_at: new Date().toISOString()
      });

      if (insertError) {
        console.error('Direct insert also failed:', insertError);
      } else {
        console.log('Notification created via direct insert');
      }
    } else {
      console.log('Notification created successfully via RPC');
    }

    // 2. Email Notification (via Edge Function)
    if (params.emailTemplate) {
      // Fire and forget - don't await to avoid blocking UI
      supabase.functions.invoke('send-notification-email', {
        body: {
          recipientId: params.userId,
          templateName: params.emailTemplate,
          variables: params.emailVariables || {},
          priority: params.priority === 'critical' ? 'high' : 'normal'
        }
      }).then(({ error }) => {
        if (error) console.error('Error sending email notification:', error);
      });
    }

    return null;
  },

  /**
   * Create notifications for multiple users
   */
  async createBulk(userIds: string[], params: Omit<CreateNotificationParams, 'userId'>): Promise<boolean> {
    console.log('createBulk called for users:', userIds);
    // Process in parallel
    const promises = userIds.map(userId => this.create({ ...params, userId }));
    await Promise.all(promises);
    console.log('createBulk completed');
    return true;
  },

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const { error } = await notificationsTable()
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }

    return true;
  },

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await notificationsTable()
      .update({
        read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }

    return true;
  },

  /**
   * Delete a notification
   */
  async delete(notificationId: string): Promise<boolean> {
    const { error } = await notificationsTable()
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      return false;
    }

    return true;
  },

  /**
   * Delete all notifications for current user
   */
  async deleteAll(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await notificationsTable()
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting all notifications:', error);
      return false;
    }

    return true;
  },

  /**
   * Get unread count for current user
   */
  async getUnreadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await notificationsTable()
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Get user's notifications with pagination
   */
  async getNotifications(limit: number = 50, offset: number = 0) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: [], count: 0 };

    const { data, error, count } = await notificationsTable()
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching notifications:', error);
      return { data: [], count: 0 };
    }

    return { data: data || [], count: count || 0 };
  },
};
