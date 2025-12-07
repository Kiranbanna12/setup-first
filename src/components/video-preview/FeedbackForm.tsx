import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Timer, LogIn } from "lucide-react";
import { toast } from "sonner";

interface FeedbackFormProps {
    currentTime: number;
    onAddFeedback: (comment: string, timestamp?: number) => void;
    playerRef?: React.RefObject<any>;
    videoUrl?: string;
    disabled?: boolean;
    disabledMessage?: string;
}

export const FeedbackForm = ({
    currentTime,
    onAddFeedback,
    playerRef,
    videoUrl = "",
    disabled = false,
    disabledMessage = "You don't have permission to add feedback"
}: FeedbackFormProps) => {
    const navigate = useNavigate();
    const [newComment, setNewComment] = useState("");
    const [timestampText, setTimestampText] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [capturedTimestamp, setCapturedTimestamp] = useState(0);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check if video supports time tracking (YouTube and Dropbox only - OneDrive not supported)
    const isYouTube = videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be");
    const isDropbox = videoUrl.includes("dropbox.com");

    // Auto-track should be enabled by default for YouTube and Dropbox only
    const [useCurrentTime, setUseCurrentTime] = useState(isYouTube || isDropbox);

    const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const getRealCurrentTime = () => {
        // For all platforms, use the currentTime prop from UniversalVideoPlayer
        // This is already properly updated via onTimeUpdate callback
        return currentTime;
    };

    const parseTime = (text: string) => {
        const parts = text.split(":").map((p) => p.trim());

        // Handle h:mm:ss format (hour:minute:second)
        if (parts.length === 3) {
            const h = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const s = parseInt(parts[2], 10);
            return (isNaN(h) || isNaN(m) || isNaN(s)) ? 0 : h * 3600 + m * 60 + s;
        }

        // Handle mm:ss format (minute:second)
        if (parts.length === 2) {
            const m = parseInt(parts[0], 10);
            const s = parseInt(parts[1], 10);
            return (isNaN(m) || isNaN(s)) ? 0 : m * 60 + s;
        }

        // Handle single number (seconds)
        const v = parseInt(text, 10);
        return isNaN(v) ? 0 : v;
    };

    useEffect(() => {
        if (useCurrentTime) {
            const realTime = getRealCurrentTime();
            const formattedTime = formatTime(realTime);
            setTimestampText(formattedTime);
        } else if (!timestampText) {
            setTimestampText("0:00");
        }
    }, [currentTime, useCurrentTime, timestampText]);

    const handleToggleTimeTracking = () => {
        if (!isYouTube) {
            // Show notification for non-YouTube platforms
            toast.info("Time tracking for this platform will be added very soon. Currently available for YouTube videos only.", {
                duration: 3000,
            });
            return;
        }

        setUseCurrentTime(!useCurrentTime);
        toast.success(useCurrentTime ? "Auto Time Tracking Disabled" : "Auto Time Tracking Enabled", {
            description: useCurrentTime
                ? "Timestamps will no longer be added automatically."
                : "Current video time will be added to your feedback automatically.",
            duration: 2000,
        });
    };

    const handleInsertTimestamp = () => {
        let timestamp;
        if (useCurrentTime) {
            // Use captured timestamp if typing, otherwise current time
            const timeToUse = isTyping ? capturedTimestamp : getRealCurrentTime();
            timestamp = formatTime(timeToUse);
        } else {
            timestamp = timestampText;
        }

        setNewComment((prev) => {
            if (prev.trim()) {
                return `${prev} [${timestamp}] `;
            }
            return `[${timestamp}] `;
        });
    };

    const handleSubmit = () => {
        if (!newComment.trim()) return;

        let selectedTs;
        if (useCurrentTime) {
            // If user was typing, use captured timestamp, otherwise use current time
            selectedTs = isTyping ? capturedTimestamp : getRealCurrentTime();
        } else {
            selectedTs = parseTime(timestampText);
        }

        onAddFeedback(newComment, selectedTs);
        setNewComment("");
        setIsTyping(false);
        setCapturedTimestamp(0);
    };

    return (
        <Card className="shadow-elegant h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Add Feedback
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col">
                {/* Add Comment */}
                <div className="space-y-2 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Your Feedback</label>
                    </div>

                    <div className="flex-1 relative">
                        <Textarea
                            placeholder={
                                disabled
                                    ? disabledMessage
                                    : useCurrentTime && (isYouTube || isDropbox)
                                        ? `[${formatTime(getRealCurrentTime())}] Type your feedback here...`
                                        : "Type your feedback here..."
                            }
                            value={newComment}
                            disabled={disabled}
                            onChange={(e) => {
                                const newValue = e.target.value;

                                // Handle typing detection for auto-track
                                if (useCurrentTime && (isYouTube || isDropbox)) {
                                    if (!isTyping && newValue.trim() !== '') {
                                        // User started typing - capture current timestamp and insert it
                                        const timestamp = getRealCurrentTime();
                                        setIsTyping(true);
                                        setCapturedTimestamp(timestamp);

                                        // Auto-insert timestamp at the beginning if not already present
                                        if (!newValue.startsWith('[')) {
                                            setNewComment(`[${formatTime(timestamp)}] ${newValue}`);
                                            return; // Don't set the comment without timestamp
                                        }
                                    }

                                    // Reset typing timeout
                                    if (typingTimeoutRef.current) {
                                        clearTimeout(typingTimeoutRef.current);
                                    }

                                    // If user stops typing for 2 seconds and clears text, resume auto-track
                                    typingTimeoutRef.current = setTimeout(() => {
                                        if (newValue.trim() === '') {
                                            setIsTyping(false);
                                            setCapturedTimestamp(0);
                                        }
                                    }, 2000);
                                }

                                setNewComment(newValue);
                            }}
                            className="flex-1 resize-none"
                        />
                    </div>

                    {/* Timestamp Controls */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={useCurrentTime}
                                onChange={(e) => {
                                    const shouldEnable = e.target.checked;

                                    // Only allow enabling auto-track for supported platforms (YouTube and Dropbox only)
                                    if (shouldEnable && !(isYouTube || isDropbox)) {
                                        toast.info("Auto-tracking is currently available for YouTube and Dropbox videos only. Coming soon for other platforms!", {
                                            duration: 3000
                                        });
                                        return;
                                    }

                                    setUseCurrentTime(shouldEnable);
                                    if (shouldEnable) setTimestampText(formatTime(currentTime));
                                }}
                                className="rounded border-gray-300"
                            />
                            <label className="text-sm">Auto-track video time</label>
                        </div>

                        {useCurrentTime && isYouTube && (
                            <p className="text-xs text-muted-foreground text-green-600">
                                ✓ Auto-tracking enabled for YouTube
                            </p>
                        )}

                        {!useCurrentTime && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={timestampText}
                                        onChange={(e) => setTimestampText(e.target.value)}
                                        placeholder="mm:ss or h:mm:ss"
                                        className="h-8 flex-1"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleInsertTimestamp}
                                        className="h-8 px-3 text-xs"
                                    >
                                        <Timer className="w-3 h-3 mr-1" />
                                        Add Timestamp
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Enter time manually (e.g., 1:23 or 1:23:45) and click Add Timestamp
                                </p>
                            </div>
                        )}
                    </div>

                    <Button
                        onClick={handleSubmit}
                        className="w-full"
                        disabled={disabled || !newComment.trim()}
                        size="lg"
                        title={disabled ? disabledMessage : undefined}
                    >
                        <Send className="w-4 h-4 mr-2" />
                        {disabled ? "View Only Access" : "Submit Feedback"}
                    </Button>

                    {disabled && disabledMessage?.includes("login") && (
                        <div className="space-y-2">
                            <p className="text-xs text-center text-muted-foreground text-amber-600">
                                {disabledMessage}
                            </p>
                            <Button
                                onClick={() => {
                                    toast.info("Redirecting to login...", { duration: 2000 });
                                    navigate("/auth");
                                }}
                                variant="outline"
                                className="w-full"
                                size="sm"
                            >
                                <LogIn className="w-4 h-4 mr-2" />
                                Login to Add Feedback
                            </Button>
                        </div>
                    )}

                    {disabled && !disabledMessage?.includes("login") && (
                        <p className="text-xs text-center text-muted-foreground text-amber-600 mt-2">
                            {disabledMessage}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
