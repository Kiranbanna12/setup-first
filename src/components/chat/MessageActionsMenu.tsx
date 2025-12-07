/**
 * Message Actions Menu Component
 * WhatsApp-style hover menu with message actions
 */

import { useState } from 'react';
import {
    Reply,
    Copy,
    Forward,
    Pin,
    Star,
    Trash2,
    Flag,
    Info,
    Edit2,
    MessageSquare,
    ChevronDown,
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface MessageActionsMenuProps {
    isOwnMessage: boolean;
    isPinned?: boolean;
    isStarred?: boolean;
    onReply: () => void;
    onReplyPrivately?: () => void;
    onCopy: () => void;
    onReact?: () => void;
    onForward?: () => void;
    onPin?: () => void;
    onStar?: () => void;
    onEdit?: () => void;
    onDelete: () => void;
    onReport?: () => void;
    onInfo?: () => void;
}

export const MessageActionsMenu = ({
    isOwnMessage,
    isPinned = false,
    isStarred = false,
    onReply,
    onReplyPrivately,
    onCopy,
    onReact,
    onForward,
    onPin,
    onStar,
    onEdit,
    onDelete,
    onReport,
    onInfo,
}: MessageActionsMenuProps) => {
    const [open, setOpen] = useState(false);

    const handleAction = (action: () => void) => {
        action();
        setOpen(false);
    };

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-all hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                >
                    <ChevronDown className="h-3.5 w-3.5" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem onClick={() => handleAction(onReply)}>
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                </DropdownMenuItem>

                {onReplyPrivately && (
                    <DropdownMenuItem onClick={() => handleAction(onReplyPrivately)}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Reply Privately
                    </DropdownMenuItem>
                )}

                <DropdownMenuItem onClick={() => handleAction(onCopy)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                </DropdownMenuItem>

                {onReact && (
                    <DropdownMenuItem onClick={() => handleAction(onReact)}>
                        <span className="text-lg mr-2">😊</span>
                        React
                    </DropdownMenuItem>
                )}

                {onForward && (
                    <DropdownMenuItem onClick={() => handleAction(onForward)}>
                        <Forward className="h-4 w-4 mr-2" />
                        Forward
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {onPin && (
                    <DropdownMenuItem onClick={() => handleAction(onPin)}>
                        <Pin className="h-4 w-4 mr-2" />
                        {isPinned ? 'Unpin' : 'Pin'}
                    </DropdownMenuItem>
                )}

                {onStar && (
                    <DropdownMenuItem onClick={() => handleAction(onStar)}>
                        <Star className={`h-4 w-4 mr-2 ${isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                        {isStarred ? 'Unstar' : 'Star'}
                    </DropdownMenuItem>
                )}

                {isOwnMessage && onInfo && (
                    <DropdownMenuItem onClick={() => handleAction(onInfo)}>
                        <Info className="h-4 w-4 mr-2" />
                        Message Info
                    </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                {isOwnMessage && onEdit && (
                    <DropdownMenuItem onClick={() => handleAction(onEdit)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                    </DropdownMenuItem>
                )}

                <DropdownMenuItem
                    onClick={() => handleAction(onDelete)}
                    className={isOwnMessage ? "text-destructive" : ""}
                >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isOwnMessage ? 'Delete' : 'Delete for me'}
                </DropdownMenuItem>

                {!isOwnMessage && onReport && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => handleAction(onReport)}
                            className="text-destructive"
                        >
                            <Flag className="h-4 w-4 mr-2" />
                            Report
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
