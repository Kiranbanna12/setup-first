import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, Play, Link as LinkIcon, MessageSquare, Eye, Lock, LogIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SharedVersionManagementProps {
    projectId: string;
    versions: any[];
    onVersionsUpdate: () => void;
    canEdit: boolean;
    shareToken: string;
    sectionTitle?: string;
    isSubProject?: boolean;
}

export const SharedVersionManagement = ({
    projectId,
    versions,
    onVersionsUpdate,
    canEdit,
    shareToken,
    sectionTitle,
    isSubProject = false
}: SharedVersionManagementProps) => {
    const safeVersions = Array.isArray(versions) ? versions : [];
    const navigate = useNavigate();

    const [viewFeedbackDialogOpen, setViewFeedbackDialogOpen] = useState(false);
    const [viewFeedbackList, setViewFeedbackList] = useState<any[]>([]);
    const [isLoadingFeedback, setIsLoadingFeedback] = useState(false);
    const [viewingVersionNumber, setViewingVersionNumber] = useState<number | null>(null);

    const handleViewFeedback = async (version: any) => {
        setViewingVersionNumber(version.version_number);
        setIsLoadingFeedback(true);
        setViewFeedbackDialogOpen(true);
        setViewFeedbackList([]);

        try {
            // Use the shared RPC to fetch feedback (bypassing RLS)
            const { data, error } = await (supabase.rpc as any)('get_video_version_by_share', {
                version_id_input: version.id,
                share_token_input: shareToken
            });

            if (error) throw error;

            if (data && data.feedback) {
                // Map the data to include profiles structure for compatibility if needed, 
                // though the simple list might just use user_name directly.
                // Let's stick to the raw returned data which has user_name/user_email/replies
                setViewFeedbackList(data.feedback);
            }
        } catch (error) {
            console.error("Error fetching feedback:", error);
            toast.error("Failed to load feedback");
        } finally {
            setIsLoadingFeedback(false);
        }
    };

    const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState("");
    const [selectedVersionForFeedback, setSelectedVersionForFeedback] = useState<any>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        checkAuthentication();
    }, []);

    const checkAuthentication = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            setIsAuthenticated(!!user);
        } catch {
            setIsAuthenticated(false);
        }
    };

    const handleSubmitFeedback = async () => {
        if (!feedbackText.trim()) {
            toast.error("Please enter feedback");
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Not authenticated");

            // Insert feedback directly into video_feedback table
            const { error } = await (supabase as any)
                .from('video_feedback')
                .insert({
                    version_id: selectedVersionForFeedback.id,
                    comment_text: feedbackText,
                    user_id: user.id,
                    is_resolved: false
                });

            if (error) throw error;

            toast.success("Feedback submitted successfully");
            setFeedbackDialogOpen(false);
            setFeedbackText("");
            setSelectedVersionForFeedback(null);
            onVersionsUpdate();
        } catch (error) {
            console.error("Error submitting feedback:", error);
            toast.error("Failed to submit feedback");
        }
    };

    const handleRequestCorrections = (version: any) => {
        if (!canEdit) {
            toast.error("You don't have permission to add feedback");
            return;
        }

        if (!isAuthenticated) {
            toast.error("Please login to add feedback", {
                duration: 5000,
                action: {
                    label: "Login",
                    onClick: () => {
                        // Save current location to return after login
                        localStorage.setItem('returnUrl', `/shared/${shareToken}`);
                        navigate("/auth");
                    }
                }
            });
            // Save current location to return after login
            localStorage.setItem('returnUrl', `/shared/${shareToken}`);
            navigate("/auth");
            return;
        }

        setSelectedVersionForFeedback(version);
        setFeedbackText("");
        setFeedbackDialogOpen(true);
    };

    const renderFeedbackItem = (item: any, isReply = false) => (
        <div key={item.id} className={`flex gap-2 sm:gap-3 text-xs sm:text-sm ${isReply ? 'ml-6 sm:ml-8 mt-2' : 'py-2 sm:py-3 border-b last:border-0'}`}>
            <div className="flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs sm:text-sm">
                {(item.user_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 space-y-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{item.user_name || 'Unknown User'}</span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0">
                        {new Date(item.created_at).toLocaleDateString()}
                    </span>
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap break-words">{item.comment_text}</p>
                {item.timestamp_seconds > 0 && (
                    <Badge variant="secondary" className="text-[10px] sm:text-xs mt-1">
                        {Math.floor(item.timestamp_seconds / 60)}:{(item.timestamp_seconds % 60).toString().padStart(2, '0')}
                    </Badge>
                )}
            </div>
        </div>
    );

    const getApprovalBadge = (status: string) => {
        const variants: Record<string, any> = {
            pending: { variant: "secondary", label: "Pending", icon: AlertCircle },
            approved: { variant: "default", label: "Approved", icon: CheckCircle, className: "bg-success" },
            rejected: { variant: "destructive", label: "Rejected", icon: XCircle },
            corrections_needed: { variant: "default", label: "Corrections Needed", icon: AlertCircle, className: "bg-yellow-500 text-yellow-900" }
        };

        const config = variants[status] || variants.pending;
        const Icon = config.icon;

        return (
            <Badge variant={config.variant} className={config.className}>
                <Icon className="w-3 h-3 mr-1" />
                {config.label}
            </Badge>
        );
    };

    return (
        <>
            <Card className="shadow-elegant">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base sm:text-lg">{sectionTitle || "Video Versions"}</CardTitle>
                            {!isSubProject && (
                                <CardDescription className="text-xs sm:text-sm">
                                    {canEdit
                                        ? "View versions and add feedback"
                                        : "View-only access to project versions"}
                                </CardDescription>
                            )}
                        </div>
                        {canEdit && (
                            <Badge variant="outline" className="gap-1">
                                <MessageSquare className="w-3 h-3" />
                                Can Add Feedback
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {safeVersions.length === 0 ? (
                        <div className="text-center py-6 sm:py-8">
                            <Eye className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-muted-foreground opacity-50" />
                            <p className="text-sm sm:text-base text-muted-foreground">No versions added yet</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card Layout */}
                            <div className="block sm:hidden space-y-3">
                                {safeVersions.map((version) => (
                                    <Card key={version.id} className="shadow-sm">
                                        <CardContent className="p-3 sm:p-4">
                                            <div className="space-y-3">
                                                {/* Header with version and status */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <h4 className="font-semibold text-sm">Version {version.version_number}</h4>
                                                        <p className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                    {getApprovalBadge(version.approval_status)}
                                                </div>

                                                {/* Video Links */}
                                                <div className="space-y-2">
                                                    {version.preview_url && (
                                                        <Button
                                                            size="sm"
                                                            variant="default"
                                                            className="w-full h-9 text-xs justify-center"
                                                            onClick={() => navigate(`/video-preview/${version.id}?share=${shareToken}`)}
                                                        >
                                                            <Play className="w-3 h-3 mr-2" />
                                                            Watch & Review
                                                        </Button>
                                                    )}
                                                    {version.final_url && (
                                                        <a
                                                            href={version.final_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center justify-center gap-2 text-xs bg-success/10 dark:bg-success/20 px-3 py-2 rounded border border-success/30 text-success hover:bg-success/20 dark:hover:bg-success/30 transition-colors"
                                                        >
                                                            <LinkIcon className="w-3 h-3" />
                                                            Final Link
                                                        </a>
                                                    )}
                                                    {!version.preview_url && !version.final_url && (
                                                        <span className="text-xs text-muted-foreground">No links available</span>
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                <div className="flex flex-col gap-2 pt-2 border-t">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="w-full h-8 text-xs justify-center"
                                                        onClick={() => handleViewFeedback(version)}
                                                    >
                                                        <MessageSquare className="w-3 h-3 mr-2" />
                                                        View Feedback
                                                    </Button>

                                                    {canEdit && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="w-full h-8 text-xs"
                                                            onClick={() => handleRequestCorrections(version)}
                                                        >
                                                            {!isAuthenticated ? (
                                                                <>
                                                                    <LogIn className="w-3 h-3 mr-2" />
                                                                    Login to Add
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <MessageSquare className="w-3 h-3 mr-2" />
                                                                    Add Feedback
                                                                </>
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Desktop Table Layout */}
                            <div className="hidden sm:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-xs">Version</TableHead>
                                            <TableHead className="text-xs">Created</TableHead>
                                            <TableHead className="text-xs">Preview</TableHead>
                                            <TableHead className="text-xs">Status</TableHead>
                                            <TableHead className="text-xs">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {safeVersions.map((version) => (
                                            <TableRow key={version.id}>
                                                <TableCell className="font-medium text-sm">v{version.version_number}</TableCell>
                                                <TableCell className="text-sm">{new Date(version.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell>
                                                    <div className="space-y-2">
                                                        {version.preview_url && (
                                                            <Button
                                                                size="sm"
                                                                variant="default"
                                                                onClick={() => navigate(`/video-preview/${version.id}?share=${shareToken}`)}
                                                            >
                                                                <Play className="w-3 h-3 mr-1" />
                                                                Watch & Review
                                                            </Button>
                                                        )}
                                                        {version.final_url && (
                                                            <div className="flex items-center gap-2 mt-2">
                                                                <a
                                                                    href={version.final_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-success hover:text-success/80 font-semibold text-sm bg-success/10 px-2 py-1 rounded border border-success/30 hover:bg-success/20 transition-colors"
                                                                >
                                                                    <LinkIcon className="w-3 h-3 mr-1 inline" />
                                                                    Final Link
                                                                </a>
                                                            </div>
                                                        )}
                                                        {!version.preview_url && !version.final_url && (
                                                            <span className="text-muted-foreground text-sm">Not available</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getApprovalBadge(version.approval_status)}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-2">
                                                        {/* View Feedback Button - Available to all with view access */}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="w-full justify-start"
                                                            onClick={() => handleViewFeedback(version)}
                                                        >
                                                            <MessageSquare className="w-3 h-3 mr-1" />
                                                            View Feedback
                                                        </Button>

                                                        {canEdit ? (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleRequestCorrections(version)}
                                                            >
                                                                {!isAuthenticated ? (
                                                                    <>
                                                                        <LogIn className="w-3 h-3 mr-1" />
                                                                        Login to Add
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <MessageSquare className="w-3 h-3 mr-1" />
                                                                        Add Feedback
                                                                    </>
                                                                )}
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Feedback Dialog */}
            <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
                <DialogContent className="w-[95vw] max-w-2xl mx-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">Add Feedback</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                            Provide feedback for Version {selectedVersionForFeedback?.version_number}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 sm:space-y-4">
                        <Textarea
                            placeholder="Enter your feedback here... Be specific about what you'd like to see changed."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            rows={6}
                            className="resize-none text-sm sm:text-base min-h-[120px] sm:min-h-[200px]"
                        />
                        <p className="text-xs sm:text-sm text-muted-foreground">
                            Your feedback will be sent to the project team for review.
                        </p>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button type="button" variant="outline" className="w-full sm:w-auto text-sm" onClick={() => setFeedbackDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button className="w-full sm:w-auto text-sm" onClick={handleSubmitFeedback}>
                            Submit Feedback
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* View Feedback Dialog */}
            <Dialog open={viewFeedbackDialogOpen} onOpenChange={setViewFeedbackDialogOpen}>
                <DialogContent className="w-[95vw] max-w-2xl mx-auto max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">Version {viewingVersionNumber} Feedback</DialogTitle>
                        <DialogDescription className="text-xs sm:text-sm">
                            Reviewing feedback and comments for this version
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 min-h-0">
                        {isLoadingFeedback ? (
                            <div className="flex items-center justify-center py-6 sm:py-8">
                                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary"></div>
                            </div>
                        ) : viewFeedbackList.length === 0 ? (
                            <div className="text-center py-6 sm:py-8 text-muted-foreground">
                                <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No feedback found for this version</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {viewFeedbackList.map(item => (
                                    <div key={item.id}>
                                        {renderFeedbackItem(item)}
                                        {item.replies && item.replies.map((reply: any) => renderFeedbackItem(reply, true))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button className="w-full sm:w-auto text-sm" onClick={() => setViewFeedbackDialogOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
