// @ts-nocheck - Waiting for database migration to generate types
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, TrendingUp, DollarSign, Clock, Calendar, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import InvoiceFilters from "@/components/invoices/InvoiceFilters";
import InvoiceDetailsDialog from "@/components/invoices/InvoiceDetailsDialog";
import PaymentDialog from "@/components/invoices/PaymentDialog";
import TransactionsTable from "@/components/invoices/TransactionsTable";
import AdvancesTable from "@/components/invoices/AdvancesTable";
import { generateInvoicePDF } from "@/components/invoices/InvoicePDF";
import EnhancedCreateInvoiceDialog from "@/components/invoices/EnhancedCreateInvoiceDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Invoice } from "@/components/invoices/InvoiceCard"; // Import generic type if needed, or define locally
import { useSubscriptionLimits } from "@/hooks/useSubscriptionLimits";

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [editors, setEditors] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [showProjectsOverview, setShowProjectsOverview] = useState(true);

  // Filters
  const [selectedPerson, setSelectedPerson] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);

  // Role detection
  const userCategory = userProfile?.user_category?.toLowerCase() || 'editor';
  const subTier = userProfile?.subscription_tier?.toLowerCase() || 'basic';
  const isAgency = subTier === 'agency' || subTier === 'premium';

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadData();
    }
  }, [currentUserId]);

  useEffect(() => {
    applyFilters();
  }, [selectedPerson, selectedMonth, invoices]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(user.id);

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch active subscription plan's user_category
    const { data: activeSub } = await supabase
      .from('user_subscriptions')
      .select('plan_id, subscription_plans(user_category)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Use subscription plan's user_category if available, otherwise fall back to profile
    const planCategory = (activeSub?.subscription_plans as any)?.user_category;
    const updatedProfile = {
      ...profile,
      // Override user_category with subscription plan's category if available
      user_category: planCategory || profile?.user_category || 'editor'
    };

    if (updatedProfile) setUserProfile(updatedProfile);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Run all queries in parallel for faster loading
      const [
        invoicesResult,
        clientsResult,
        projectsResult,
        transactionsResult,
        editorsResult
      ] = await Promise.all([
        supabase.from("invoices").select(`*, client:clients(full_name)`).order("created_at", { ascending: false }),
        supabase.from("clients").select("id, full_name"),
        supabase.from("projects").select("*"),
        supabase.from("transactions").select("invoice_id, amount, transaction_type").eq("transaction_type", "payment"),
        supabase.from("editors").select("id, full_name")
      ]);

      const invoicesData = invoicesResult.data || [];
      const clientsList = clientsResult.data || [];
      const projectsData = projectsResult.data || [];
      const transactionsData = transactionsResult.data || [];
      const editorsData = editorsResult.data || [];

      setClients(clientsList);
      setProjects(projectsData);
      setEditors(editorsData);

      // Map invoices with client lookup and calculated paid amounts
      const mappedInvoices = invoicesData.map(inv => {
        const totalAmount = Number(inv.total_amount || inv.amount || 0);
        const invoicePayments = transactionsData
          .filter(t => t.invoice_id === inv.id)
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const paidAmount = invoicePayments;
        const remainingAmount = Math.max(0, totalAmount - paidAmount);

        let clientInfo = inv.client;
        if (!clientInfo?.full_name && inv.client_id) {
          const foundClient = clientsList.find(c => c.id === inv.client_id);
          if (foundClient) clientInfo = { full_name: foundClient.full_name };
        }
        if (!clientInfo?.full_name && projectsData) {
          const linkedProject = projectsData.find(p => p.invoice_id === inv.id);
          if (linkedProject?.client_id) {
            const projectClient = clientsList.find(c => c.id === linkedProject.client_id);
            if (projectClient) clientInfo = { full_name: projectClient.full_name };
          }
        }

        return { ...inv, client: clientInfo, paid_amount: paidAmount, remaining_amount: remainingAmount };
      });

      setInvoices(mappedInvoices);

      // Load invoice items
      const { data: allItemsData } = await supabase.from("projects").select("*").not('invoice_id', 'is', null);
      if (allItemsData && invoicesData) {
        const invoiceMap = new Map(invoicesData.map(inv => [inv.id, inv]));
        const enrichedItems = allItemsData.map(item => {
          const invoice = invoiceMap.get(item.invoice_id);
          // Derive month from invoice.month or fallback to created_at date
          let invoiceMonth = invoice?.month;
          if (!invoiceMonth && invoice?.created_at) {
            invoiceMonth = new Date(invoice.created_at).toLocaleString('en-US', { month: 'long', year: 'numeric' });
          }
          return { ...item, invoice_month: invoiceMonth, invoice_status: invoice?.status, client_id: invoice?.client_id || item.client_id };
        });
        setInvoiceItems(enrichedItems);
      }

      const months = [...new Set(mappedInvoices?.map(inv => inv.month).filter(Boolean) || [])];
      setAvailableMonths(months.sort().reverse());
      const currentMonthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
      if (months.includes(currentMonthName)) setSelectedMonth(currentMonthName);
      else if (months.length > 0) setSelectedMonth(months[0]);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load invoices data");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...invoices];

    if (selectedPerson !== "all") {
      // Filter by client_id since invoices have client_id, not editor_id
      filtered = filtered.filter(inv => inv.client_id === selectedPerson);
    }

    if (selectedMonth && selectedMonth !== "all") {
      filtered = filtered.filter(inv => inv.month === selectedMonth);
    }

    setFilteredInvoices(filtered);
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoiceId) return;

    try {
      const { error } = await supabase
        .from("invoices")
        .delete()
        .eq("id", selectedInvoiceId);

      if (error) throw error;

      toast.success("Invoice deleted successfully");
      setInvoices(invoices.filter((inv) => inv.id !== selectedInvoiceId));
      setDeleteDialogOpen(false);
      setSelectedInvoiceId(null);
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error("Failed to delete invoice");
    }
  };

  const handleProcessPayment = (invoice: any) => {
    setSelectedInvoice(invoice);
    setPaymentDialogOpen(true);
  };

  const handleDownloadPDF = async (invoice: any) => {
    try {
      // Fetch invoice items 
      const { data: projects } = await supabase
        .from("projects")
        .select("name, fee")
        .eq("invoice_id", invoice.id);

      // Use profile if editor name missing
      let clientName = "Unknown";
      if (invoice.client?.full_name) {
        clientName = invoice.client.full_name;
      } else if (userProfile) {
        clientName = userProfile.full_name || "Unknown";
      }

      await generateInvoicePDF(
        invoice,
        projects?.map(p => ({ name: p.name, fee: p.fee })) || [],
        clientName,
        userProfile // Pass full user profile for FROM section
      );
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const handleInvoiceClick = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setDetailsDialogOpen(true);
  };

  // Role-based Financial Analytics
  const calculateFinancials = () => {
    // Only use filteredInvoices when filters are actually applied
    const hasFilters = selectedPerson !== "all" || (selectedMonth && selectedMonth !== "all");
    const displayInvoices = hasFilters ? filteredInvoices : invoices;

    // Total invoiced
    const totalInvoiced = displayInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || inv.amount || 0), 0);

    // Total paid (status = 'paid')
    const paidInvoices = displayInvoices.filter(inv => inv.status === 'paid');
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || inv.amount || 0), 0);

    // Pending (status = 'pending', 'draft', 'sent')
    const pendingInvoices = displayInvoices.filter(inv =>
      inv.status === 'pending' || inv.status === 'draft' || inv.status === 'sent'
    );
    const totalPending = pendingInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || inv.amount || 0), 0);

    // Overdue
    const overdueInvoices = displayInvoices.filter(inv => inv.status === 'overdue');
    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || inv.amount || 0), 0);

    return {
      totalLabel: 'Total Invoiced',
      totalAmount: totalInvoiced,
      totalDescription: `${displayInvoices.length} invoice${displayInvoices.length !== 1 ? 's' : ''}`,
      paidLabel: 'Total Paid',
      paidAmount: totalPaid,
      paidDescription: `${paidInvoices.length} completed`,
      pendingLabel: 'Pending',
      pendingAmount: totalPending,
      pendingDescription: `${pendingInvoices.length} awaiting`,
      overdueAmount: totalOverdue,
      overdueCount: overdueInvoices.length,
      type: 'default'
    };
  };

  const financials = calculateFinancials();

  // Partial payments calculation
  const partialInvoices = invoices.filter(inv => inv.status === 'partial');
  const totalPartial = partialInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || inv.amount || 0), 0);

  // Skeleton loading component
  const LoadingSkeleton = () => (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <AppSidebar />
        <div className="flex-1 bg-background dark:bg-background">
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Invoices</h1>
              </div>
            </div>
          </header>
          <main className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            {/* Stats skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="shadow-elegant">
                  <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 py-3">
                    <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
                    <div className="h-4 w-4 bg-muted/50 rounded animate-pulse" />
                  </CardHeader>
                  <CardContent className="px-4">
                    <div className="h-8 w-32 bg-muted/60 rounded animate-pulse mb-2" />
                    <div className="h-3 w-20 bg-muted/40 rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Table skeleton */}
            <Card className="shadow-elegant">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg border">
                      <div className="h-5 w-20 bg-muted/50 rounded animate-pulse" />
                      <div className="h-5 w-32 bg-muted/40 rounded animate-pulse" />
                      <div className="h-5 w-24 bg-muted/50 rounded animate-pulse" />
                      <div className="h-5 w-20 bg-muted/40 rounded animate-pulse" />
                      <div className="h-6 w-16 bg-muted/30 rounded-full animate-pulse" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );

  const { hasActiveSubscription, loading: limitsLoading } = useSubscriptionLimits();

  if (loading || limitsLoading) {
    return <LoadingSkeleton />;
  }

  // Restrict access for free plan users
  if (!hasActiveSubscription) {
    return (
      <SidebarProvider>
        <div className="flex w-full min-h-screen">
          <AppSidebar />
          <div className="flex-1 bg-background dark:bg-background">
            <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
              <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
                <SidebarTrigger />
                <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Invoices</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">Manage your invoices and payments</p>
                  </div>
                </div>
              </div>
            </header>

            <main className="px-4 sm:px-6 lg:px-8 py-12 flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md shadow-elegant text-center">
                <CardHeader>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Upgrade to Premium</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">
                    Invoicing and financial management features are available for Premium users. Upgrade your subscription to unlock:
                  </p>
                  <ul className="text-left space-y-2 text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Create and manage professional invoices
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Track project payments and advances
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Export invoices as PDF
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Detailed financial analytics
                    </li>
                  </ul>
                  <Button
                    className="w-full mt-4"
                    onClick={() => navigate('/subscription-management')}
                  >
                    Upgrade Subscription
                  </Button>
                </CardContent>
              </Card>
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen">
        <AppSidebar />
        <div className="flex-1 bg-background dark:bg-background overflow-hidden">
          <header className="border-b bg-card/50 dark:bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Invoices</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Manage your invoices and payments</p>
                </div>
              </div>
            </div>
          </header>

          <main className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 overflow-y-auto overflow-x-hidden">
            {/* Filters */}
            <Card className="mb-4 sm:mb-6 lg:mb-8 shadow-elegant">
              <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
                <InvoiceFilters
                  clients={clients}
                  editors={editors}
                  selectedPerson={selectedPerson}
                  onPersonChange={setSelectedPerson}
                  selectedMonth={selectedMonth}
                  onMonthChange={setSelectedMonth}
                  availableMonths={availableMonths}
                  userCategory={userCategory}
                  isAgency={isAgency}
                />
              </CardContent>
            </Card>

            {/* Financial Analytics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
              {/* Cards matching Old App Layout */}
              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {financials.totalLabel}
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold">
                    ₹{financials.totalAmount.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {financials.totalDescription}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {financials.paidLabel}
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-success flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold text-success">
                    ₹{financials.paidAmount.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {financials.paidDescription}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {financials.pendingLabel}
                  </CardTitle>
                  <Clock className="h-4 w-4 text-warning flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold text-warning">
                    ₹{financials.pendingAmount.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {financials.pendingDescription}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 py-3 sm:px-6 sm:py-4">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    Partial Payments
                  </CardTitle>
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                </CardHeader>
                <CardContent className="px-4 sm:px-6">
                  <div className="text-xl sm:text-2xl font-bold text-primary">₹{totalPartial.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {invoices.filter((inv) => inv.status === "partial").length} in progress
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Projects Overview */}
            <Card className="mb-4 sm:mb-6 lg:mb-8 shadow-elegant">
              <CardHeader className="flex flex-row items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base sm:text-lg">Projects Overview</CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      All projects with their payment details
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowProjectsOverview(!showProjectsOverview)}
                >
                  {showProjectsOverview ? "Hide" : "Show"} Projects
                </Button>
              </CardHeader>
              {showProjectsOverview && (
                <CardContent className="px-3 sm:px-6">
                  {/* Desktop Table View */}
                  <div className="hidden md:block border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Project Name</TableHead>
                          <TableHead className="font-semibold">Client</TableHead>
                          <TableHead className="font-semibold">Month</TableHead>
                          <TableHead className="font-semibold text-right">Fee</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          // Filter the invoice items based on selected filters
                          const filteredItems = invoiceItems.filter(item => {
                            if (selectedPerson !== "all") {
                              const projectClientId = item.client_id;
                              if (projectClientId !== selectedPerson) return false;
                            }
                            if (selectedMonth && selectedMonth !== "all") {
                              if (item.invoice_month !== selectedMonth) return false;
                            }
                            return true;
                          });

                          if (filteredItems.length === 0) {
                            return (
                              <TableRow>
                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                  {invoiceItems.length === 0
                                    ? "No projects linked to invoices yet"
                                    : "No projects match the selected filters"}
                                </TableCell>
                              </TableRow>
                            );
                          }

                          const getClientName = (clientId: string) => {
                            const client = clients.find(c => c.id === clientId);
                            return client?.full_name || 'Unknown';
                          };

                          return filteredItems.slice(0, 20).map((item, index) => (
                            <TableRow key={item.id || index} className="hover:bg-muted/30">
                              <TableCell className="font-medium">{item.name}</TableCell>
                              <TableCell>{getClientName(item.client_id)}</TableCell>
                              <TableCell>{item.invoice_month || 'N/A'}</TableCell>
                              <TableCell className="text-right font-semibold">
                                ₹{Number(item.fee || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  item.invoice_status === "paid" ? "bg-success/10 text-success" :
                                    item.invoice_status === "in_progress" ? "bg-primary/10 text-primary" :
                                      "bg-warning/10 text-warning"
                                }>
                                  {(item.invoice_status || 'PENDING').replace("_", " ").toUpperCase()}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="block md:hidden space-y-3">
                    {(() => {
                      const filteredItems = invoiceItems.filter(item => {
                        if (selectedPerson !== "all") {
                          if (item.client_id !== selectedPerson) return false;
                        }
                        if (selectedMonth && selectedMonth !== "all") {
                          if (item.invoice_month !== selectedMonth) return false;
                        }
                        return true;
                      });

                      if (filteredItems.length === 0) {
                        return (
                          <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg">
                            {invoiceItems.length === 0
                              ? "No projects linked to invoices yet"
                              : "No projects match the selected filters"}
                          </div>
                        );
                      }

                      const getClientName = (clientId: string) => {
                        const client = clients.find(c => c.id === clientId);
                        return client?.full_name || 'Unknown';
                      };

                      return filteredItems.slice(0, 20).map((item, index) => (
                        <div key={item.id || index} className="border rounded-lg p-3 bg-card hover:bg-muted/30">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{getClientName(item.client_id)}</p>
                            </div>
                            <Badge className={`text-xs ml-2 flex-shrink-0 ${item.invoice_status === "paid" ? "bg-success/10 text-success" :
                              item.invoice_status === "in_progress" ? "bg-primary/10 text-primary" :
                                "bg-warning/10 text-warning"
                              }`}>
                              {(item.invoice_status || 'PENDING').replace("_", " ").toUpperCase()}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{item.invoice_month || 'N/A'}</span>
                            <span className="font-bold text-primary">₹{Number(item.fee || 0).toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Create Invoice & Header */}
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold">
                {selectedPerson !== "all" || (selectedMonth && selectedMonth !== "all")
                  ? `Filtered Invoices (${filteredInvoices.length})`
                  : `All Invoices (${invoices.length})`}
              </h2>
              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                Generate Invoice
              </Button>
            </div>

            {/* Main Invoices Table */}
            <Card className="mb-8 shadow-elegant">
              <CardContent className="p-0">

                {/* Desktop Table View */}
                <div className="hidden md:block rounded-md border bg-card text-card-foreground shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        // Get the correct list of invoices to display
                        const displayInvoices = (selectedPerson !== "all" || (selectedMonth && selectedMonth !== "all"))
                          ? filteredInvoices
                          : invoices;

                        // Helper to get client name
                        const getClientName = (invoice: any) => {
                          if (invoice.client?.full_name) return invoice.client.full_name;
                          // Fallback: look up from clients array
                          const client = clients.find(c => c.id === invoice.client_id);
                          return client?.full_name || 'Unknown';
                        };

                        if (displayInvoices.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-12">
                                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                <h3 className="text-lg font-semibold mb-2">
                                  {invoices.length === 0 ? "No invoices yet" : "No invoices match filters"}
                                </h3>
                                <p className="text-muted-foreground mb-4">
                                  {invoices.length === 0
                                    ? "Create your first invoice to start tracking your payments"
                                    : "Try adjusting your filter criteria"}
                                </p>
                                {invoices.length === 0 && (
                                  <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Create First Invoice
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return displayInvoices.map((invoice) => (
                          <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell
                              className="font-medium text-primary"
                              onClick={() => handleInvoiceClick(invoice.id)}
                            >
                              {invoice.invoice_number || invoice.id.slice(0, 8)}
                            </TableCell>
                            <TableCell>{getClientName(invoice)}</TableCell>
                            <TableCell className="font-semibold">
                              ₹{Number(invoice.total_amount || invoice.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-success font-medium">
                              ₹{Number(invoice.paid_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-warning font-medium">
                              ₹{Number(invoice.remaining_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const total = Number(invoice.total_amount || invoice.amount || 0);
                                const paid = Number(invoice.paid_amount || 0);
                                const remaining = Number(invoice.remaining_amount || 0);

                                if (remaining <= 0 || paid >= total) {
                                  return <Badge className="bg-success/10 text-success">PAID</Badge>;
                                } else if (paid > 0 && paid < total) {
                                  return <Badge className="bg-primary/10 text-primary">PARTIAL</Badge>;
                                } else {
                                  return <Badge className="bg-warning/10 text-warning">PENDING</Badge>;
                                }
                              })()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {Number(invoice.remaining_amount || 0) > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleProcessPayment(invoice); }}
                                  >
                                    Mark Paid
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => { e.stopPropagation(); handleDownloadPDF(invoice); }}
                                >
                                  PDF
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Card View */}
                <div className="block md:hidden space-y-3 p-3">
                  {(() => {
                    // Get the correct list of invoices to display
                    const displayInvoices = (selectedPerson !== "all" || (selectedMonth && selectedMonth !== "all"))
                      ? filteredInvoices
                      : invoices;

                    // Helper to get client name
                    const getClientName = (invoice: any) => {
                      if (invoice.client?.full_name) return invoice.client.full_name;
                      const client = clients.find(c => c.id === invoice.client_id);
                      return client?.full_name || 'Unknown';
                    };

                    if (displayInvoices.length === 0) {
                      return (
                        <div className="text-center py-12 bg-card rounded-lg border">
                          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                          <h3 className="text-base font-semibold mb-1">
                            {invoices.length === 0 ? "No invoices yet" : "No invoices match filters"}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {invoices.length === 0
                              ? "Create your first invoice to start"
                              : "Try adjusting your filter criteria"}
                          </p>
                          {invoices.length === 0 && (
                            <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                              <Plus className="h-4 w-4" />
                              Create Invoice
                            </Button>
                          )}
                        </div>
                      );
                    }

                    return displayInvoices.map((invoice) => (
                      <div key={invoice.id} onClick={() => handleInvoiceClick(invoice.id)}>
                        <div className="bg-card rounded-lg shadow-sm border p-4 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <FileText className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-foreground">
                                  {invoice.invoice_number || invoice.id.slice(0, 8)}
                                </h3>
                                <p className="text-sm text-muted-foreground">{getClientName(invoice)}</p>
                              </div>
                            </div>
                            <Badge className={
                              invoice.status === "paid" ? "bg-success/10 text-success" :
                                invoice.status === "in_progress" ? "bg-primary/10 text-primary" :
                                  invoice.status === "partial" ? "bg-info/10 text-info" :
                                    "bg-warning/10 text-warning"
                            }>
                              {(invoice.status || 'pending').replace("_", " ").toUpperCase()}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">Month</p>
                              <div className="flex items-center gap-1 font-medium">
                                <Calendar className="h-3 w-3" />
                                {invoice.month || 'N/A'}
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-muted-foreground mb-1">Total Amount</p>
                              <p className="font-bold text-lg">₹{Number(invoice.total_amount || 0).toFixed(2)}</p>
                            </div>
                          </div>

                          <div className="pt-2 border-t flex justify-end gap-2">
                            {invoice.status !== "paid" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleProcessPayment(invoice); }}
                                className="h-8 bg-success/10 hover:bg-success/20 text-success border-success/30"
                              >
                                Pay
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); handleDownloadPDF(invoice); }}
                              className="h-8"
                            >
                              <FileText className="h-3 w-3 mr-1" /> PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>

              </CardContent>
            </Card>

            {/* Advances & Expenses Section */}
            <div className="mb-8">
              <AdvancesTable
                userCategory={userProfile?.user_category}
                subscriptionTier={userProfile?.subscription_tier}
              />
            </div>

            <TransactionsTable />

          </main>
        </div>
      </div>

      {/* Dialogs */}
      <EnhancedCreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          setCreateDialogOpen(false);
          loadData();
        }}
        userCategory={userCategory}
        isAgency={isAgency}
      />

      <InvoiceDetailsDialog
        invoiceId={selectedInvoiceId}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={selectedInvoice}
        onSuccess={() => {
          setPaymentDialogOpen(false);
          loadData();
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the invoice
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInvoice}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
