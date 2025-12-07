import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { InvitationCard } from "./InvitationCard";
import { Bell } from "lucide-react";

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

interface PendingInvitationsProps {
  type?: 'editor' | 'client' | 'all';
  onUpdate?: () => void;
}

export function PendingInvitations({ type = 'all', onUpdate }: PendingInvitationsProps) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvitations();
  }, [type]);

  const loadInvitations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle();

      const userEmail = profile?.email?.toLowerCase().trim() || "";

      // Get pending invitations for this user
      // @ts-ignore
      let query = (supabase as any)
        .from("invitations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (type !== 'all') {
        query = query.eq("invitation_type", type);
      }

      const { data: invitationsData, error } = await query;

      if (error) {
        console.error("Error loading invitations:", error);
        return;
      }

      // Filter to only invitations where email matches
      const myInvitations = (invitationsData || []).filter((inv: any) => 
        inv.invitee_email?.toLowerCase().trim() === userEmail ||
        inv.invitee_id === user.id
      );

      // Get inviter profiles
      const inviterIds = myInvitations.map((inv: any) => inv.inviter_id).filter(Boolean);
      let inviterProfiles: any[] = [];

      if (inviterIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", inviterIds);
        inviterProfiles = profiles || [];
      }

      // Enrich invitations with inviter info
      const enrichedInvitations = myInvitations.map((inv: any) => {
        const inviter = inviterProfiles.find((p: any) => p.id === inv.inviter_id);
        return {
          ...inv,
          inviter_name: inviter?.full_name,
          inviter_email: inviter?.email,
          inviter_avatar: inviter?.avatar_url
        };
      });

      setInvitations(enrichedInvitations);
    } catch (error) {
      console.error("Error loading invitations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = () => {
    loadInvitations();
    onUpdate?.();
  };

  if (loading) {
    return null;
  }

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Bell className="w-5 h-5" />
        <h3 className="font-semibold">Pending Invitations ({invitations.length})</h3>
      </div>
      <div className="space-y-3">
        {invitations.map((invitation) => (
          <InvitationCard
            key={invitation.id}
            invitation={invitation}
            onStatusChange={handleStatusChange}
          />
        ))}
      </div>
    </div>
  );
}
