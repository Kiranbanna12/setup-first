import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, UserPlus, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notificationService } from "@/lib/notifications";

interface Invitation {
  id: string;
  inviter_id: string;
  invitee_email: string;
  invitation_type: 'editor' | 'client';
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
  created_at: string;
  inviter_name?: string;
  inviter_email?: string;
  inviter_avatar?: string;
}

interface InvitationCardProps {
  invitation: Invitation;
  onStatusChange: () => void;
}

export function InvitationCard({ invitation, onStatusChange }: InvitationCardProps) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update invitation status
      // @ts-ignore
      const { error } = await (supabase as any)
        .from("invitations")
        .update({
          status: 'accepted',
          invitee_id: user.id,
          responded_at: new Date().toISOString()
        })
        .eq("id", invitation.id);

      if (error) throw error;

      // Send notification to inviter
      await notificationService.create({
        userId: invitation.inviter_id,
        type: 'project_assigned',
        priority: 'important',
        title: 'Invitation Accepted',
        message: `Your ${invitation.invitation_type} invitation has been accepted!`,
        link: invitation.invitation_type === 'editor' ? '/editors' : '/clients',
        metadata: { invitation_id: invitation.id }
      });

      toast.success("Invitation accepted!");
      onStatusChange();
    } catch (error) {
      console.error("Error accepting invitation:", error);
      toast.error("Failed to accept invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update invitation status
      // @ts-ignore
      const { error } = await (supabase as any)
        .from("invitations")
        .update({
          status: 'rejected',
          invitee_id: user.id,
          responded_at: new Date().toISOString()
        })
        .eq("id", invitation.id);

      if (error) throw error;

      // Send notification to inviter
      await notificationService.create({
        userId: invitation.inviter_id,
        type: 'project_assigned',
        priority: 'info',
        title: 'Invitation Declined',
        message: `Your ${invitation.invitation_type} invitation was declined.`,
        link: invitation.invitation_type === 'editor' ? '/editors' : '/clients',
        metadata: { invitation_id: invitation.id }
      });

      toast.success("Invitation declined");
      onStatusChange();
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      toast.error("Failed to decline invitation");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Card className="border-primary/30 bg-primary/5 shadow-sm">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            {invitation.inviter_avatar ? (
              <img
                src={invitation.inviter_avatar}
                alt={invitation.inviter_name || "User"}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm sm:text-base truncate">
                {invitation.inviter_name || invitation.inviter_email || "Someone"} invited you
              </p>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px] sm:text-xs">
                  as {invitation.invitation_type === 'editor' ? 'Editor' : 'Client'}
                </Badge>
                <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  {formatDate(invitation.created_at)}
                </span>
              </div>
              {invitation.message && (
                <p className="text-xs sm:text-sm text-muted-foreground mt-2 italic line-clamp-2">
                  "{invitation.message}"
                </p>
              )}
            </div>
          </div>

          {invitation.status === 'pending' && (
            <div className="flex gap-2 w-full sm:w-auto flex-shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 sm:flex-none border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs sm:text-sm h-8 sm:h-9"
                onClick={handleReject}
                disabled={loading}
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                Decline
              </Button>
              <Button
                size="sm"
                className="flex-1 sm:flex-none bg-success hover:bg-success/90 text-success-foreground text-xs sm:text-sm h-8 sm:h-9"
                onClick={handleAccept}
                disabled={loading}
              >
                <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                Accept
              </Button>
            </div>
          )}

          {invitation.status === 'accepted' && (
            <Badge className="bg-success text-success-foreground text-xs">Accepted</Badge>
          )}

          {invitation.status === 'rejected' && (
            <Badge variant="destructive" className="text-xs">Declined</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
