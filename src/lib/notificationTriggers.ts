import { notificationService } from "./notifications";
import { supabase } from "@/integrations/supabase/client";

/**
 * Notification triggers for various app events
 * Call these functions whenever the corresponding event occurs
 */

/**
 * Helper: Get all project members (owner, editor, client, shared members)
 * Uses RPC to bypass RLS restrictions
 */
async function getProjectMembers(projectId: string): Promise<string[]> {
  try {
    console.log('Getting project members for:', projectId);

    // Use RPC to bypass RLS and get all members
    const { data, error } = await (supabase as any).rpc('get_project_members', {
      p_project_id: projectId
    });

    if (error) {
      console.error('RPC get_project_members failed:', error);
      return [];
    }

    // Extract user_ids from result
    const memberIds = (data || []).map((row: { user_id: string }) => row.user_id);
    console.log('Members found via RPC:', memberIds);

    return memberIds;
  } catch (error) {
    console.error('Error getting project members:', error);
    return [];
  }
}

export const notificationTriggers = {
  /**
   * Trigger when someone is added as editor or client
   */
  async editorClientAdded(params: {
    recipientId: string;
    inviterName: string;
    role: 'editor' | 'client';
  }) {
    await notificationService.create({
      userId: params.recipientId,
      type: 'project_assigned',
      title: `You've been added as ${params.role === 'editor' ? 'an Editor' : 'a Client'}`,
      message: `${params.inviterName} has added you as ${params.role === 'editor' ? 'an editor' : 'a client'}. You can now collaborate on projects.`,
      priority: 'important',
      link: params.role === 'editor' ? '/projects' : '/projects',
      metadata: { role: params.role },
    });
  },

  /**
   * Trigger when a project is assigned to someone
   */
  async projectAssigned(params: {
    recipientId: string;
    projectId: string;
    projectName: string;
    assignerName: string;
    role: 'editor' | 'client';
  }) {
    await notificationService.create({
      userId: params.recipientId,
      type: 'project_assigned',
      title: `New Project Assigned`,
      message: `${params.assignerName} assigned you to project "${params.projectName}" as ${params.role}.`,
      priority: 'important',
      link: `/project-details/${params.projectId}`,
      metadata: { projectId: params.projectId, role: params.role },
    });
  },

  /**
   * Trigger when a new project is created
   */
  async projectCreated(params: {
    editorId: string;
    clientId?: string;
    projectName: string;
    projectId: string;
  }) {
    // Notify the editor
    await notificationService.create({
      userId: params.editorId,
      type: 'project_created',
      title: 'New Project Created',
      message: `Project "${params.projectName}" has been created successfully.`,
      priority: 'info',
      link: `/project-details/${params.projectId}`,
      metadata: { projectId: params.projectId },
      emailTemplate: 'project-created',
      emailVariables: {
        projectName: params.projectName,
        link: `${window.location.origin}/project-details/${params.projectId}`,
      },
    });

    // Notify the client if assigned
    if (params.clientId) {
      await notificationService.create({
        userId: params.clientId,
        type: 'project_assigned',
        title: 'New Project Assigned',
        message: `You've been assigned to project "${params.projectName}".`,
        priority: 'important',
        link: `/project-details/${params.projectId}`,
        metadata: { projectId: params.projectId },
        emailTemplate: 'project-assigned',
        emailVariables: {
          projectName: params.projectName,
          link: `${window.location.origin}/project-details/${params.projectId}`,
        },
      });
    }
  },

  /**
   * Trigger when a project status changes
   */
  async projectStatusChanged(params: {
    projectId: string;
    projectName: string;
    oldStatus: string;
    newStatus: string;
    editorId: string;
    clientId?: string;
  }) {
    const userIds = [params.editorId];
    if (params.clientId) userIds.push(params.clientId);

    await notificationService.createBulk(userIds, {
      type: 'project_status_changed',
      title: 'Project Status Updated',
      message: `Project "${params.projectName}" status changed from ${params.oldStatus} to ${params.newStatus}.`,
      priority: 'info',
      link: `/project-details/${params.projectId}`,
      metadata: { projectId: params.projectId, oldStatus: params.oldStatus, newStatus: params.newStatus },
      emailTemplate: 'project-status-changed',
      emailVariables: {
        projectName: params.projectName,
        newStatus: params.newStatus,
        link: `${window.location.origin}/project-details/${params.projectId}`,
      },
    });
  },

  /**
   * Trigger when a new version is added
   */
  async versionAdded(params: {
    projectId: string;
    projectName: string;
    versionNumber: number;
    uploaderId: string;
  }) {
    console.log('versionAdded trigger called:', params);

    // Get all project members
    const memberIds = await getProjectMembers(params.projectId);
    console.log('Members found:', memberIds);
    console.log('Uploader to exclude:', params.uploaderId);

    // Notify all members except the uploader
    const recipientIds = memberIds.filter(id => id !== params.uploaderId);
    console.log('Recipients after filtering:', recipientIds);

    if (recipientIds.length > 0) {
      console.log('Sending notifications to:', recipientIds);
      await notificationService.createBulk(recipientIds, {
        type: 'version_added',
        title: 'New Version Added',
        message: `Version ${params.versionNumber} has been added to "${params.projectName}".`,
        priority: 'important',
        link: `/project-details/${params.projectId}`,
        metadata: { projectId: params.projectId, versionNumber: params.versionNumber },
      });
    }
  },

  /**
   * Trigger when feedback is added
   */
  async feedbackAdded(params: {
    projectId: string;
    projectName: string;
    feedbackAuthorId: string;
    feedbackContent: string;
  }) {
    // Get all project members
    const memberIds = await getProjectMembers(params.projectId);

    // Notify all members except the feedback author
    const recipientIds = memberIds.filter(id => id !== params.feedbackAuthorId);

    if (recipientIds.length > 0) {
      await notificationService.createBulk(recipientIds, {
        type: 'feedback_added',
        title: 'New Feedback Added',
        message: `New feedback on "${params.projectName}": ${params.feedbackContent.substring(0, 80)}...`,
        priority: 'important',
        link: `/project-details/${params.projectId}`,
        metadata: { projectId: params.projectId },
      });
    }
  },

  /**
   * Trigger when corrections are requested
   */
  async correctionRequested(params: {
    projectId: string;
    projectName: string;
    editorId: string;
    clientId: string;
    correctionNotes: string;
  }) {
    await notificationService.create({
      userId: params.editorId,
      type: 'correction_requested',
      title: 'Corrections Requested',
      message: `Client requested corrections for "${params.projectName}".`,
      priority: 'important',
      link: `/project-details/${params.projectId}`,
      metadata: { projectId: params.projectId, notes: params.correctionNotes },
      emailTemplate: 'correction-requested',
      emailVariables: {
        projectName: params.projectName,
        link: `${window.location.origin}/project-details/${params.projectId}`,
      },
    });
  },

  /**
   * Trigger when project is approved
   */
  async projectApproved(params: {
    projectId: string;
    projectName: string;
    approverId: string;
  }) {
    console.log('🎉 projectApproved trigger called:', params);

    // Get all project members
    const memberIds = await getProjectMembers(params.projectId);
    console.log('Project members found:', memberIds);
    console.log('Approver to exclude:', params.approverId);

    // Notify all members except the approver
    const recipientIds = memberIds.filter(id => id !== params.approverId);
    console.log('Recipients after filtering:', recipientIds);

    if (recipientIds.length > 0) {
      console.log('Sending approval notifications to:', recipientIds);
      await notificationService.createBulk(recipientIds, {
        type: 'project_approved',
        title: 'Project Approved! 🎉',
        message: `Project "${params.projectName}" has been approved.`,
        priority: 'important',
        link: `/project-details/${params.projectId}`,
        metadata: { projectId: params.projectId },
      });
      console.log('Approval notifications sent!');
    } else {
      console.log('No recipients to notify (all filtered out)');
    }
  },

  /**
   * Trigger when invoice is generated
   */
  async invoiceGenerated(params: {
    invoiceId: string;
    amount: number;
    recipientId: string;
    projectName?: string;
  }) {
    await notificationService.create({
      userId: params.recipientId,
      type: 'invoice_generated',
      title: 'New Invoice Generated',
      message: `An invoice for $${params.amount} has been generated${params.projectName ? ` for "${params.projectName}"` : ''}.`,
      priority: 'important',
      link: `/invoices`,
      metadata: { invoiceId: params.invoiceId, amount: params.amount },
      emailTemplate: 'invoice-generated',
      emailVariables: {
        amount: params.amount.toString(),
        link: `${window.location.origin}/invoices`,
      },
    });
  },

  /**
   * Trigger when invoice is due soon
   */
  async invoiceDue(params: {
    invoiceId: string;
    amount: number;
    dueDate: string;
    recipientId: string;
    projectName?: string; // Added optional project name
  }) {
    await notificationService.create({
      userId: params.recipientId,
      type: 'invoice_due',
      title: 'Invoice Due Soon',
      message: `Invoice for $${params.amount} is due on ${new Date(params.dueDate).toLocaleDateString()}.`,
      priority: 'important',
      link: `/invoices`,
      metadata: { invoiceId: params.invoiceId },
      expiresInDays: 7,
      emailTemplate: 'invoice-due',
      emailVariables: {
        amount: params.amount.toString(),
        link: `${window.location.origin}/invoices`,
      },
    });
  },

  /**
   * Trigger when payment is received
   */
  async paymentReceived(params: {
    paymentId: string;
    amount: number;
    recipientId: string;
    projectName?: string;
  }) {
    await notificationService.create({
      userId: params.recipientId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `Payment of $${params.amount} received${params.projectName ? ` for "${params.projectName}"` : ''}.`,
      priority: 'important',
      link: `/invoices`,
      metadata: { paymentId: params.paymentId, amount: params.amount },
      emailTemplate: 'payment-received',
      emailVariables: {
        amount: params.amount.toString(),
        link: `${window.location.origin}/invoices`,
      },
    });
  },

  /**
   * Trigger when chat message is received
   */
  async chatMessage(params: {
    senderId: string;
    recipientId: string;
    senderName: string;
    messagePreview: string;
    projectId?: string;
  }) {
    if (params.senderId === params.recipientId) return;

    await notificationService.create({
      userId: params.recipientId,
      type: 'chat_message',
      title: 'New Message',
      message: `${params.senderName}: ${params.messagePreview.substring(0, 100)}...`,
      priority: 'info',
      link: params.projectId ? `/project-details/${params.projectId}` : '/chat',
      metadata: { senderId: params.senderId, projectId: params.projectId },
      emailTemplate: 'chat-message',
      emailVariables: {
        senderName: params.senderName,
        messagePreview: params.messagePreview.substring(0, 50) + '...',
        link: params.projectId
          ? `${window.location.origin}/project-details/${params.projectId}`
          : `${window.location.origin}/chat`,
      },
    });
  },

  /**
   * Trigger when deadline is approaching
   */
  async deadlineApproaching(params: {
    projectId: string;
    projectName: string;
    deadline: string;
    daysRemaining: number;
    userIds: string[];
  }) {
    const priority = params.daysRemaining === 1 ? 'critical' : params.daysRemaining <= 3 ? 'important' : 'info';

    await notificationService.createBulk(params.userIds, {
      type: 'deadline_approaching',
      title: 'Deadline Approaching',
      message: `Project "${params.projectName}" is due in ${params.daysRemaining} day${params.daysRemaining > 1 ? 's' : ''}.`,
      priority,
      link: `/project-details/${params.projectId}`,
      metadata: { projectId: params.projectId, deadline: params.deadline },
      emailTemplate: 'deadline-approaching',
      emailVariables: {
        projectName: params.projectName,
        deadline: new Date(params.deadline).toLocaleDateString(),
        link: `${window.location.origin}/project-details/${params.projectId}`,
      },
    });
  },

  /**
   * Trigger when deadline is overdue
   */
  async deadlineOverdue(params: {
    projectId: string;
    projectName: string;
    deadline: string;
    userIds: string[];
  }) {
    await notificationService.createBulk(params.userIds, {
      type: 'deadline_overdue',
      title: 'Deadline Overdue!',
      message: `Project "${params.projectName}" is now overdue.`,
      priority: 'critical',
      link: `/project-details/${params.projectId}`,
      metadata: { projectId: params.projectId, deadline: params.deadline },
      emailTemplate: 'deadline-overdue',
      emailVariables: {
        projectName: params.projectName,
        link: `${window.location.origin}/project-details/${params.projectId}`,
      },
    });
  },

  /**
   * Trigger for deadline approaching reminder (automatic or manual)
   * Sends to all project members
   */
  async deadlineReminder(params: {
    projectId: string;
    projectName: string;
    deadline: string;
    daysRemaining: number;
    senderId?: string; // If manual, exclude sender
  }) {
    console.log('⏰ Sending deadline reminder:', params);

    // Get all project members
    const memberIds = await getProjectMembers(params.projectId);

    // Exclude sender if this is a manual reminder
    const recipientIds = params.senderId
      ? memberIds.filter(id => id !== params.senderId)
      : memberIds;

    if (recipientIds.length > 0) {
      const deadlineDate = new Date(params.deadline).toLocaleDateString();
      const message = params.daysRemaining === 0
        ? `Project "${params.projectName}" is due TODAY!`
        : params.daysRemaining === 1
          ? `Project "${params.projectName}" is due TOMORROW (${deadlineDate})!`
          : `Project "${params.projectName}" deadline in ${params.daysRemaining} days (${deadlineDate}).`;

      await notificationService.createBulk(recipientIds, {
        type: 'deadline_approaching',
        title: '⏰ Deadline Reminder',
        message,
        priority: params.daysRemaining <= 1 ? 'critical' : 'important',
        link: `/project-details/${params.projectId}`,
        metadata: {
          projectId: params.projectId,
          deadline: params.deadline,
          daysRemaining: params.daysRemaining
        },
      });
      console.log('Deadline reminder sent to:', recipientIds);
    }
  },
};
