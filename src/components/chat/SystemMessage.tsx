/**
 * System Message Component
 * Displays chat system notifications (user joined, removed, etc.)
 */

import { format } from 'date-fns';

interface SystemMessageProps {
    type: 'user_joined' | 'user_removed' | 'user_left' | 'request_approved' | 'request_rejected' | string;
    userName: string;
    timestamp?: string;
}

export const SystemMessage = ({ type, userName, timestamp }: SystemMessageProps) => {
    const getMessage = () => {
        switch (type) {
            case 'user_joined':
                return `${userName} joined the chat`;
            case 'user_removed':
                return `${userName} was removed from the chat`;
            case 'user_left':
                return `${userName} left the chat`;
            case 'request_approved':
                return `${userName}'s join request was approved`;
            case 'request_rejected':
                return `${userName}'s join request was rejected`;
            default:
                return `${userName} - ${type}`;
        }
    };

    return (
        <div className="flex justify-center my-3 sm:my-4">
            <div className="bg-muted/50 border border-border/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg max-w-[85%]">
                <p className="text-[11px] sm:text-xs text-muted-foreground text-center">
                    {getMessage()}
                    {timestamp && (
                        <span className="ml-2 opacity-70">
                            {format(new Date(timestamp), 'HH:mm')}
                        </span>
                    )}
                </p>
            </div>
        </div>
    );
};
