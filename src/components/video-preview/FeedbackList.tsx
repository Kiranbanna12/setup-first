import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Clock, CheckCircle, XCircle, Edit2, Trash2, Reply, Save, X, History, ChevronDown, ChevronUp } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface FeedbackListProps {
    feedback: any[];
    onSeekToTimestamp: (seconds: number) => void;
    onResolveFeedback: (feedbackId: string, resolved: boolean) => void;
    onEditFeedback: (feedbackId: string, newText: string, rootId?: string) => void;
    onDeleteFeedback: (feedbackId: string, rootId?: string) => void;
    onReplyToFeedback: (parentId: string, replyText: string, timestamp?: number) => void;
    currentUserId?: string;
}

export const FeedbackList = ({
    feedback,
    onSeekToTimestamp,
    onResolveFeedback,
    onEditFeedback,
    onDeleteFeedback,
    onReplyToFeedback,
    currentUserId
}: FeedbackListProps) => {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const [replyingToId, setReplyingToId] = useState<string | null>(null);
    const [replyText, setReplyText] = useState("");
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

    const handleStartEdit = (feedbackId: string, currentText: string) => {
        setEditingId(feedbackId);
        setEditText(currentText);
    };

    const handleSaveEdit = (feedbackId: string, rootId?: string) => {
        if (!editText.trim()) {
            toast.error("Comment cannot be empty");
            return;
        }
        onEditFeedback(feedbackId, editText, rootId);
        setEditingId(null);
        setEditText("");
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditText("");
    };

    const handleStartReply = (feedbackId: string) => {
        setReplyingToId(feedbackId);
        setReplyText("");
    };

    const handleSaveReply = (parentId: string, timestamp?: number) => {
        if (!replyText.trim()) {
            toast.error("Reply cannot be empty");
            return;
        }
        onReplyToFeedback(parentId, replyText, timestamp);
        setReplyingToId(null);
        setReplyText("");
    };

    const handleCancelReply = () => {
        setReplyingToId(null);
        setReplyText("");
    };

    const handleDeleteClick = (feedbackId: string) => {
        setDeletingId(feedbackId);
    };

    const handleConfirmDelete = (feedbackId: string, rootId?: string) => {
        onDeleteFeedback(feedbackId, rootId);
        setDeletingId(null);
    };

    const handleCancelDelete = () => {
        setDeletingId(null);
    };

    const toggleReplies = (feedbackId: string) => {
        setExpandedReplies(prev => {
            const newSet = new Set(prev);
            if (newSet.has(feedbackId)) {
                newSet.delete(feedbackId);
            } else {
                newSet.add(feedbackId);
            }
            return newSet;
        });
    };

    // Function to parse and format edit history
    const getEditHistory = (item: any) => {
        if (!item.edit_history) return null;

        try {
            const history = typeof item.edit_history === 'string'
                ? JSON.parse(item.edit_history)
                : item.edit_history;
            return history;
        } catch (e) {
            return null;
        }
    };

    const formatEditTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    // Function to render comment text with clickable timestamps
    const renderCommentWithTimestamps = (text: string) => {
        // Regular expression to match timestamps like [1:23], [0:45], [1:23:45]
        const timestampRegex = /\[(\d+):(\d+)(?::(\d+))?\]/g;
        const parts: (string | JSX.Element)[] = [];
        let lastIndex = 0;
        let match;

        while ((match = timestampRegex.exec(text)) !== null) {
            // Add text before the timestamp
            if (match.index > lastIndex) {
                parts.push(
                    <span key={`text-${lastIndex}`}>
                        {text.substring(lastIndex, match.index)}
                    </span>
                );
            }

            // Parse the timestamp
            const hours = match[3] ? parseInt(match[1], 10) : 0;
            const minutes = match[3] ? parseInt(match[2], 10) : parseInt(match[1], 10);
            const seconds = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
            const totalSeconds = hours * 3600 + minutes * 60 + seconds;
            const timestampText = match[0];

            // Add clickable timestamp
            parts.push(
                <button
                    key={`timestamp-${match.index}`}
                    onClick={() => onSeekToTimestamp(totalSeconds)}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors"
                >
                    <Clock className="w-3 h-3 mr-1" />
                    {timestampText.slice(1, -1)}
                </button>
            );

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(
                <span key={`text-${lastIndex}`}>
                    {text.substring(lastIndex)}
                </span>
            );
        }

        return parts.length > 0 ? <>{parts}</> : <span>{text}</span>;
    };

    // Render a single feedback item with all actions
    const renderFeedbackItem = (item: any, isReply: boolean = false, rootId: string) => {
        const isEditing = editingId === item.id;
        const isDeleting = deletingId === item.id;
        const isReplying = replyingToId === item.id;
        const isOwner = currentUserId === item.user_id;

        // Get user display info
        let userName = item.user_name || 'Unknown User';
        // If we have profile data joined
        if (item.profiles) {
            userName = item.profiles.full_name || item.profiles.email || item.user_name || 'Unknown User';
        }

        return (
            <Card
                key={item.id}
                className={`${item.is_resolved
                    ? "border-success/30 bg-success/5"
                    : "border-border"
                    } ${isReply ? "ml-12 mt-2" : ""}`}
            >
                <CardContent className="p-4 space-y-3">
                    {/* Header with user info and actions */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                            {/* User Avatar/Initial */}
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                                {userName.charAt(0).toUpperCase()}
                            </div>

                            {/* User Name and Time */}
                            <div className="flex-1">
                                <p className="text-sm font-medium">
                                    {userName}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>
                                        {new Date(item.created_at).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric'
                                        })}
                                    </span>
                                    <span>•</span>
                                    <span>
                                        {new Date(item.created_at).toLocaleTimeString('en-US', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                    {item.updated_at && item.updated_at !== item.created_at && (() => {
                                        const editHistory = getEditHistory(item);
                                        const editCount = editHistory ? editHistory.length : 1;

                                        return (
                                            <>
                                                <span>•</span>
                                                <TooltipProvider>
                                                    <Tooltip delayDuration={200}>
                                                        <TooltipTrigger asChild>
                                                            <span className="italic cursor-help hover:text-primary transition-colors inline-flex items-center gap-1">
                                                                <History className="w-3 h-3" />
                                                                edited {editCount > 1 ? `(${editCount}x)` : ''}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom" className="max-w-sm">
                                                            <div className="space-y-2">
                                                                <p className="font-semibold text-xs">Edit History:</p>
                                                                {editHistory && editHistory.length > 0 ? (
                                                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                                                        {editHistory.map((edit: any, idx: number) => (
                                                                            <div key={idx} className="text-xs border-l-2 border-primary/30 pl-2">
                                                                                <p className="font-medium text-primary">
                                                                                    Edit {idx + 1} - {formatEditTimestamp(edit.editedAt)}
                                                                                </p>
                                                                                <p className="text-muted-foreground mt-1">
                                                                                    <span className="font-semibold">Previous:</span> "{edit.previousText.substring(0, 100)}{edit.previousText.length > 100 ? '...' : ''}"
                                                                                </p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Last edited: {formatEditTimestamp(item.updated_at)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1">
                            {isOwner && !isEditing && !isDeleting && (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleStartEdit(item.id, item.comment_text)}
                                        className="px-2 h-8"
                                        title="Edit"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteClick(item.id)}
                                        className="px-2 h-8 text-destructive hover:text-destructive"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </>
                            )}
                            {!isReply && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        onResolveFeedback(item.id, !item.is_resolved)
                                    }
                                    className="px-2 h-8"
                                    title={item.is_resolved ? "Reopen" : "Resolve"}
                                >
                                    {item.is_resolved ? (
                                        <XCircle className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                        <CheckCircle className="w-4 h-4 text-success" />
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Feedback Comment - Editing Mode or Display Mode */}
                    {isEditing ? (
                        <div className="space-y-2 pl-10">
                            <Textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                className="min-h-[80px]"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveEdit(item.id, rootId)}
                                    disabled={!editText.trim()}
                                >
                                    <Save className="w-3 h-3 mr-1" />
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                >
                                    <X className="w-3 h-3 mr-1" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm whitespace-pre-wrap pl-10">
                            {renderCommentWithTimestamps(item.comment_text)}
                        </div>
                    )}

                    {/* Delete Confirmation */}
                    {isDeleting && (
                        <div className="pl-10 p-3 bg-destructive/10 rounded border border-destructive/30">
                            <p className="text-sm text-destructive font-medium mb-2">
                                Are you sure you want to delete this feedback?
                                {item.replies && item.replies.length > 0 && (
                                    <span className="block text-xs mt-1">
                                        This will also delete {item.replies.length} {item.replies.length === 1 ? 'reply' : 'replies'}.
                                    </span>
                                )}
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleConfirmDelete(item.id, rootId)}
                                >
                                    <Trash2 className="w-3 h-3 mr-1" />
                                    Delete
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelDelete}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Action Bar */}
                    {!isEditing && !isDeleting && (
                        <div className="flex items-center gap-3 pl-10">
                            {/* Reply Button - Available on both main comments and replies */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartReply(item.id)}
                                className="h-7 px-2 text-xs"
                            >
                                <Reply className="w-3 h-3 mr-1" />
                                Reply
                            </Button>

                            {/* Resolved Badge - Only on main comments */}
                            {!isReply && !!item.is_resolved && (
                                <Badge variant="outline" className="text-xs bg-success/10">
                                    Resolved
                                </Badge>
                            )}

                            {/* View Replies Button - Only on main comments */}
                            {!isReply && item.replies && item.replies.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleReplies(item.id)}
                                    className="h-7 px-2 text-xs text-primary hover:text-primary-foreground hover:bg-primary font-medium transition-colors"
                                >
                                    {expandedReplies.has(item.id) ? (
                                        <>
                                            <ChevronUp className="w-3 h-3 mr-1" />
                                            Hide {item.replies.length} {item.replies.length === 1 ? 'Reply' : 'Replies'}
                                        </>
                                    ) : (
                                        <>
                                            <ChevronDown className="w-3 h-3 mr-1" />
                                            View {item.replies.length} {item.replies.length === 1 ? 'Reply' : 'Replies'}
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Reply Form */}
                    {isReplying && (
                        <div className="space-y-2 pl-10 pt-2 border-t">
                            <Textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a reply..."
                                className="min-h-[60px]"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveReply(rootId, item.timestamp_seconds)}
                                    disabled={!replyText.trim()}
                                >
                                    <Reply className="w-3 h-3 mr-1" />
                                    Reply
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelReply}
                                >
                                    <X className="w-3 h-3 mr-1" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <Card className="shadow-elegant">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    All Feedback ({feedback.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                        {feedback.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                No feedback yet. Be the first to add!
                            </p>
                        ) : (
                            feedback.map((item) => (
                                <div key={item.id} className="space-y-2">
                                    {/* Render main feedback */}
                                    {renderFeedbackItem(item, false, item.id)}

                                    {/* Render replies - Only show if expanded */}
                                    {item.replies && item.replies.length > 0 && expandedReplies.has(item.id) && (
                                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                                            {item.replies.map((reply: any) => renderFeedbackItem(reply, true, item.id))}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};
