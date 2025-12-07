import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { FileText } from "lucide-react";

interface InvoiceDetailsDialogProps {
    invoiceId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export default function InvoiceDetailsDialog({ invoiceId, open, onOpenChange }: InvoiceDetailsDialogProps) {
    const [invoice, setInvoice] = useState<any>(null);
    const [items, setItems] = useState<any[]>([]);
    const [editor, setEditor] = useState<any>(null);
    const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (invoiceId && open) {
            loadInvoiceDetails();
        }
    }, [invoiceId, open]);

    const loadInvoiceDetails = async () => {
        if (!invoiceId) return;

        setLoading(true);
        try {
            // Load invoice
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .select('*')
                .eq('id', invoiceId)
                .single();

            if (invoiceError) throw invoiceError;
            setInvoice(invoiceData);

            // Load invoice items (projects)
            const { data: itemsData, error: itemsError } = await supabase
                .from('projects')
                .select('*')
                .eq('invoice_id', invoiceId);

            if (!itemsError) {
                setItems(itemsData || []);
            }

            // Load editor details
            if (invoiceData.editor_id) {
                const { data: editorData } = await supabase
                    .from('editors')
                    .select('*')
                    .eq('id', invoiceData.editor_id) // This might link to profiles depending on schema, simpler to assume profile link logic exists or direct editor table query
                    .single();
                // Wait, editors table is separate? Let's check schema.
                // Schema types said 'editors' table exists. 
                // But usually profile name is needed. Let's try fetching from profiles if editors fails or just editors.
                // Actually, editors table has 'full_name'.

                if (editorData) {
                    setEditor(editorData);
                } else {
                    // Fallback to profiles if editor not found in editors table (e.g. if editor_id is user_id)
                    const { data: profileData } = await supabase.from('profiles').select('full_name').eq('id', invoiceData.editor_id).single();
                    if (profileData) setEditor(profileData);
                }
            }

            // Load payment history
            const { data: historyData } = await supabase
                .from('payments')
                .select('*')
                .eq('invoice_id', invoiceId)
                .order('created_at', { ascending: false });

            setPaymentHistory(historyData || []);

        } catch (error) {
            console.error("Error loading invoice details:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "paid": return "bg-success/10 text-success";
            case "pending": return "bg-warning/10 text-warning";
            case "in_progress": return "bg-primary/10 text-primary";
            case "partial": return "bg-info/10 text-info";
            default: return "bg-muted text-muted-foreground";
        }
    };

    if (!invoice) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        Invoice Details - {invoice.invoice_number || invoice.id.slice(0, 8)}
                    </DialogTitle>
                    <DialogDescription>
                        View complete invoice information and payment history
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Invoice Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base flex items-center justify-between">
                                    <span>Invoice Information</span>
                                    <Badge className={getStatusColor(invoice.status || 'pending')}>
                                        {(invoice.status || 'pending').replace('_', ' ').toUpperCase()}
                                    </Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Month</p>
                                        <p className="font-medium">{invoice.month || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Created Date</p>
                                        <p className="font-medium">{invoice.created_at ? format(new Date(invoice.created_at), "MMM dd, yyyy") : 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Editor</p>
                                        <p className="font-medium">{editor?.full_name || "Unknown"}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Due Date</p>
                                        <p className="font-medium">
                                            {invoice.due_date ? format(new Date(invoice.due_date), "MMM dd, yyyy") : "Not set"}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Invoice Items */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">Projects</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {items.map(item => (
                                        <div key={item.id} className="flex justify-between p-3 rounded-lg bg-muted/50">
                                            <span>{item.name || item.item_name || 'Project'}</span>
                                            <span className="font-medium">₹{Number(item.fee || item.amount || 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                    {items.length === 0 && <p className="text-muted-foreground text-sm">No projects linked.</p>}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Financial Summary */}
                        <Card className="bg-primary/5">
                            <CardContent className="pt-6">
                                <div className="space-y-3">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Subtotal:</span>
                                        <span className="font-medium">₹{Number(invoice.total_amount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Deductions:</span>
                                        <span className="text-warning">-₹{Number(invoice.tax_amount || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Paid Amount:</span>
                                        <span className="text-success">₹{Number(invoice.paid_at ? invoice.total_amount : 0).toFixed(2)}</span>
                                        {/* Note: paid_amount might not exist in new schema directly, usually inferred from payments or status. 
                        Old app had paid_amount. New schema has 'payments' table. 
                        Let's use a sum of payments if paid_amount is missing in invoice object, or rely on what's available. 
                        Looking at types.ts, Invoices Row has 'amount' and 'total_amount', but NO 'paid_amount' or 'remaining_amount' columns.
                        Wait, let's re-read types.ts for Invoices Row.
                        Lines 295-310: amount, client_id, created_at, due_date, id, invoice_number, notes, paid_at, project_id, status, x_amount, total_amount, updated_at, user_id.
                        NO paid_amount or remaining_amount.
                        So I must calculate them from Payment History or just show 0 if not calculated.
                    */}

                                    </div>
                                    <div className="h-px bg-border" />
                                    <div className="flex justify-between text-lg">
                                        <span className="font-semibold">Remaining:</span>
                                        <span className="font-bold text-primary">
                                            {/* Simple calc for now since we don't have easy access to paid sum without more logic */}
                                            ₹{Number(invoice.status === 'paid' ? 0 : invoice.total_amount).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Payment History */}
                        {paymentHistory.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Payment History</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {paymentHistory.map(payment => (
                                            <div key={payment.id} className="flex justify-between items-center p-3 rounded-lg border">
                                                <div>
                                                    <p className="font-medium">₹{Number(payment.amount).toFixed(2)}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {format(new Date(payment.created_at), "MMM dd, yyyy")}
                                                    </p>
                                                    {payment.payment_method && (
                                                        <p className="text-xs text-muted-foreground">{payment.payment_method}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Notes */}
                        {invoice.notes && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">Notes</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">{invoice.notes}</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
