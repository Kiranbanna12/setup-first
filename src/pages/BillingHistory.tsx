import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Receipt, Download, CheckCircle2, Clock, XCircle, Search,
  Calendar, CreditCard, Filter, FileText, ArrowUpDown
} from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Payment {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: "captured" | "pending" | "failed" | "paid" | "overdue";
  plan_name: string;
  tier: string;
  billing_period: string;
  payment_date: string;
  subscription_id?: string;
  user_category?: string;
}

const BillingHistory = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    filterAndSortPayments();
  }, [payments, searchTerm, statusFilter, sortOrder]);

  const loadPayments = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      try {
        const userId = session.user.id;
        const allTransactions: Payment[] = [];

        // Load user's payment history
        const { data: paymentsData } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        // Load user's subscription history with plan details
        const { data: subsData } = await supabase
          .from('user_subscriptions' as any)
          .select(`
            id, status, is_trial, start_date, end_date, created_at,
            subscription_plans!inner(name, tier, billing_period, price_inr, user_category)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        // Add payments to transactions
        if (paymentsData && paymentsData.length > 0) {
          paymentsData.forEach((payment: any) => {
            allTransactions.push({
              id: payment.id,
              payment_id: payment.id.slice(0, 12),
              amount: payment.amount,
              currency: 'INR',
              status: payment.status === 'paid' ? 'captured' : payment.status,
              plan_name: 'Payment',
              tier: 'payment',
              billing_period: 'one-time',
              payment_date: payment.created_at,
              subscription_id: payment.subscription_id
            });
          });
        }

        // Add subscriptions to transactions (as billing records)
        if (subsData && subsData.length > 0) {
          subsData.forEach((sub: any) => {
            const planInfo = sub.subscription_plans;
            const statusMap: Record<string, "captured" | "pending" | "failed"> = {
              'active': 'captured',
              'created': 'pending',
              'pending': 'pending',
              'cancelling': 'captured',
              'cancelled': 'failed',
              'expired': 'failed'
            };

            allTransactions.push({
              id: `sub_${sub.id}`,
              payment_id: sub.id.slice(0, 12),
              amount: sub.is_trial ? 1 : (planInfo?.price_inr || 0),
              currency: 'INR',
              status: statusMap[sub.status] || 'pending',
              plan_name: planInfo?.name || 'Subscription',
              tier: planInfo?.tier || 'subscription',
              billing_period: sub.is_trial ? 'Trial' : (planInfo?.billing_period || 'monthly'),
              payment_date: sub.created_at,
              subscription_id: sub.id,
              user_category: planInfo?.user_category || 'editor'
            });
          });
        }

        // Sort all transactions by date (newest first)
        allTransactions.sort((a, b) =>
          new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
        );

        setPayments(allTransactions);
      } catch (error) {
        console.error("Failed to load payments:", error);
        setPayments([]);
      }
    } catch (error: any) {
      console.error("Load payments error:", error);
      toast.error("Failed to load billing history");
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortPayments = () => {
    let filtered = [...payments];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (payment) =>
          payment.plan_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          payment.payment_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((payment) => {
        if (statusFilter === 'captured') {
          return payment.status === 'captured' || payment.status === 'paid';
        }
        return payment.status === statusFilter;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const dateA = new Date(a.payment_date).getTime();
      const dateB = new Date(b.payment_date).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

    setFilteredPayments(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "captured":
      case "paid":
        return (
          <Badge className="bg-success text-white text-xs">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Paid
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-warning text-white text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "failed":
      case "overdue":
        return (
          <Badge className="bg-destructive text-white text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            {status === 'overdue' ? 'Overdue' : 'Failed'}
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleDownloadInvoice = (payment: Payment) => {
    toast.info("Generating invoice...");

    const invoiceDate = format(new Date(payment.payment_date), "dd MMM yyyy");
    const invoiceNumber = `INV-${payment.payment_id.toUpperCase()}`;

    // Create invoice HTML
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${invoiceNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: #f5f5f5; }
          .invoice { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #22c55e; padding-bottom: 20px; }
          .logo { font-size: 28px; font-weight: bold; color: #22c55e; }
          .logo span { color: #333; }
          .invoice-info { text-align: right; }
          .invoice-info h2 { font-size: 24px; color: #333; margin-bottom: 8px; }
          .invoice-info p { color: #666; font-size: 14px; }
          .section { margin-bottom: 30px; }
          .section-title { font-size: 14px; font-weight: 600; color: #666; text-transform: uppercase; margin-bottom: 10px; }
          .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
          .detail-box p { margin: 5px 0; color: #333; }
          .detail-box strong { color: #111; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f8f8f8; padding: 12px; text-align: left; font-size: 14px; color: #666; border-bottom: 2px solid #eee; }
          td { padding: 16px 12px; border-bottom: 1px solid #eee; color: #333; }
          .amount { text-align: right; font-weight: 600; }
          .total-row td { font-size: 18px; font-weight: bold; border-top: 2px solid #22c55e; padding-top: 20px; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
          .status.paid { background: #dcfce7; color: #166534; }
          .status.pending { background: #fef3c7; color: #92400e; }
          .status.failed { background: #fee2e2; color: #dc2626; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }
          @media print { body { padding: 0; background: white; } .invoice { box-shadow: none; } }
        </style>
      </head>
      <body>
        <div class="invoice">
          <div class="header">
            <div class="logo">Xrozen<span>Workflow</span></div>
            <div class="invoice-info">
              <h2>INVOICE</h2>
              <p><strong>${invoiceNumber}</strong></p>
              <p>Date: ${invoiceDate}</p>
            </div>
          </div>
          
          <div class="section">
            <div class="details-grid">
              <div class="detail-box">
                <div class="section-title">From</div>
                <p><strong>Xrozen Workflow</strong></p>
                <p>Subscription Services</p>
                <p>support@xrozen.com</p>
              </div>
              <div class="detail-box">
                <div class="section-title">Invoice To</div>
                <p><strong>Customer</strong></p>
                <p>Transaction ID: ${payment.id}</p>
              </div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">Invoice Details</div>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th class="amount">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>${payment.user_category ? `${payment.user_category.charAt(0).toUpperCase() + payment.user_category.slice(1)} ` : ''}${payment.plan_name}</strong></td>
                  <td>${payment.billing_period}</td>
                  <td><span class="status ${payment.status === 'captured' ? 'paid' : payment.status}">${payment.status === 'captured' ? 'Paid' : payment.status}</span></td>
                  <td class="amount">₹${payment.amount.toLocaleString()}</td>
                </tr>
                <tr class="total-row">
                  <td colspan="3">Total</td>
                  <td class="amount">₹${payment.amount.toLocaleString()} ${payment.currency}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p style="margin-top: 8px;">This is a computer-generated invoice and does not require a signature.</p>
          </div>
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;

    // Open invoice in new window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
      toast.success(`Invoice ${invoiceNumber} generated!`);
    } else {
      toast.error("Please allow popups to download invoice");
    }
  };

  const calculateTotal = () => {
    return filteredPayments
      .filter((p) => p.status === "captured" || p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);
  };

  // Skeleton loading component  
  const LoadingSkeleton = () => (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <Receipt className="w-5 h-5 text-primary-foreground" />
                </div>
                <h1 className="text-lg lg:text-xl font-bold truncate">Billing History</h1>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="px-4 lg:px-8 py-6 max-w-7xl mx-auto w-full">
              <div className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="shadow-elegant">
                      <CardHeader className="pb-3">
                        <div className="h-4 w-24 bg-muted/40 rounded animate-pulse" />
                        <div className="h-8 w-32 bg-muted/50 rounded animate-pulse mt-2" />
                      </CardHeader>
                    </Card>
                  ))}
                </div>
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="h-5 w-32 bg-muted/50 rounded animate-pulse" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-16 w-full bg-muted/30 rounded animate-pulse" />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Billing History</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                    View all your transactions and invoices
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto w-full">
              <div className="grid gap-4 sm:gap-6">
                {/* Summary Cards */}
                <div className="grid gap-4 sm:gap-6 md:grid-cols-3">
                  <Card className="shadow-elegant">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">Total Spent</CardDescription>
                      <CardTitle className="text-2xl sm:text-3xl font-bold">
                        ₹{calculateTotal().toLocaleString()}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="shadow-elegant">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">Total Transactions</CardDescription>
                      <CardTitle className="text-2xl sm:text-3xl font-bold">
                        {payments.length}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="shadow-elegant">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-xs">Successful</CardDescription>
                      <CardTitle className="text-2xl sm:text-3xl font-bold text-success">
                        {payments.filter((p) => p.status === "captured" || p.status === "paid").length}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* Filters */}
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <CardTitle className="text-base sm:text-lg">Filter & Search</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search transactions..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 text-xs sm:text-sm h-9 sm:h-10"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="text-xs sm:text-sm h-9 sm:h-10">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="captured">Paid</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                        className="text-xs sm:text-sm h-9 sm:h-10"
                      >
                        <ArrowUpDown className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                        {sortOrder === "desc" ? "Newest First" : "Oldest First"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Transactions List */}
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <CardTitle className="text-lg sm:text-xl">Transactions</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                          {filteredPayments.length} transaction{filteredPayments.length !== 1 ? "s" : ""} found
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toast.info("Export feature coming soon!")}
                        className="text-xs sm:text-sm"
                      >
                        <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                        Export
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {filteredPayments.length === 0 ? (
                      <div className="text-center py-12">
                        <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">No transactions found</p>
                        {(searchTerm || statusFilter !== "all") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearchTerm("");
                              setStatusFilter("all");
                            }}
                            className="mt-4 text-xs sm:text-sm"
                          >
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredPayments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors flex-wrap gap-3"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm sm:text-base font-semibold truncate">
                                    {payment.plan_name} - {payment.billing_period}
                                  </p>
                                  {getStatusBadge(payment.status)}
                                </div>
                                <div className="flex items-center gap-3 text-xs sm:text-sm text-muted-foreground flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {format(new Date(payment.payment_date), "MMM dd, yyyy")}
                                  </span>
                                  <span className="text-[10px] sm:text-xs text-muted-foreground/70">
                                    ID: {payment.payment_id}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-base sm:text-lg font-bold">
                                  ₹{payment.amount.toLocaleString()}
                                </p>
                                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">
                                  {payment.currency}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadInvoice(payment)}
                                className="text-xs"
                              >
                                <FileText className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-2" />
                                <span className="hidden sm:inline">Invoice</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default BillingHistory;
