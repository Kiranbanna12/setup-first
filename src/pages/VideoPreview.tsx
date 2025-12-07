import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { UniversalVideoPlayer } from "@/components/video-preview/UniversalVideoPlayer";
import { FeedbackList } from "@/components/video-preview/FeedbackList";
import { FeedbackForm } from "@/components/video-preview/FeedbackForm";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft, GitCompare, Share2, Download, Check, Shield, CheckCircle, Filter, Clock } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

// Define types locally for now to ensure self-containment, 
// though they should ideally come from a types file.
interface Project {
  id: string;
  name: string;
  status: string;
  thumbnail_url?: string;
}

interface VideoVersion {
  id: string;
  version_number: number;
  preview_url?: string;
  final_url?: string;
  video_url?: string; // Legacy/Compat
  created_at: string;
  description?: string;
  approval_status?: string;
}

interface VideoFeedback {
  id: string;
  project_id: string;
  version_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  comment_text: string;
  timestamp_seconds: number;
  is_resolved: boolean;
  replies?: any[];
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    email: string;
    avatar_url: string;
  };
}

export default function VideoPreview() {
  const { versionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const shareToken = searchParams.get("share"); // Fixed: was "token", now matches SharedVersionManagement

  // State
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [versions, setVersions] = useState<VideoVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<VideoVersion | null>(null);
  const [compareVersion, setCompareVersion] = useState<VideoVersion | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [sharePermissions, setSharePermissions] = useState<any>(null);

  const [feedback, setFeedback] = useState<VideoFeedback[]>([]);
  const [compareFeedback, setCompareFeedback] = useState<VideoFeedback[]>([]);

  const [currentTime, setCurrentTime] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const playerRef = useRef<any>(null);
  const comparePlayerRef = useRef<any>(null);

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      if (!versionId) return;

      setIsLoading(true);
      try {
        // 1. Get User Session
        const { data: { session } } = await supabase.auth.getSession();
        setCurrentUser(session?.user || null);

        // 2. If we have a share token, use RPC to fetch data (bypasses RLS)
        if (shareToken) {
          const { data, error } = await (supabase.rpc as any)('get_video_version_by_share', {
            version_id_input: versionId,
            share_token_input: shareToken
          });

          if (error || !data || data.error) {
            console.error("Error fetching shared version:", error || data?.error);
            toast.error(data?.error || "Failed to load shared version");
            setIsLoading(false);
            return;
          }

          // Set data from RPC response
          setCurrentVersion(data.version as VideoVersion);
          setProject(data.project as Project);
          setVersions((data.versions || []) as VideoVersion[]);
          setProjectId(data.version.project_id);
          setSharePermissions(data.share);

          // Map RPC feedback to include profiles structure
          const mappedFeedback = (data.feedback || []).map((item: any) => ({
            ...item,
            profiles: {
              full_name: item.user_name || 'Anonymous',
              email: item.user_email || '',
              avatar_url: null
            }
          }));
          setFeedback(mappedFeedback as VideoFeedback[]);

        } else {
          // 3. Normal authenticated access - Fetch version directly
          const { data: requestedVersion, error: versionError } = await supabase
            .from("video_versions")
            .select("*")
            .eq("id", versionId)
            .single();

          if (versionError || !requestedVersion) {
            console.error("Error fetching version:", versionError);
            toast.error("Version not found");
            setIsLoading(false);
            return;
          }

          setCurrentVersion(requestedVersion as unknown as VideoVersion);

          const resolvedProjectId = requestedVersion.project_id;

          if (!resolvedProjectId) {
            toast.error("Invalid project data");
            return;
          }

          setProjectId(resolvedProjectId);

          // 4. Get Project Details
          const { data: projectData, error: projectError } = await supabase
            .from("projects")
            .select("*")
            .eq("id", resolvedProjectId)
            .single();

          if (projectError) {
            console.error("Error fetching project:", projectError);
            toast.error("Could not load project details.");
          }

          if (projectData) {
            setProject(projectData);
          }

          // 5. Get All Video Versions for this project
          const { data: versionsData, error: versionsError } = await supabase
            .from("video_versions")
            .select("*")
            .eq("project_id", resolvedProjectId)
            .order("version_number", { ascending: false });

          if (versionsError) throw versionsError;

          if (versionsData) {
            setVersions(versionsData as unknown as VideoVersion[]);
          }
        }

      } catch (error: any) {
        console.error("Error in data fetch:", error);
        toast.error("Failed to load request");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [versionId, shareToken]);

  // Fetch Feedback when Current Version Changes
  useEffect(() => {
    if (!currentVersion) return;

    // Only call fetchFeedback if NOT the initial load triggered by fetchData (which already loaded feedback)
    // For subsequent version changes or compare, always fetch
    const isInitialSharedLoad = shareToken && currentVersion.id === versionId;

    if (!isInitialSharedLoad) {
      fetchFeedback(currentVersion.id, setFeedback);
    }

    // Subscribe to Realtime Changes for Feedback - ALWAYS set up the subscription
    const channel = supabase
      .channel(`feedback-${currentVersion.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_feedback",
          filter: `version_id=eq.${currentVersion.id}`,
        },
        () => {
          // Use RPC-aware fetchFeedback which handles shareToken internally
          fetchFeedback(currentVersion.id, setFeedback);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentVersion, shareToken]);

  // Fetch Compare Feedback
  useEffect(() => {
    if (!compareVersion || !isComparing) return;

    fetchFeedback(compareVersion.id, setCompareFeedback);

    const channel = supabase
      .channel(`feedback-${compareVersion.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_feedback",
          filter: `version_id=eq.${compareVersion.id}`,
        },
        () => {
          fetchFeedback(compareVersion.id, setCompareFeedback);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };

  }, [compareVersion, isComparing]);

  const fetchFeedback = async (targetVersionId: string, setFn: React.Dispatch<React.SetStateAction<VideoFeedback[]>>) => {
    try {
      let data: any[] = [];

      if (shareToken) {
        // USE RPC for shared links to bypass RLS
        const { data: rpcData, error } = await (supabase.rpc as any)('get_video_version_by_share', {
          version_id_input: targetVersionId,
          share_token_input: shareToken
        });

        if (error) {
          console.error("Error fetching shared feedback via RPC:", error);
          return;
        }

        if (rpcData && rpcData.feedback) {
          data = rpcData.feedback;
        }
      } else {
        // Normal authenticated fetch
        const { data: dbData, error } = await supabase
          .from("video_feedback")
          .select("*")
          .eq("version_id", targetVersionId)
          .order("timestamp_seconds", { ascending: true });

        if (error) {
          console.error("Error fetching feedback:", error);
          return;
        }
        data = dbData || [];
      }

      // Map the data to include profiles structure for compatibility
      const mappedData = data.map((item: any) => ({
        ...item,
        profiles: {
          full_name: item.user_name || 'Anonymous',
          email: item.user_email || '',
          avatar_url: null
        }
      }));
      setFn(mappedData as VideoFeedback[]);
    } catch (err) {
      console.error("Fetch feedback exception:", err);
    }
  };

  // Handlers
  const handleSeek = (time: number) => {
    playerRef.current?.seekTo(time);
    if (isComparing && comparePlayerRef.current) {
      comparePlayerRef.current.seekTo(time);
    }
  };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
    // Sync comparison player if needed
    // Note: Ideally we sync them more tightly, but for now simple driving is okay
  };

  const handleAddFeedback = async (comment: string, timestamp?: number) => {
    // Allow if authenticated OR if we have a valid share token with edit permissions
    // Note: Inserting as anonymous/shared user requires backend support users currently don't have.
    // However, the user asked to "fix logic". 
    // If shareToken permits edit, we should ideally allow it. 
    // BUT since we don't have a specific "add_feedback_shared" RPC yet and RLS blocks public inserts,
    // we keep the "must be logged in" check for now unless the user specifically asks for anonymous comments.
    // The main issue reported was VISIBILITY.

    if (!currentUser) {
      toast.error("You must be logged in to add feedback.");
      return;
    }
    if (!currentVersion) return;

    const { error } = await supabase
      .from("video_feedback")
      .insert({
        project_id: projectId,
        version_id: currentVersion.id, // Updated column name
        user_id: currentUser.id,
        comment_text: comment,
        timestamp_seconds: Math.round(timestamp ?? currentTime),
        user_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0],
        user_email: currentUser.email
      });

    if (error) {
      toast.error("Failed to submit feedback");
      console.error(error);
    } else {
      toast.success("Feedback submitted");

      // Auto-update version status to corrections_needed if not already
      // The database trigger handles the actual status update securely
      if (currentVersion.approval_status !== 'corrections_needed') {
        // Optimistically update local state so badges update immediately
        setCurrentVersion(prev => prev ? ({ ...prev, approval_status: 'corrections_needed' }) : null);
        toast.info("Status marked as Changes Requested");
      }
      // Realtime will update the list
    }
  };

  const handleResolveFeedback = async (feedbackId: string, resolved: boolean) => {
    if (!currentUser && !shareToken) return;

    const { error } = await supabase
      .from("video_feedback")
      .update({ is_resolved: resolved })
      .eq("id", feedbackId);

    if (error) toast.error("Failed to update status");
  };

  const handleDeleteFeedback = async (feedbackId: string, rootId?: string) => {
    // OPTIMISTIC UPDATE: Remove from UI immediately
    setFeedback((prev) => {
      if (rootId && rootId !== feedbackId) {
        // Deleting a reply
        return prev.map((item) => {
          if (item.id === rootId) {
            const replies = (item.replies as any[]) || [];
            return {
              ...item,
              replies: replies.filter((r: any) => r.id !== feedbackId),
            };
          }
          return item;
        });
      } else {
        // Deleting a main feedback
        return prev.filter((item) => item.id !== feedbackId);
      }
    });

    // If it's a reply (rootId is provided and different from feedbackId)
    if (rootId && rootId !== feedbackId) {
      const { data: parentItem } = await supabase
        .from("video_feedback")
        .select("replies")
        .eq("id", rootId)
        .single();

      if (parentItem) {
        const parentData = parentItem as any;
        const currentReplies = (parentData.replies as any[]) || [];

        // Filter out the reply to delete it
        const updatedReplies = currentReplies.filter((reply: any) => reply.id !== feedbackId);

        const { error } = await supabase
          .from("video_feedback")
          .update({ replies: updatedReplies })
          .eq("id", rootId);

        if (error) {
          toast.error("Failed to delete reply");
          console.error(error);
          // Revert optimistic update ideally, but for now just notify
          fetchFeedback(versionId!, setFeedback); // Re-fetch to restore state
        } else {
          toast.success("Reply deleted");
        }
      }
      return;
    }

    // Normal feedback delete
    const { error } = await supabase
      .from("video_feedback")
      .delete()
      .eq("id", feedbackId);

    if (error) {
      toast.error("Failed to delete feedback");
      fetchFeedback(versionId!, setFeedback); // Re-fetch to restore state
    }
  };

  const handleEditFeedback = async (feedbackId: string, newText: string, rootId?: string) => {
    // OPTIMISTIC UPDATE
    setFeedback((prev) => {
      if (rootId && rootId !== feedbackId) {
        // Editing a reply
        return prev.map((item) => {
          if (item.id === rootId) {
            const replies = (item.replies as any[]) || [];
            const updatedReplies = replies.map((r: any) => {
              if (r.id === feedbackId) {
                return { ...r, comment_text: newText, updated_at: new Date().toISOString() };
              }
              return r;
            });
            return { ...item, replies: updatedReplies };
          }
          return item;
        });
      } else {
        // Editing main feedback
        return prev.map((item) => {
          if (item.id === feedbackId) {
            return { ...item, comment_text: newText, updated_at: new Date().toISOString() };
          }
          return item;
        });
      }
    });

    // If it's a reply (rootId is provided and different from feedbackId), we need to update the JSONB
    if (rootId && rootId !== feedbackId) {
      const { data: parentItem } = await supabase
        .from("video_feedback")
        .select("replies")
        .eq("id", rootId)
        .single();

      if (parentItem) {
        const parentData = parentItem as any;
        let currentReplies = (parentData.replies as any[]) || [];

        // Find and update the specific reply
        const updatedReplies = currentReplies.map((reply: any) => {
          if (reply.id === feedbackId) {
            // Keep existing edit history or create new
            const now = new Date().toISOString();
            const editHistory = typeof reply.edit_history === 'string'
              ? JSON.parse(reply.edit_history)
              : (reply.edit_history || []);

            // Add current state to history before updating
            editHistory.push({
              previousText: reply.comment_text,
              editedAt: now
            });

            return {
              ...reply,
              comment_text: newText,
              updated_at: now,
              edit_history: editHistory
            };
          }
          return reply;
        });

        const { error } = await supabase
          .from("video_feedback")
          .update({ replies: updatedReplies })
          .eq("id", rootId);

        if (error) {
          toast.error("Failed to edit reply");
          console.error(error);
          fetchFeedback(versionId!, setFeedback);
        } else {
          toast.success("Reply updated");
        }
      }
      return;
    }

    // Normal feedback update
    // Fetch existing logic first to append history
    // For brevity, assuming standard update logic (simplified here)
    const now = new Date().toISOString();
    // ... (fetch old, update history, save)
    // Since this is a massive block, relying on existing logic above or simplified update
    // Re-implementing simplified update for robustness within this block:

    const { data: currentData } = await supabase.from("video_feedback").select("edit_history, comment_text").eq("id", feedbackId).single();
    let editHistory = currentData?.edit_history || [];
    if (typeof editHistory === 'string') {
      try { editHistory = JSON.parse(editHistory); } catch (e) { editHistory = []; }
    }
    editHistory.push({ previousText: currentData?.comment_text || "", editedAt: now });

    const { error } = await supabase
      .from("video_feedback")
      .update({
        comment_text: newText,
        updated_at: now,
        edit_history: editHistory
      })
      .eq("id", feedbackId);

    if (error) {
      toast.error("Failed to edit feedback");
      fetchFeedback(versionId!, setFeedback);
    }
  };

  const handleReplyFeedback = async (parentId: string, replyText: string, timestamp?: number) => {
    if ((!currentUser && !shareToken) || !currentVersion) return;

    // Creating a new feedback entry linked to parent is one way, 
    // but the schema might use a JSONB array for replies or a recursive structure.
    // Based on `FeedbackList` expecting `replies` array on the item, 
    // let's assume we update the parent's `replies` column if it's JSONB, 
    // OR we fetch them as children.

    // CHECK: The old app `FeedbackList` maps over `item.replies`.
    // If `video_feedback` is a flat table, we might need to fetch replies separately or use a join.
    // However, often simple apps store replies in a JSONB column on the feedback row itself.
    // Let's assume for now we INSERT into the table with a `parent_id` if logic allows, 
    // OR update the `replies` JSONB column.

    // Strategy: Let's first try to Fetch the item to see its current replies
    const { data: parentItem } = await supabase
      .from("video_feedback")
      .select("replies")
      .eq("id", parentId)
      .single();

    const currentReplies = (parentItem?.replies as any[]) || [];
    const newReply = {
      id: crypto.randomUUID(),
      user_id: currentUser?.id, // Can be null
      user_name: currentUser?.user_metadata?.full_name || "Guest User",
      comment_text: replyText,
      created_at: new Date().toISOString(),
      timestamp_seconds: timestamp
    };

    const updatedReplies = [...currentReplies, newReply];

    const { error } = await supabase
      .from("video_feedback")
      .update({ replies: updatedReplies })
      .eq("id", parentId);

    if (error) {
      console.error("Reply error", error);
      toast.error("Failed to add reply");
    } else {
      toast.success("Reply added");
      // Re-fetch to update UI
      fetchFeedback(currentVersion.id, setFeedback);
    }
  };

  // Helpers
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success text-xs"><CheckCircle className="w-3 h-3 mr-1" /> Approved</Badge>;
      case "corrections_needed": // Supabase enum might be different, mapping to common ones
      case "changes_requested":
        return <Badge variant="destructive" className="bg-destructive text-xs"><Shield className="w-3 h-3 mr-1" /> Changes Requested</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status || "Draft"}</Badge>;
    }
  };

  const handleComparisonToggle = () => {
    if (!isComparing) {
      if (versions.length > 1) {
        setIsComparing(true);
        // Default to next version
        const currentIndex = versions.findIndex(v => v.id === currentVersion?.id);
        const nextVersion = versions[currentIndex + 1] || versions[0];
        if (nextVersion.id !== currentVersion?.id) {
          setCompareVersion(nextVersion);
        }
      } else {
        toast.info("No other versions to compare with");
      }
    } else {
      setIsComparing(false);
      setCompareVersion(null);
    }
  };

  const handleVersionChange = (val: string) => {
    // Navigate instead of just setting state to ensure deep link consistency and data refresh
    const params = new URLSearchParams();
    if (shareToken) params.set('share', shareToken);
    navigate(`/video-preview/${val}?${params.toString()}`);
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project || !currentVersion) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <h1 className="text-2xl font-bold text-destructive">Project Not Found</h1>
        <Button onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        {/* Hide sidebar for shared access */}
        {!shareToken && <AppSidebar />}
        <div className="flex-1 bg-background dark:bg-background">
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4">
                {!shareToken && <SidebarTrigger />}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs sm:text-sm h-8 sm:h-9"
                  onClick={() => {
                    if (shareToken) {
                      navigate(`/shared/${shareToken}`);
                    } else {
                      navigate(`/projects/${project.id}`);
                    }
                  }}
                >
                  <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Back to Project</span>
                  <span className="sm:hidden">Back</span>
                </Button>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Badge variant="outline" className="text-xs">
                  V{currentVersion.version_number}
                </Badge>
                {currentVersion.approval_status === 'approved' && (
                  <Badge className="bg-success text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Approved</span>
                  </Badge>
                )}
              </div>
            </div>
          </header>

          <main className="px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
            <div className="mb-4 sm:mb-6">
              <h1 className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold mb-1 sm:mb-2">{project.name}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Version {currentVersion.version_number} Preview</p>
            </div>

            {/* Video Player and Add Feedback Form - Same Height */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-6">
              {/* Video Player */}
              <div className="lg:col-span-2">
                <Card className="shadow-elegant h-full">
                  <div className="p-0">
                    <UniversalVideoPlayer
                      ref={playerRef}
                      url={currentVersion.preview_url || currentVersion.final_url || ""}
                      onTimeUpdate={handleTimeUpdate}
                    />
                  </div>
                </Card>
              </div>

              {/* Add Feedback Form - Sidebar */}
              <div className="lg:col-span-1">
                <FeedbackForm
                  currentTime={currentTime}
                  onAddFeedback={handleAddFeedback}
                  playerRef={playerRef}
                  disabled={!currentUser || (shareToken && !sharePermissions?.can_edit)}
                  disabledMessage={
                    !currentUser
                      ? "Please login to add feedback"
                      : (shareToken && !sharePermissions?.can_edit)
                        ? "View-only access - feedback disabled"
                        : undefined
                  }
                  videoUrl={currentVersion.preview_url || currentVersion.final_url}
                />
              </div>
            </div>

            {/* Approval Status - Full Width */}
            {currentVersion.approval_status === 'approved' && (
              <Card className="shadow-elegant border-2 border-success/50 mb-4 sm:mb-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2 text-success text-sm sm:text-base font-semibold">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                    Version Approved
                  </div>
                </CardHeader>
                <div className="p-6 pt-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    This version has been approved and is ready for final delivery.
                  </p>
                </div>
              </Card>
            )}

            {/* Version Filter and Comparison Controls */}
            <Card className="shadow-elegant mb-4 sm:mb-6">
              <div className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
                  {/* Version Selector */}
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Filter className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                    <label className="text-xs sm:text-sm font-medium whitespace-nowrap">View:</label>
                    <Select
                      value={currentVersion.id}
                      onValueChange={handleVersionChange}
                    >
                      <SelectTrigger className="flex-1 h-8 sm:h-9 text-xs sm:text-sm">
                        <SelectValue placeholder="Select version" />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.id} value={v.id} className="text-xs sm:text-sm">
                            Version {v.version_number} {v.id === currentVersion.id && "(Current)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Comparison Toggle */}
                  <Button
                    variant={isComparing ? "default" : "outline"}
                    size="sm"
                    className="text-xs sm:text-sm h-8 sm:h-9 w-full sm:w-auto"
                    onClick={handleComparisonToggle}
                    disabled={versions.length < 2}
                  >
                    <GitCompare className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    {isComparing ? "Hide" : "Compare"}
                  </Button>

                  {/* Stats */}
                  <div className="flex items-center gap-2 sm:gap-3 sm:ml-auto flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {feedback.length} Total
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-destructive/10">
                      {feedback.filter(f => !f.is_resolved).length} Open
                    </Badge>
                    <Badge variant="outline" className="text-xs bg-success/10">
                      {feedback.filter(f => f.is_resolved).length} Done
                    </Badge>
                  </div>
                </div>

                {/* Comparison Version Selector */}
                {isComparing && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 flex-1">
                      <GitCompare className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                      <label className="text-xs sm:text-sm font-medium whitespace-nowrap">Compare:</label>
                      <Select
                        value={compareVersion?.id || ""}
                        onValueChange={(val) => {
                          const v = versions.find(v => v.id === val);
                          if (v) setCompareVersion(v);
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8 sm:h-9 text-xs sm:text-sm">
                          <SelectValue placeholder="Select version" />
                        </SelectTrigger>
                        <SelectContent>
                          {versions
                            .filter(v => v.id !== currentVersion.id)
                            .map((v) => (
                              <SelectItem key={v.id} value={v.id} className="text-xs sm:text-sm">
                                Version {v.version_number}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                  </div>
                )}
              </div>
            </Card>

            {/* All Feedback List - Full Width Below */}
            {isComparing && compareVersion ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Current Version Feedback */}
                <div>
                  <div className="mb-2 sm:mb-3">
                    <h3 className="text-sm sm:text-base lg:text-lg font-semibold">
                      Version {currentVersion.version_number} Feedback
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">Current selection</p>
                  </div>
                  <FeedbackList
                    feedback={feedback}
                    onSeekToTimestamp={handleSeek}
                    onResolveFeedback={(shareToken && !sharePermissions?.can_edit) ? () => { } : handleResolveFeedback}
                    onEditFeedback={(shareToken && !sharePermissions?.can_edit) ? () => { } : handleEditFeedback}
                    onDeleteFeedback={(shareToken && !sharePermissions?.can_edit) ? () => { } : handleDeleteFeedback}
                    onReplyToFeedback={(shareToken && !sharePermissions?.can_edit) ? () => { } : handleReplyFeedback}
                    currentUserId={currentUser?.id}
                  />
                </div>

                {/* Comparison Version Feedback */}
                <div>
                  <div className="mb-2 sm:mb-3">
                    <h3 className="text-sm sm:text-base lg:text-lg font-semibold">
                      Version {compareVersion.version_number} Feedback
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">Comparison</p>
                  </div>
                  <FeedbackList
                    feedback={compareFeedback}
                    onSeekToTimestamp={handleSeek} // Seek main player even from comparison feedback
                    currentUserId={currentUser?.id}
                    onResolveFeedback={() => { }} // Read only
                    onEditFeedback={() => { }} // Read only
                    onDeleteFeedback={() => { }} // Read only
                    onReplyToFeedback={() => { }} // Read only
                  />
                </div>
              </div>
            ) : (
              <FeedbackList
                feedback={feedback}
                onSeekToTimestamp={handleSeek}
                onResolveFeedback={(shareToken && !sharePermissions?.can_edit) ? () => { } : handleResolveFeedback}
                onEditFeedback={(shareToken && !sharePermissions?.can_edit) ? () => { } : handleEditFeedback}
                onDeleteFeedback={(shareToken && !sharePermissions?.can_edit) ? () => { } : handleDeleteFeedback}
                onReplyToFeedback={(shareToken && !sharePermissions?.can_edit) ? () => { } : handleReplyFeedback}
                currentUserId={currentUser?.id}
              />
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

