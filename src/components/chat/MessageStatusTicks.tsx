/**
 * Message Status Ticks Component
 * Displays WhatsApp-style tick marks for message delivery status
 * 
 * Logic:
 * 1. Single gray tick (✓) = Message sent to server
 * 2. Double gray ticks (✓✓) = Message delivered to recipient(s)
 * 3. Double blue ticks (✓✓) = Message read by all recipients
 */

import { Check, CheckCheck } from 'lucide-react';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

interface MessageStatusTicksProps {
    status?: MessageStatus | string;
    readCount?: number;
    deliveredCount?: number;
    totalParticipants?: number;
    readBy?: string[];
    deliveredTo?: string[];
}

export const MessageStatusTicks = ({
    status,
    readCount = 0,
    deliveredCount = 0,
    totalParticipants = 0,
    readBy = [],
    deliveredTo = []
}: MessageStatusTicksProps) => {

    // Determine actual read and delivered counts
    const actualReadCount = readBy?.length || readCount;
    const actualDeliveredCount = deliveredTo?.length || deliveredCount;

    // WhatsApp-style logic:
    // If any recipient has read the message, show blue double ticks (WhatsApp blue)
    if (status === 'read' || actualReadCount > 0) {
        return (
            <CheckCheck
                className="w-[15px] h-[15px] text-[#53BDEB] flex-shrink-0"
                strokeWidth={2}
                aria-label="Read"
            />
        );
    }

    // If message is delivered, show gray double ticks (dark gray for visibility on light green)
    if (status === 'delivered' || actualDeliveredCount > 0) {
        return (
            <CheckCheck
                className="w-[15px] h-[15px] text-gray-600 dark:text-gray-300 flex-shrink-0"
                strokeWidth={2}
                aria-label="Delivered"
            />
        );
    }

    // Message just sent to server, show single gray tick (dark gray for visibility)
    if (status === 'sent') {
        return (
            <Check
                className="w-[15px] h-[15px] text-gray-600 dark:text-gray-300 flex-shrink-0"
                strokeWidth={2}
                aria-label="Sent"
            />
        );
    }

    // No status yet (sending) - show clock icon
    return (
        <span className="text-[10px] text-white/60" aria-label="Sending">⏱</span>
    );
};
