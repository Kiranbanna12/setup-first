import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, CheckCircle, XCircle, AlertCircle, Eye, Link as LinkIcon, Play, MessageSquare, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notificationTriggers } from "@/lib/notificationTriggers";

interface VersionManagementProps {
  projectId: string;
  versions: any[];
  onVersionsUpdate: () => void;
  userRole: string | null;
  isProjectCreator?: boolean;
  sectionTitle?: string;
  isSubProject?: boolean;
}

export const VersionManagement = ({
  projectId,
  versions,
  onVersionsUpdate,
  userRole,
  isProjectCreator = false,
  sectionTitle,
  isSubProject = false
}: VersionManagementProps) => {
  // Ensure versions is always an array
  const safeVersions = Array.isArray(versions) ? versions : [];
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<any>(null);
  const [formData, setFormData] = useState({
    preview_url: "",
    final_url: ""
  });

  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [selectedVersionForFeedback, setSelectedVersionForFeedback] = useState<any>(null);

  const [viewFeedbackDialogOpen, setViewFeedbackDialogOpen] = useState(false);
  const [viewingFeedback, setViewingFeedback] = useState<any>(null);
  const [currentVersionFeedback, setCurrentVersionFeedback] = useState<any[]>([]);

  // Status management state
  const [statusChangeDialogOpen, setStatusChangeDialogOpen] = useState(false);
  const [selectedVersionForStatusChange, setSelectedVersionForStatusChange] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [finalLinkUrl, setFinalLinkUrl] = useState('');
  const [correctionsText, setCorrectionsText] = useState('');

  // Final link management state
  const [finalLinkDialogOpen, setFinalLinkDialogOpen] = useState(false);
  const [selectedVersionForFinalLink, setSelectedVersionForFinalLink] = useState<any>(null);
  const [newFinalLink, setNewFinalLink] = useState('');

  // Feedback summary state
  const [feedbackSummary, setFeedbackSummary] = useState<{ [key: string]: any }>({});

  // Load feedback summary when component mounts or versions change
  useEffect(() => {
    loadFeedbackSummary();
  }, [projectId, versions]);

  const loadFeedbackSummary = async () => {
    if (safeVersions.length === 0) return;

    try {
      // Fetch all feedback for the versions in this project
      const versionIds = safeVersions.map(v => v.id);

      const { data, error } = await supabase
        .from('video_feedback')
        .select('version_id')
        .in('version_id', versionIds);

      if (error) throw error;

      // Aggregate counts by version_id
      const summaryMap: { [key: string]: any } = {};

      // Initialize counts
      versionIds.forEach(id => {
        summaryMap[id] = { total_feedback: 0 };
      });

      // Count feedback
      if (data) {
        data.forEach((item: any) => {
          if (summaryMap[item.version_id]) {
            summaryMap[item.version_id].total_feedback += 1;
          }
        });
      }

      setFeedbackSummary(summaryMap);
    } catch (error) {
      console.error("Error loading feedback summary:", error);
    }
  };

  const loadVersionFeedback = async (versionId: string) => {
    try {
      const { data, error } = await supabase
        .from('video_feedback')
        .select('*')
        .eq('version_id', versionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCurrentVersionFeedback(data || []);

      // Find the version details for display
      const version = safeVersions.find(v => v.id === versionId);
      setViewingFeedback(version);
      setViewFeedbackDialogOpen(true);
    } catch (error) {
      console.error("Error loading version feedback:", error);
      toast.error("Failed to load feedback");
    }
  };

  const handleAddFeedbackFromDialog = async () => {
    if (!feedbackText.trim()) {
      toast.error("Please enter feedback");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || "User";

      const { error: insertError } = await supabase
        .from('video_feedback')
        .insert({
          project_id: projectId,
          version_id: viewingFeedback.id,
          user_id: user.id,
          user_name: userName,
          user_email: user.email,
          comment_text: feedbackText,
          is_resolved: false
        });

      if (insertError) throw insertError;

      toast.success("Feedback added");
      setFeedbackText("");

      // Get project name for notification
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();

      // Send notification to all project members
      notificationTriggers.feedbackAdded({
        projectId,
        projectName: project?.name || 'Project',
        feedbackAuthorId: user.id,
        feedbackContent: feedbackText
      });

      // Reload everything
      await Promise.all([
        loadVersionFeedback(viewingFeedback.id),
        onVersionsUpdate(),
        loadFeedbackSummary()
      ]);

    } catch (error) {
      console.error("Error adding feedback:", error);
      toast.error("Failed to add feedback");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.preview_url.trim()) {
      toast.error("Preview URL is required");
      return;
    }

    if (!isValidUrl(formData.preview_url)) {
      toast.error("Please enter a valid preview URL");
      return;
    }

    if (formData.final_url && !isValidUrl(formData.final_url)) {
      toast.error("Please enter a valid final URL");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (editingVersion) {
        // @ts-ignore
        const { error } = await supabase
          .from('video_versions')
          .update({
            preview_url: formData.preview_url,
            final_url: formData.final_url || null,
            // Keep approval status, don't reset it on simple edit unless specified
          })
          .eq('id', editingVersion.id);

        if (error) throw error;
        toast.success("Version updated successfully");
      } else {
        const nextVersionNumber = safeVersions.length > 0
          ? Math.max(...safeVersions.map(v => v.version_number)) + 1
          : 1;

        // @ts-ignore
        const { error } = await supabase
          .from('video_versions')
          .insert({
            project_id: projectId,
            version_number: nextVersionNumber,
            preview_url: formData.preview_url,
            final_url: formData.final_url || null,
            uploaded_by: user.id,
            approval_status: 'pending'
          });

        if (error) throw error;
        toast.success("Version added successfully");

        // Get project name for notification
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', projectId)
          .single();

        // Send notification to all project members
        notificationTriggers.versionAdded({
          projectId,
          projectName: project?.name || 'Project',
          versionNumber: nextVersionNumber,
          uploaderId: user.id
        });
      }

      handleDialogClose();
      onVersionsUpdate();
    } catch (error: any) {
      console.error("Error saving version:", error);
      toast.error(error.message || "Failed to save version");
    }
  };

  const handleEdit = (version: any) => {
    setEditingVersion(version);
    setFormData({
      preview_url: version.preview_url || "",
      final_url: version.final_url || ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (versionId: string) => {
    try {
      const { error } = await supabase
        .from('video_versions')
        .delete()
        .eq('id', versionId);

      if (error) throw error;
      toast.success("Version deleted successfully");
      onVersionsUpdate();
    } catch (error) {
      console.error("Error deleting version:", error);
      toast.error("Failed to delete version");
    }
  };

  const handleStatusClick = (version: any) => {
    // Only allow status changes for clients and project creators
    if (userRole === 'client' || isProjectCreator) {
      setSelectedVersionForStatusChange(version);
      setSelectedStatus('');
      setFinalLinkUrl('');
      setCorrectionsText('');
      setStatusChangeDialogOpen(true);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedStatus) {
      toast.error("Please select a status");
      return;
    }

    // OPTIONAL: We no longer enforce corrections text
    // if (selectedStatus === 'corrections_needed' && !correctionsText.trim()) { ... }

    try {
      const updateData: any = {
        approval_status: selectedStatus,
        is_approved: selectedStatus === 'approved' // Sync boolean flag
      };

      // Note: In Supabase schema we use video_feedback table mostly, but let's see if we should also update correction_notes/feedback column on version if exists
      // The schema has `correction_notes` and `feedback` text columns on video_versions too.
      // We will update them for backward compatibility or simple display.

      if (selectedStatus === 'corrections_needed' && correctionsText.trim()) {
        updateData.correction_notes = correctionsText;
        updateData.feedback = correctionsText; // Sync both for safety

        // Also insert into video_feedback table for history
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || "User";
          await supabase.from('video_feedback').insert({
            project_id: projectId,
            version_id: selectedVersionForStatusChange.id,
            user_id: user.id,
            user_name: userName,
            user_email: user.email,
            comment_text: correctionsText,
            is_resolved: false
          });
        }
      }

      const { error } = await supabase
        .from('video_versions')
        .update(updateData)
        .eq('id', selectedVersionForStatusChange.id);

      if (error) throw error;

      toast.success(`Version status updated to ${selectedStatus.replace('_', ' ')}`);

      // Send approval notification if status is approved
      if (selectedStatus === 'approved') {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', projectId)
          .single();

        if (user) {
          console.log('🎉 Sending approval notification from handleStatusChange');
          notificationTriggers.projectApproved({
            projectId,
            projectName: project?.name || 'Project',
            approverId: user.id
          });
        }
      }

      setStatusChangeDialogOpen(false);
      setSelectedVersionForStatusChange(null);
      setSelectedStatus('');
      setFinalLinkUrl('');
      setCorrectionsText('');
      onVersionsUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleApprovalAction = async (versionId: string, status: 'approved' | 'rejected' | 'corrections_needed') => {
    if (status === 'corrections_needed') {
      const version = safeVersions.find(v => v.id === versionId);
      setSelectedVersionForFeedback(version);
      setFeedbackText(version?.feedback || "");
      setFeedbackDialogOpen(true);
      return;
    }

    if (status === 'approved') {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
          .from('video_versions')
          .update({
            approval_status: 'approved',
            is_approved: true,
            final_link_requested: true
          })
          .eq('id', versionId);

        if (error) throw error;
        toast.success("Version approved!");

        // Get project name for notification
        const { data: project } = await supabase
          .from('projects')
          .select('name')
          .eq('id', projectId)
          .single();

        // Send approval notification to all project members
        if (user) {
          notificationTriggers.projectApproved({
            projectId,
            projectName: project?.name || 'Project',
            approverId: user.id
          });
        }

        onVersionsUpdate();
      } catch (error) {
        console.error("Error updating approval status:", error);
        toast.error("Failed to update approval status");
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('video_versions')
        .update({
          approval_status: status,
          is_approved: false
        })
        .eq('id', versionId);

      if (error) throw error;
      toast.success(`Version ${status}`);
      onVersionsUpdate();
    } catch (error) {
      console.error("Error updating approval status:", error);
      toast.error("Failed to update approval status");
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      toast.error("Please enter feedback");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Add feedback as a new entry in video_feedback table
      const { error: insertError } = await supabase
        .from('video_feedback')
        .insert({
          project_id: projectId,
          version_id: selectedVersionForFeedback.id,
          user_id: user.id,
          comment_text: feedbackText,
          is_resolved: false
        });

      if (insertError) throw insertError;

      if (insertError) throw insertError;

      // Auto-update version status handled by DB trigger (handle_new_feedback_update_status)
      // We don't manually update to avoid RLS 400 errors for clients

      toast.success("Feedback added successfully");

      // Get project name for notification
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', projectId)
        .single();

      // Send notification to all project members
      notificationTriggers.feedbackAdded({
        projectId,
        projectName: project?.name || 'Project',
        feedbackAuthorId: user.id,
        feedbackContent: feedbackText
      });

      // Close the feedback dialog first
      setFeedbackDialogOpen(false);
      setFeedbackText("");

      // Reload everything to show updated counts and data
      await Promise.all([
        loadFeedbackSummary(),
        onVersionsUpdate()
      ]);

      // If we came from viewing feedback, reload and show the updated feedback
      if (viewingFeedback && viewingFeedback.id === selectedVersionForFeedback.id) {
        await loadVersionFeedback(selectedVersionForFeedback.id);
      }

      setSelectedVersionForFeedback(null);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback");
    }
  };

  const handleViewFeedback = (version: any) => {
    setViewingFeedback(version);
    loadVersionFeedback(version.id); // Load detailed feedback
  };

  const handleRequestFinalLink = (version: any) => {
    setSelectedVersionForFinalLink(version);
    setNewFinalLink('');
    setFinalLinkDialogOpen(true);
  };

  const handleAddFinalLink = async () => {
    if (!newFinalLink.trim()) {
      toast.error("Please provide final link");
      return;
    }

    if (!isValidUrl(newFinalLink)) {
      toast.error("Please enter a valid URL");
      return;
    }

    try {
      const { error } = await supabase
        .from('video_versions')
        .update({
          final_url: newFinalLink,
          final_link_requested: false
        })
        .eq('id', selectedVersionForFinalLink.id);

      if (error) throw error;

      toast.success("Final link added successfully");
      setFinalLinkDialogOpen(false);
      setSelectedVersionForFinalLink(null);
      setNewFinalLink('');
      onVersionsUpdate();
    } catch (error) {
      console.error("Error adding final link:", error);
      toast.error("Failed to add final link");
    }
  };


  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingVersion(null);
    setFormData({ preview_url: "", final_url: "" });
  };

  const getApprovalBadge = (status: string, version: any) => {
    const variants: Record<string, any> = {
      pending: { variant: "secondary", label: "Pending", icon: AlertCircle },
      approved: { variant: "outline", label: "Approved", icon: CheckCircle, className: "bg-primary/10 text-primary border-primary/30" },
      rejected: { variant: "destructive", label: "Rejected", icon: XCircle },
      corrections_needed: { variant: "outline", label: "Corrections Needed", icon: AlertCircle, className: "bg-yellow-50 text-yellow-700 border-yellow-300" }
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    const isClickable = (userRole === 'client' || isProjectCreator) && status === 'pending';

    return (
      <Badge
        variant={config.variant}
        className={`text-xs ${config.className} ${isClickable ? 'cursor-pointer hover:opacity-80' : ''}`}
        onClick={isClickable ? () => handleStatusClick(version) : undefined}
      >
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
        {isClickable && <ChevronDown className="w-3 h-3 ml-1" />}
      </Badge>
    );
  };

  // Mobile card layout for versions
  const renderVersionCard = (version: any) => {
    const summary = feedbackSummary[version.id];

    return (
      <Card key={version.id} className="mb-3 shadow-sm">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Header with version and status */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-sm">Version {version.version_number}</h4>
                <p className="text-xs text-muted-foreground">{new Date(version.created_at).toLocaleDateString()}</p>
              </div>
              {getApprovalBadge(version.approval_status, version)}
            </div>

            {/* Video Links */}
            <div className="space-y-2">
              {version.preview_url ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-9 text-xs justify-center"
                  onClick={() => navigate(`/video-preview/${version.id}`)}
                >
                  <Play className="w-3 h-3 mr-2" />
                  Watch & Review
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">No preview link</span>
              )}

              {version.final_url && (
                <a
                  href={version.final_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-primary hover:underline text-xs"
                >
                  <LinkIcon className="w-3 h-3" />
                  Final Link
                </a>
              )}
            </div>

            {/* Feedback count */}
            {summary && summary.total_feedback > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full h-9 text-xs"
                onClick={() => loadVersionFeedback(version.id)}
              >
                <MessageSquare className="w-3 h-3 mr-2" />
                {summary.total_feedback} Feedback
              </Button>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {/* Client Actions */}
              {userRole === 'client' && version.approval_status === 'pending' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs bg-primary/10 border-primary/30 text-primary"
                    onClick={() => handleApprovalAction(version.id, 'approved')}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 h-8 text-xs"
                    onClick={() => handleApprovalAction(version.id, 'rejected')}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-8 text-xs bg-yellow-50 text-yellow-700 border-yellow-300"
                    onClick={() => handleApprovalAction(version.id, 'corrections_needed')}
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Corrections Needed
                  </Button>
                </>
              )}

              {userRole === 'client' && version.approval_status !== 'pending' && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs"
                  onClick={() => handleStatusClick(version)}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Change Status
                </Button>
              )}

              {/* Editor Actions */}
              {(userRole === 'editor' || isProjectCreator) && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-xs"
                    onClick={() => handleEdit(version)}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  {version.approval_status === 'pending' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 h-8 text-xs"
                      onClick={() => handleDelete(version.id)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  )}
                  {/* Allow creator to change status anytime */}
                  {isProjectCreator && version.approval_status !== 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 h-8 text-xs"
                      onClick={() => handleStatusClick(version)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Change Status
                    </Button>
                  )}
                </>
              )}

              {/* Final Link Management */}
              {version.approval_status === 'approved' && !version.final_url && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs bg-primary/10 border-primary/30 text-primary"
                  onClick={() => handleRequestFinalLink(version)}
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  Add Final Link
                </Button>
              )}

              {version.final_url && (userRole === 'editor' || isProjectCreator) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs"
                  onClick={() => handleRequestFinalLink(version)}
                >
                  <LinkIcon className="w-3 h-3 mr-1" />
                  Update Final Link
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Card className="shadow-elegant">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">
                {sectionTitle || "Video Versions"}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Manage different versions of the project video
              </CardDescription>
            </div>
            {(userRole === 'editor' || isProjectCreator) && (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-xs sm:text-sm"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Version</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {safeVersions.length === 0 ? (
            <p className="text-muted-foreground text-center py-6 sm:py-8 text-xs sm:text-sm">No versions added yet</p>
          ) : (
            <>
              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-3">
                {safeVersions.map(version => renderVersionCard(version))}
              </div>

              {/* Desktop Table Layout */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Version</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden sm:table-cell">Created</TableHead>
                      <TableHead className="text-xs sm:text-sm">File Link</TableHead>
                      <TableHead className="text-xs sm:text-sm">Status</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell">Feedback</TableHead>
                      <TableHead className="text-xs sm:text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {safeVersions.map((version) => {
                      const summary = feedbackSummary[version.id];
                      return (
                        <TableRow key={version.id}>
                          <TableCell className="font-medium text-xs sm:text-sm">v{version.version_number}</TableCell>
                          <TableCell className="text-xs sm:text-sm hidden sm:table-cell">{new Date(version.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              {version.preview_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={() => navigate(`/video-preview/${version.id}`)}
                                >
                                  <Play className="w-3 h-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Watch & Review</span>
                                </Button>
                              )}
                              {version.final_url && (
                                <div className="flex items-center gap-2">
                                  <a
                                    href={version.final_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline text-xs inline-flex items-center gap-1"
                                  >
                                    <LinkIcon className="w-3 h-3" />
                                    Final Link
                                  </a>
                                </div>
                              )}
                              {!version.preview_url && !version.final_url && (
                                <span className="text-muted-foreground">Not added</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">{getApprovalBadge(version.approval_status, version)}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {summary && summary.total_feedback > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                onClick={() => loadVersionFeedback(version.id)}
                              >
                                <MessageSquare className="w-3 h-3 sm:mr-1" />
                                <span className="hidden sm:inline">{summary.total_feedback} feedback</span>
                                <span className="sm:hidden">{summary.total_feedback}</span>
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-xs">No feedback</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 sm:gap-2 flex-wrap">
                              {/* Client Actions */}
                              {userRole === 'client' && (
                                <>
                                  {version.approval_status === 'pending' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs bg-primary/10 border-primary/30 text-primary"
                                        onClick={() => handleApprovalAction(version.id, 'approved')}
                                      >
                                        <CheckCircle className="w-3 h-3 sm:mr-1" />
                                        <span className="hidden sm:inline">Approve</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        className="h-8 text-xs"
                                        onClick={() => handleApprovalAction(version.id, 'rejected')}
                                      >
                                        <XCircle className="w-3 h-3 sm:mr-1" />
                                        <span className="hidden sm:inline">Reject</span>
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs bg-yellow-50 text-yellow-700 border-yellow-300"
                                        onClick={() => handleApprovalAction(version.id, 'corrections_needed')}
                                      >
                                        <AlertCircle className="w-3 h-3 sm:mr-1" />
                                        <span className="hidden sm:inline">Corrections</span>
                                      </Button>
                                    </>
                                  )}
                                  {version.approval_status !== 'pending' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs"
                                      onClick={() => handleStatusClick(version)}
                                    >
                                      <Edit className="w-3 h-3 sm:mr-1" />
                                      <span className="hidden sm:inline">Change</span>
                                    </Button>
                                  )}
                                </>
                              )}

                              {/* Editor/Creator Actions */}
                              {(userRole === 'editor' || isProjectCreator) && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    onClick={() => handleEdit(version)}
                                  >
                                    <Edit className="w-3 h-3 sm:mr-1" />
                                    <span className="hidden sm:inline">Edit</span>
                                  </Button>
                                  {version.approval_status === 'pending' && (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="h-8 text-xs"
                                      onClick={() => handleDelete(version.id)}
                                    >
                                      <Trash2 className="w-3 h-3 sm:mr-1" />
                                      <span className="hidden sm:inline">Delete</span>
                                    </Button>
                                  )}
                                  {isProjectCreator && version.approval_status !== 'pending' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 text-xs"
                                      onClick={() => handleStatusClick(version)}
                                    >
                                      <Edit className="w-3 h-3 sm:mr-1" />
                                      <span className="hidden sm:inline">Change Status</span>
                                    </Button>
                                  )}
                                </>
                              )}

                              {/* Final Link Management - For Everyone */}
                              {version.approval_status === 'approved' && !version.final_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs bg-primary/10 border-primary/30 text-primary"
                                  onClick={() => handleRequestFinalLink(version)}
                                >
                                  <LinkIcon className="w-3 h-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Add Final</span>
                                </Button>
                              )}

                              {version.final_url && (userRole === 'editor' || isProjectCreator) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs"
                                  onClick={() => handleRequestFinalLink(version)}
                                >
                                  <LinkIcon className="w-3 h-3 sm:mr-1" />
                                  <span className="hidden sm:inline">Update Final</span>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Version Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{editingVersion ? "Edit Version" : "Add New Version"}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {editingVersion ? "Update the version details" : "Add a new video version"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <Label htmlFor="preview_url" className="text-xs sm:text-sm">Preview URL *</Label>
                <Input
                  id="preview_url"
                  type="url"
                  placeholder="https://..."
                  value={formData.preview_url}
                  onChange={(e) => setFormData({ ...formData, preview_url: e.target.value })}
                  className="mt-1.5 h-9 text-xs sm:text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">Enter the Google Drive or video hosting URL</p>
              </div>
              <div>
                <Label htmlFor="final_url" className="text-xs sm:text-sm">Final URL (Optional)</Label>
                <Input
                  id="final_url"
                  type="url"
                  placeholder="https://..."
                  value={formData.final_url}
                  onChange={(e) => setFormData({ ...formData, final_url: e.target.value })}
                  className="mt-1.5 h-9 text-xs sm:text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">Add final approved version link</p>
              </div>
            </div>
            <DialogFooter className="mt-4 sm:mt-6 flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" size="sm" className="text-xs sm:text-sm h-9" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button type="submit" variant="outline" size="sm" className="text-xs sm:text-sm h-9 bg-primary/10 border-primary/30 text-primary">
                {editingVersion ? "Update" : "Add"} Version
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Feedback Dialog */}
      <Dialog open={feedbackDialogOpen} onOpenChange={setFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Add Corrections Feedback</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Provide detailed feedback about what needs to be corrected in Version {selectedVersionForFeedback?.version_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your detailed feedback here... You can use formatting and be as descriptive as needed."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              rows={10}
              className="resize-none text-sm"
            />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setFeedbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitFeedback} size="sm">
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Feedback Dialog */}
      <Dialog open={viewFeedbackDialogOpen} onOpenChange={setViewFeedbackDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Feedback for Version {viewingFeedback?.version_number}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              History of feedback and corrections
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add Feedback Input */}
            <div className="space-y-2 border-b pb-4">
              <Label className="text-xs sm:text-sm">Add Feedback</Label>
              <div className="flex gap-2 flex-col sm:flex-row">
                <Textarea
                  placeholder="Type your feedback here..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  className="min-h-[60px] text-sm resize-none flex-1"
                />
                <Button size="sm" onClick={handleAddFeedbackFromDialog} className="h-auto self-end sm:self-auto py-2">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
            {/* Show current version note first */}
            {viewingFeedback?.correction_notes && (
              <div className="bg-muted p-4 rounded-lg whitespace-pre-wrap text-sm border-l-4 border-yellow-400">
                <p className="font-semibold mb-1 text-xs uppercase tracking-wider text-muted-foreground">Latest Note</p>
                {viewingFeedback.correction_notes}
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Feedback History</h4>
              {currentVersionFeedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feedback history found.</p>
              ) : (
                currentVersionFeedback.map((item: any) => (
                  <div key={item.id} className="border rounded-md p-3 text-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-xs text-muted-foreground">
                        {item.user_name || item.user_email || "Unknown User"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{item.comment_text}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setViewFeedbackDialogOpen(false)} size="sm">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusChangeDialogOpen} onOpenChange={setStatusChangeDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Change Version Status</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Update the status for Version {selectedVersionForStatusChange?.version_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="status-select" className="text-xs sm:text-sm">Select Status</Label>
              <select
                id="status-select"
                className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">Select a status...</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="corrections_needed">Corrections Needed</option>
              </select>
            </div>

            {/* Show additional inputs based on selected status */}
            {selectedStatus === 'corrections_needed' && (
              <div className="space-y-2">
                <Label htmlFor="corrections" className="text-xs sm:text-sm">Correction Notes</Label>
                <Textarea
                  id="corrections"
                  placeholder="Please specify what needs to be changed..."
                  value={correctionsText}
                  onChange={(e) => setCorrectionsText(e.target.value)}
                  className="resize-none min-h-[100px] text-sm"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setStatusChangeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} size="sm" disabled={!selectedStatus}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Final Link Dialog */}
      <Dialog open={finalLinkDialogOpen} onOpenChange={setFinalLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Add Final Link</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Add the final approved video link for Version {selectedVersionForFinalLink?.version_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="final_link" className="text-xs sm:text-sm">Final Video URL *</Label>
              <Input
                id="final_link"
                type="url"
                placeholder="https://..."
                value={newFinalLink}
                onChange={(e) => setNewFinalLink(e.target.value)}
                className="mt-1.5 h-9 text-xs sm:text-sm"
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setFinalLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFinalLink} size="sm">
              Add Final Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
