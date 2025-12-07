import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { isAdminEmail } from "@/lib/adminAuth";
import { AdminLayout } from "@/layouts/AdminLayout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Crown } from "lucide-react";
import { toast } from "sonner";

export default function AdminSubscriptions() {
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if user email is in local admin list
    if (!isAdminEmail(user.email)) {
      toast.error("Access denied. Admin only.");
      navigate("/dashboard");
      return;
    }

    loadSubscriptions();
  };

  const loadSubscriptions = async () => {
    try {
      // Fetch subscriptions with plan info
      const { data: subs, error } = await supabase
        .from("user_subscriptions" as any)
        .select(`
          *,
          subscription_plans:plan_id (name, price_inr)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set((subs || []).map((s: any) => s.user_id))];

      // Fetch profiles for those users
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        profilesMap = (profiles || []).reduce((acc: Record<string, any>, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
      }

      // Merge profiles into subscriptions
      const subscriptionsWithProfiles = (subs || []).map((sub: any) => ({
        ...sub,
        profiles: profilesMap[sub.user_id] || { full_name: "N/A", email: "N/A" }
      }));

      setSubscriptions(subscriptionsWithProfiles);
    } catch (error) {
      console.error("Error loading subscriptions:", error);
      toast.error("Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const updateSubscriptionStatus = async (subscriptionId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("user_subscriptions" as any)
        .update({ status: newStatus })
        .eq("id", subscriptionId);

      if (error) throw error;
      toast.success("Subscription status updated");
      loadSubscriptions();
    } catch (error) {
      console.error("Error updating subscription:", error);
      toast.error("Failed to update subscription");
    }
  };

  const extendSubscription = async (subscriptionId: string, days: number) => {
    try {
      const subscription = subscriptions.find(s => s.id === subscriptionId);
      const currentEndDate = new Date(subscription.end_date || Date.now());
      const newEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from("user_subscriptions" as any)
        .update({ end_date: newEndDate.toISOString() })
        .eq("id", subscriptionId);

      if (error) throw error;
      toast.success(`Subscription extended by ${days} days`);
      loadSubscriptions();
    } catch (error) {
      console.error("Error extending subscription:", error);
      toast.error("Failed to extend subscription");
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, any> = {
      active: { label: "Active", className: "bg-success" },
      expired: { label: "Expired", className: "bg-destructive" },
      cancelled: { label: "Cancelled", className: "bg-secondary" },
      limited: { label: "Limited", className: "bg-warning" }
    };
    const config = configs[status] || configs.active;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AdminLayout title="Subscription Management" description="Manage user subscriptions">
      <div className="space-y-6">
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>All Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>{(sub.profiles as any)?.full_name || "N/A"}</TableCell>
                    <TableCell>{(sub.profiles as any)?.email || "N/A"}</TableCell>
                    <TableCell>
                      {(sub.subscription_plans as any)?.name || "Free"}
                      <div className="text-xs text-muted-foreground">
                        ₹{(sub.subscription_plans as any)?.price_inr || 0}/mo
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell>
                      {new Date(sub.start_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {sub.end_date ? new Date(sub.end_date).toLocaleDateString() : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Select
                          value={sub.status}
                          onValueChange={(value) => updateSubscriptionStatus(sub.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => extendSubscription(sub.id, 30)}
                        >
                          +30 Days
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
