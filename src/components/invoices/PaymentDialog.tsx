// @ts-nocheck - Waiting for database migration to generate types
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any | null;
  onSuccess: () => void;
}

export default function PaymentDialog({
  open,
  onOpenChange,
  invoice,
  onSuccess
}: PaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [paidFromTransactions, setPaidFromTransactions] = useState(0);
  const [formData, setFormData] = useState({
    amount: "",
    paymentMethod: "",
    paymentDate: new Date().toISOString().slice(0, 10),
  });

  const totalAmount = Number(invoice?.total_amount || invoice?.amount || 0);
  const remainingAmount = Math.max(0, totalAmount - paidFromTransactions);

  // Load existing payments from transactions when dialog opens
  useEffect(() => {
    if (open && invoice?.id) {
      loadPaidAmount();
    }
  }, [open, invoice?.id]);

  const loadPaidAmount = async () => {
    try {
      // Get sum of payments from transactions table for this invoice
      const { data, error } = await supabase
        .from("transactions")
        .select("amount")
        .eq("invoice_id", invoice.id)
        .eq("transaction_type", "payment");

      if (error) throw error;

      const totalPaid = (data || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
      setPaidFromTransactions(totalPaid);

      // Set default amount to remaining
      const remaining = Math.max(0, totalAmount - totalPaid);
      setFormData(prev => ({
        ...prev,
        amount: String(remaining)
      }));
    } catch (error) {
      console.error("Error loading paid amount:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoice) return;

    const paymentAmount = Number(formData.amount);

    if (paymentAmount <= 0) {
      toast.error("Payment amount must be greater than 0");
      return;
    }

    if (paymentAmount > remainingAmount) {
      toast.error(`Payment amount cannot exceed remaining amount (₹${remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })})`);
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Calculate new total paid
      const newTotalPaid = paidFromTransactions + paymentAmount;
      const isFullyPaid = newTotalPaid >= totalAmount;
      // Schema allows: draft, sent, paid, overdue, cancelled
      const newStatus = isFullyPaid ? 'paid' : 'sent';

      // Update invoice status
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          status: newStatus,
          paid_at: isFullyPaid ? new Date(formData.paymentDate).toISOString() : null,
        })
        .eq("id", invoice.id);

      if (invoiceError) throw invoiceError;

      // Create transaction record
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          editor_id: user.id,
          invoice_id: invoice.id,
          amount: paymentAmount,
          description: `Payment for invoice ${invoice.invoice_number || invoice.id.slice(0, 8)}`,
          transaction_date: formData.paymentDate,
          transaction_type: 'payment',
          payment_method: formData.paymentMethod || null,
        });

      if (transactionError) throw transactionError;

      toast.success(isFullyPaid
        ? "Invoice marked as fully paid!"
        : `Partial payment of ₹${paymentAmount.toLocaleString('en-IN')} recorded`
      );

      setFormData({
        amount: "",
        paymentMethod: "",
        paymentDate: new Date().toISOString().slice(0, 10),
      });
      setPaidFromTransactions(0);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Failed to process payment");
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>Enter payment details for this invoice</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invoice Details */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>Invoice Number:</span>
              <span className="font-semibold">{invoice.invoice_number || invoice.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Client:</span>
              <span className="font-semibold">{invoice.client?.full_name || 'Unknown'}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2 mt-2">
              <span>Total Amount:</span>
              <span className="font-bold">₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            {paidFromTransactions > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Already Paid:</span>
                <span className="font-semibold">₹{paidFromTransactions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-warning font-medium">
              <span>Remaining:</span>
              <span className="font-bold">₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {remainingAmount <= 0 ? (
            <div className="text-center py-4 text-success font-semibold">
              ✓ This invoice is fully paid!
            </div>
          ) : (
            <>
              {/* Payment Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Payment Amount (₹)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={remainingAmount}
                  placeholder="Enter payment amount"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, amount: String(remainingAmount) })}
                  >
                    Full (₹{remainingAmount.toLocaleString('en-IN')})
                  </Button>
                  {remainingAmount >= 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFormData({ ...formData, amount: String(Math.floor(remainingAmount / 2)) })}
                    >
                      50%
                    </Button>
                  )}
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Payment Method</Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Date */}
              <div className="space-y-2">
                <Label htmlFor="paymentDate">Payment Date</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                  required
                />
              </div>
            </>
          )}

          <DialogFooter className="flex flex-row gap-2 sm:justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || remainingAmount <= 0 || !formData.amount || Number(formData.amount) <= 0 || Number(formData.amount) > remainingAmount}
              style={{ backgroundColor: '#22c55e', color: 'white' }}
              className="hover:opacity-90"
            >
              {loading ? "Processing..." : remainingAmount <= 0 ? "Fully Paid" : `Pay ₹${Number(formData.amount || 0).toLocaleString('en-IN')}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
