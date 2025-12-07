// @ts-nocheck
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Bell, Mail, Send, Users, Settings as SettingsIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { isAdminEmail } from "@/lib/adminAuth";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AdminNotifications() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Broadcast state
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [deliveryChannels, setDeliveryChannels] = useState<string[]>(["in_app"]);
  const [recipientFilter, setRecipientFilter] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if user email is in local admin list
    if (!isAdminEmail(user.email)) {
      toast.error("Unauthorized access");
      navigate("/dashboard");
      return;
    }

    setUserRole("admin");
  };

  const handleSendBroadcast = async () => {
    if (!broadcastTitle || !broadcastMessage) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Build recipient filter
      const filter: any = {};
      if (recipientFilter === "all") {
        filter.all = true;
      } else if (recipientFilter === "categories") {
        filter.categories = selectedCategories;
      }

      // Create broadcast message
      const { error: broadcastError } = await supabase
        .from('broadcast_messages')
        .insert({
          message: broadcastMessage,
          sender_id: user.id,
          recipient_filter: filter as any,
          delivery_channels: deliveryChannels as any,
          status: 'sent',
          sent_at: new Date().toISOString(),
        } as any);

      if (broadcastError) throw broadcastError;

      // Get recipients based on filter
      let recipients: any[] = [];
      if (filter.all) {
        const { data: users } = await supabase.auth.admin.listUsers();
        recipients = users?.users || [];
      } else if (filter.categories) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, user_category')
          .in('user_category', selectedCategories as any);
        
        recipients = profiles || [];
      }

      // Send notifications to all recipients
      if (deliveryChannels.includes("in_app")) {
        const notifications = recipients.map(recipient => ({
          user_id: recipient.id,
          type: 'system_alert',
          priority: 'important',
          title: broadcastTitle,
          message: broadcastMessage,
          metadata: { broadcast: true },
        }));

        await supabase.from('notifications').insert(notifications);
      }

      // Send emails if email channel is selected
      if (deliveryChannels.includes("email")) {
        for (const recipient of recipients) {
          await supabase.functions.invoke('send-notification-email', {
            body: {
              recipientId: recipient.id,
              templateName: 'notification_email',
              variables: {
                title: broadcastTitle,
                message: broadcastMessage,
                link: `${window.location.origin}/notifications`,
              },
            },
          });
        }
      }

      toast.success(`Broadcast sent to ${recipients.length} users`);
      setBroadcastTitle("");
      setBroadcastMessage("");
      setDeliveryChannels(["in_app"]);
      setRecipientFilter("all");
      setSelectedCategories([]);

    } catch (error: any) {
      console.error("Error sending broadcast:", error);
      toast.error("Failed to send broadcast");
    } finally {
      setLoading(false);
    }
  };

  if (!userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <AdminLayout title="Notification Management" description="Manage notifications and broadcasts">
      <div className="max-w-6xl space-y-6">
            <Tabs defaultValue="broadcast" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
                <TabsTrigger value="email-config">Email Config</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              <TabsContent value="broadcast" className="space-y-6">
                <Card className="shadow-elegant">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="h-5 w-5" />
                      Broadcast Message
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        placeholder="Enter broadcast title"
                      />
                    </div>

                    <div>
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="Enter your message"
                        rows={4}
                      />
                    </div>

                    <Separator />

                    <div>
                      <Label>Delivery Channels</Label>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={deliveryChannels.includes("in_app")}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setDeliveryChannels([...deliveryChannels, "in_app"]);
                              } else {
                                setDeliveryChannels(deliveryChannels.filter(c => c !== "in_app"));
                              }
                            }}
                          />
                          <Label>In-App</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={deliveryChannels.includes("email")}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setDeliveryChannels([...deliveryChannels, "email"]);
                              } else {
                                setDeliveryChannels(deliveryChannels.filter(c => c !== "email"));
                              }
                            }}
                          />
                          <Label>Email</Label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Recipients</Label>
                      <Select value={recipientFilter} onValueChange={setRecipientFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="categories">By User Category</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {recipientFilter === "categories" && (
                      <div>
                        <Label>Select Categories</Label>
                        <div className="flex gap-2 mt-2">
                          {["editor", "client", "agency"].map((category) => (
                            <Button
                              key={category}
                              variant={selectedCategories.includes(category) ? "default" : "outline"}
                              onClick={() => {
                                if (selectedCategories.includes(category)) {
                                  setSelectedCategories(selectedCategories.filter(c => c !== category));
                                } else {
                                  setSelectedCategories([...selectedCategories, category]);
                                }
                              }}
                            >
                              {category}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleSendBroadcast}
                      disabled={loading || !deliveryChannels.length}
                      className="w-full gradient-primary"
                    >
                      {loading ? "Sending..." : "Send Broadcast"}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="email-config">
                <Card className="shadow-elegant">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Email Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Email configuration management coming soon...
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="templates">
                <Card className="shadow-elegant">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="h-5 w-5" />
                      Email Templates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Template management coming soon...
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
    </AdminLayout>
  );
}
