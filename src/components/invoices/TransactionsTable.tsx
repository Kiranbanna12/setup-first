// @ts-nocheck - Waiting for database migration to generate types
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Transaction {
  id: string;
  amount: number;
  description: string;
  transaction_date: string;
  transaction_type: string;
  payment_method: string | null;
  created_at: string;
  invoice_id?: string | null;
}

interface Invoice {
  id: string;
  client_id?: string;
  client?: {
    full_name: string;
  };
}

interface Client {
  id: string;
  full_name: string;
}

interface Editor {
  id: string;
  full_name: string;
}

interface Project {
  id: string;
  invoice_id?: string;
  client_id?: string;
}

export default function TransactionsTable() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load clients first
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, full_name");
      const clientsList = clientsData || [];
      setClients(clientsList);

      // Load editors
      const { data: editorsData } = await supabase
        .from("editors")
        .select("id, full_name");
      setEditors(editorsData || []);

      // Load projects (for client lookup via invoice)
      const { data: projectsData } = await supabase
        .from("projects")
        .select("id, invoice_id, client_id");
      setProjects(projectsData || []);

      // Load invoices with client info
      const { data: invoicesData } = await supabase
        .from("invoices")
        .select("id, client_id, client:clients(full_name)");

      // Enhanced invoice mapping with client fallback
      const mappedInvoices = (invoicesData || []).map(inv => {
        let clientInfo = inv.client;

        // If no client from join, try clients array
        if (!clientInfo?.full_name && inv.client_id) {
          const foundClient = clientsList.find(c => c.id === inv.client_id);
          if (foundClient) {
            clientInfo = { full_name: foundClient.full_name };
          }
        }

        // If still no client, try projects
        if (!clientInfo?.full_name && projectsData) {
          const linkedProject = projectsData.find(p => p.invoice_id === inv.id);
          if (linkedProject?.client_id) {
            const projectClient = clientsList.find(c => c.id === linkedProject.client_id);
            if (projectClient) {
              clientInfo = { full_name: projectClient.full_name };
            }
          }
        }

        return { ...inv, client: clientInfo };
      });
      setInvoices(mappedInvoices);

      // Load transactions
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("editor_id", user.id)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
      setTransactions(data || []);

    } catch (error) {
      console.error("Error loading transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "payment":
        return "bg-success/20 text-success border-success/30";
      case "expense":
        return "bg-destructive/20 text-destructive border-destructive/30";
      case "deduction":
        return "bg-warning/20 text-warning border-warning/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Get recipient name with multiple fallbacks
  const getRecipientName = (transaction: Transaction) => {
    // 1. Check if transaction is linked to an invoice
    if (transaction.invoice_id) {
      const invoice = invoices.find(inv => inv.id === transaction.invoice_id);
      if (invoice?.client?.full_name) {
        return invoice.client.full_name;
      }
    }

    // 2. Try to extract from description - look for client/editor names
    const description = transaction.description || '';
    const descLower = description.toLowerCase();

    // Check if description mentions a client name
    for (const client of clients) {
      if (client.full_name && descLower.includes(client.full_name.toLowerCase())) {
        return client.full_name;
      }
    }

    // Check if description mentions an editor name
    for (const editor of editors) {
      if (editor.full_name && descLower.includes(editor.full_name.toLowerCase())) {
        return editor.full_name;
      }
    }

    // 3. Extract invoice number from description and find its client
    const invoiceMatch = description.match(/INV-(\d+)/);
    if (invoiceMatch) {
      const invoiceNum = invoiceMatch[0];
      const matchedInvoice = invoices.find(inv =>
        (inv as any).invoice_number === invoiceNum
      );
      if (matchedInvoice?.client?.full_name) {
        return matchedInvoice.client.full_name;
      }
    }

    // 4. Return dash if no proper name found
    return '-';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Transactions</CardTitle>
            <p className="text-sm text-muted-foreground">Payment history and records</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground mt-1">Transactions will appear here when payments are made</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Date</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Paid To</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Method</TableHead>
                  <TableHead className="text-right font-semibold">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">
                      {new Date(transaction.transaction_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getTypeColor(transaction.transaction_type)}>
                        {transaction.transaction_type.charAt(0).toUpperCase() + transaction.transaction_type.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{getRecipientName(transaction)}</span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{transaction.description || '-'}</TableCell>
                    <TableCell>
                      {transaction.payment_method ? (
                        <Badge variant="secondary" className="text-xs">
                          {transaction.payment_method.toUpperCase()}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-bold ${transaction.transaction_type === 'payment' ? 'text-success' : transaction.transaction_type === 'expense' ? 'text-destructive' : ''}`}>
                        {transaction.transaction_type === 'expense' ? '-' : '+'}₹{Number(transaction.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
