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
        // Load user's payment history from Supabase
        const userId = session.user.id;
        const { data: paymentsData, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .or(`payer_id.eq.${userId},recipient_id.eq.${userId}`)
          .order('created_at', { ascending: false });

        if (paymentsError) {
          console.error("Payments query error:", paymentsError);
          setPayments([]);
        } else if (paymentsData && paymentsData.length > 0) {
          // Transform payments data to match the interface
          const transformedPayments: Payment[] = paymentsData.map((payment: any) => ({
            id: payment.id,
            payment_id: payment.id.slice(0, 12),
            amount: payment.amount,
            currency: 'INR',
            status: payment.status === 'paid' ? 'captured' : payment.status,
            plan_name: payment.payment_type === 'freelance' ? 'Project Payment' : 'Salary Payment',
            tier: 'subscription',
            billing_period: 'one-time',
            payment_date: payment.created_at,
            subscription_id: undefined
          }));
          setPayments(transformedPayments);
        } else {
          setPayments([]);
        }
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
    // In production, this would call an API to generate the invoice
    setTimeout(() => {
      toast.success(`Invoice for ${payment.plan_name} is ready!`);
    }, 1000);
  };

  const calculateTotal = () => {
    return filteredPayments
      .filter((p) => p.status === "captured" || p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading billing history...</p>
        </div>
      </div>
    );
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
                                  <span className="flex items-center gap-1">
                                    <CreditCard className="w-3 h-3" />
                                    Supabase
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
