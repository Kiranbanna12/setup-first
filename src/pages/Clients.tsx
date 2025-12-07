import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Mail, Building, Users, DollarSign, Calendar, Edit, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { notificationService } from "@/lib/notifications";
import { PendingInvitations } from "@/components/invitations/PendingInvitations";
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";
import { SubscriptionLimitDialog } from "@/components/subscription/SubscriptionLimitDialog";

interface Client {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  company: string;
  employment_type: 'fulltime' | 'freelance';
  project_rate: number | null;
  monthly_rate: number | null;
  isLinked?: boolean;
  linkedType?: string;
  avatar_url?: string | null;
  originalEntry?: any;
}

export default function Clients() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    company: "",
    employment_type: "freelance" as 'fulltime' | 'freelance',
    project_rate: "",
    monthly_rate: "",
  });
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);
  const { canAddClient, refreshLimits } = useSubscriptionLimits();

  useEffect(() => {
    checkAuth();
    loadClients();
  }, []);

  const checkAuth = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const loadClients = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's email
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();

      const userEmail = currentProfile?.email?.toLowerCase() || "";

      // 1. Get clients I created (my clients)
      // @ts-ignore - Supabase type inference issue, works at runtime
      const myClientsQuery = supabase.from("clients").select("*").eq("created_by", user.id).order("created_at", { ascending: false });
      const { data: myClients } = await myClientsQuery;

      // 2. Get EDITOR entries where MY email was added by someone else
      // Those people become my clients (they hired me as editor, so I see them as client)
      // @ts-ignore - Supabase type inference issue, works at runtime
      const editorQuery = supabase.from("editors").select("*").order("created_at", { ascending: false });
      const { data: editorEntries, error: editorError } = await editorQuery;

      console.log("DEBUG Clients - My email:", userEmail);
      console.log("DEBUG Clients - My user.id:", user.id);
      console.log("DEBUG Clients - All editor entries:", editorEntries);
      if (editorError) console.error("DEBUG Clients - Error:", editorError);

      // Filter entries where NOT created by me AND (email matches OR user_id matches)
      const myEditorEntries = (editorEntries || []).filter(
        (entry: any) => {
          const isNotMyEntry = entry.created_by !== user.id;
          const emailMatch = entry.email?.toLowerCase().trim() === userEmail.toLowerCase().trim();
          const userIdMatch = entry.user_id === user.id;
          console.log("DEBUG Clients - Check:", entry.email, "isNotMine:", isNotMyEntry, "emailMatch:", emailMatch);
          return isNotMyEntry && (emailMatch || userIdMatch);
        }
      );

      // Get creator profiles for matched entries
      const creatorIds = myEditorEntries.map((e: any) => e.created_by).filter(Boolean);
      let creatorProfiles: any[] = [];

      if (creatorIds.length > 0) {
        const { data: profiles } = await (supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", creatorIds) as any);
        creatorProfiles = profiles || [];
      }

      // Transform editor entries to client format (show creator's profile - the person who added me)
      const linkedClients = myEditorEntries.map((entry: any) => {
        const creator = creatorProfiles.find((p: any) => p.id === entry.created_by);
        return {
          id: `linked-${entry.id}`,
          user_id: creator?.id || null,
          full_name: creator?.full_name || "Unknown User",
          email: creator?.email || "",
          avatar_url: creator?.avatar_url || null,
          company: "Linked Client", // They added me as Editor, so they are my Client
          employment_type: entry.employment_type || "freelance",
          project_rate: null,
          monthly_rate: entry.monthly_salary || null,
          isLinked: true,
          linkedType: "editor", // Indicates source
          originalEntry: entry
        };
      });

      console.log("Fetched Creator Profiles:", creatorProfiles);
      console.log("My clients:", myClients?.length || 0);
      console.log("Linked clients (from editor entries):", linkedClients.length);

      setClients([...(myClients || []) as Client[], ...linkedClients]);
    } catch (error) {
      console.error("Error loading clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (editingClient) {
        // Update existing client
        const { data: updatedClient, error } = await supabase
          .from("clients")
          .update({
            full_name: formData.full_name,
            email: formData.email.toLowerCase().trim(), // Always store lowercase
            company: formData.company,
            employment_type: formData.employment_type,
            project_rate: null,
            monthly_rate: formData.employment_type === 'fulltime' && formData.monthly_rate ? parseFloat(formData.monthly_rate) : null,
          })
          .eq("id", editingClient.id)
          .select()
          .single();

        if (error) throw error;
        setClients(clients.map(c => c.id === editingClient.id ? updatedClient as Client : c));
        toast.success("Client updated successfully");
      } else {
        // Check if user already exists with this email (case insensitive)
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id, full_name")
          .ilike("email", formData.email.trim()) // Case insensitive search
          .single();

        // Create new client
        const { data: newClient, error } = await supabase
          .from("clients")
          .insert({
            user_id: existingProfile?.id || null, // Link to actual user if they have account
            created_by: user?.id,
            full_name: formData.full_name,
            email: formData.email.toLowerCase().trim(), // Always store lowercase
            company: formData.company,
            employment_type: formData.employment_type,
            project_rate: null,
            monthly_rate: formData.employment_type === 'fulltime' && formData.monthly_rate ? parseFloat(formData.monthly_rate) : null,
          })
          .select()
          .single();

        if (error) throw error;
        setClients([newClient as Client, ...clients]);
        toast.success("Client added successfully");

        // Get current user's profile for notification
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user?.id)
          .single();

        // Create invitation record
        // @ts-ignore
        await (supabase as any).from("invitations").insert({
          inviter_id: user?.id,
          invitee_email: formData.email.toLowerCase().trim(),
          invitee_id: existingProfile?.id || null,
          invitation_type: 'client',
          client_id: newClient.id,
          status: 'pending'
        });

        // Send notification to the user if they have an account
        if (existingProfile?.id) {
          await notificationService.create({
            userId: existingProfile.id,
            type: 'project_assigned',
            priority: 'important',
            title: 'New Client Invitation',
            message: `${currentProfile?.full_name || 'Someone'} wants to add you as a client. Accept or decline the invitation.`,
            link: '/editors',
            metadata: { added_by: user?.id, client_id: newClient.id }
          });
        }
      }

      setIsDialogOpen(false);
      setEditingClient(null);
      setFormData({ full_name: "", email: "", company: "", employment_type: "freelance", project_rate: "", monthly_rate: "" });
    } catch (error) {
      console.error("Error saving client:", error);
      toast.error("Failed to save client");
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      full_name: client.full_name,
      email: client.email,
      company: client.company || "",
      employment_type: client.employment_type,
      project_rate: client.project_rate?.toString() || "",
      monthly_rate: client.monthly_rate?.toString() || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (clientId: string) => {
    try {
      // Linked entries cannot be deleted from here - they are linked via the other person's entry
      if (clientId.startsWith('linked-')) {
        toast.error("Cannot delete this entry. It's linked via another user's editor entry.");
        return;
      }

      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", clientId);

      if (error) throw error;

      setClients(clients.filter(c => c.id !== clientId));
      toast.success("Client deleted successfully");
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("Failed to delete client");
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingClient(null);
      setFormData({ full_name: "", email: "", company: "", employment_type: "freelance", project_rate: "", monthly_rate: "" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <AppSidebar />
        <div className="flex-1 bg-background dark:bg-background">
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-3 sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <SidebarTrigger />
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Clients</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Manage your client relationships</p>
                  </div>
                </div>
              </div>

              <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button
                    className="gradient-primary h-8 sm:h-9 text-xs sm:text-sm px-3 sm:px-4 flex-shrink-0"
                    onClick={(e) => {
                      if (!canAddClient) {
                        e.preventDefault();
                        setLimitDialogOpen(true);
                      }
                    }}
                  >
                    <Plus className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Add Client</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base sm:text-lg">{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name" className="text-xs sm:text-sm">Full Name</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) =>
                          setFormData({ ...formData, full_name: e.target.value })
                        }
                        required
                        className="h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-xs sm:text-sm">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        className="h-9 text-xs sm:text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company" className="text-xs sm:text-sm">Company</Label>
                      <Input
                        id="company"
                        value={formData.company}
                        onChange={(e) =>
                          setFormData({ ...formData, company: e.target.value })
                        }
                        placeholder="Optional"
                        className="h-9 text-xs sm:text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="employment_type" className="text-xs sm:text-sm">Employment Type</Label>
                      <Select
                        value={formData.employment_type}
                        onValueChange={(value: 'fulltime' | 'freelance') =>
                          setFormData({ ...formData, employment_type: value })
                        }
                      >
                        <SelectTrigger className="h-9 text-xs sm:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="freelance" className="text-xs sm:text-sm">Freelance</SelectItem>
                          <SelectItem value="fulltime" className="text-xs sm:text-sm">Full Time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.employment_type === 'fulltime' && (
                      <div className="space-y-2">
                        <Label htmlFor="monthly_rate" className="text-xs sm:text-sm">Monthly Rate (₹)</Label>
                        <Input
                          id="monthly_rate"
                          type="number"
                          step="0.01"
                          value={formData.monthly_rate}
                          onChange={(e) =>
                            setFormData({ ...formData, monthly_rate: e.target.value })
                          }
                          className="h-9 text-xs sm:text-sm"
                        />
                      </div>
                    )}

                    <Button type="submit" className="w-full h-9 sm:h-10 text-xs sm:text-sm gradient-primary">
                      {editingClient ? "Update Client" : "Add Client"}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </header>

          <main className="px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
            {/* Pending Invitations - Kept from New App but styled minimally if needed */}
            <PendingInvitations type="editor" onUpdate={loadClients} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {clients.map((client) => (
                <Card key={client.id} className="shadow-elegant hover:shadow-glow transition-smooth">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                      {client.avatar_url ? (
                        <img
                          src={client.avatar_url}
                          alt={client.full_name}
                          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-primary flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-sm sm:text-base flex-shrink-0">
                          {client.full_name.charAt(0)}
                        </div>
                      )}
                      <span className="truncate">{client.full_name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 sm:space-y-3">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.company && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <Building className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        <span className="truncate">{client.company}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                      {client.employment_type === 'fulltime' ? 'Full Time' : 'Freelance'}
                    </div>
                    {client.project_rate && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-success">
                        <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        ₹{client.project_rate}/project
                      </div>
                    )}
                    {client.monthly_rate && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-success">
                        <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                        ₹{client.monthly_rate}/month
                      </div>
                    )}

                    <div className="flex flex-col gap-2 pt-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => navigate(`/clients/${client.id}/worksheet`)}
                        className="w-full h-8 sm:h-9 text-xs sm:text-sm gradient-primary"
                      >
                        View Worksheet
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(client)}
                          className="flex-1 h-8 sm:h-9 text-xs sm:text-sm"
                        >
                          <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 h-8 sm:h-9 text-xs sm:text-sm text-destructive hover:text-destructive">
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="sm:max-w-[425px]">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-base sm:text-lg">Delete Client?</AlertDialogTitle>
                              <AlertDialogDescription className="text-xs sm:text-sm">
                                Are you sure you want to delete {client.full_name}? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                              <AlertDialogCancel className="h-9 text-xs sm:text-sm m-0">Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(client.id)} className="h-9 text-xs sm:text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90 m-0">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {clients.length === 0 && (
              <div className="text-center py-8 sm:py-12">
                <Users className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
                <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">No clients added yet</p>
                <Button onClick={() => setIsDialogOpen(true)} className="h-9 sm:h-10 text-xs sm:text-sm gradient-primary">
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                  Add Your First Client
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

      <SubscriptionLimitDialog
        open={limitDialogOpen}
        onOpenChange={setLimitDialogOpen}
        title="Clients Not Available"
        description="Free tier does not allow adding clients. Upgrade to a paid plan to add clients."
      />
    </SidebarProvider>
  );
}
