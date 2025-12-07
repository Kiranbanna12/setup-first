// @ts-nocheck - Waiting for database migration to generate types
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Project {
  id: string;
  name: string;
  fee: number;
  status: string;
  client_id?: string;
}

interface Client {
  id: string;
  full_name: string;
}

interface Advance {
  id: string;
  recipient_id: string;
  recipient_type: string;
  amount: number;
  description: string | null;
  advance_date: string;
}

interface EnhancedCreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export default function EnhancedCreateInvoiceDialog({
  open,
  onOpenChange,
  onSuccess
}: EnhancedCreateInvoiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedAdvances, setSelectedAdvances] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    clientId: "",
    notes: "",
    dueDate: "",
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Load pending advances when client is selected
  useEffect(() => {
    if (formData.clientId) {
      loadAdvancesForClient(formData.clientId);
    } else {
      setAdvances([]);
      setSelectedAdvances(new Set());
    }
  }, [formData.clientId]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load projects without invoice
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, fee, status, client_id")
        .eq("created_by", user.id)
        .is("invoice_id", null)
        .not("fee", "is", null);

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // Load clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name")
        .eq("created_by", user.id);

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    }
  };

  const loadAdvancesForClient = async (clientId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load pending advances for this client
      const { data: advancesData } = await supabase
        .from("advances")
        .select("*")
        .eq("user_id", user.id)
        .eq("recipient_id", clientId)
        .eq("recipient_type", "client")
        .eq("is_deducted", false);

      setAdvances(advancesData || []);
    } catch (error) {
      console.error("Error loading advances:", error);
    }
  };

  const toggleProject = (projectId: string) => {
    const newSelected = new Set(selectedProjects);
    if (newSelected.has(projectId)) {
      newSelected.delete(projectId);
    } else {
      newSelected.add(projectId);
    }
    setSelectedProjects(newSelected);

    // Auto-select client from first selected project if not already set
    if (!formData.clientId && newSelected.size > 0) {
      const firstProject = projects.find(p => newSelected.has(p.id));
      if (firstProject?.client_id) {
        setFormData(prev => ({ ...prev, clientId: firstProject.client_id! }));
      }
    }
  };

  const toggleAdvance = (advanceId: string) => {
    const newSelected = new Set(selectedAdvances);
    if (newSelected.has(advanceId)) {
      newSelected.delete(advanceId);
    } else {
      newSelected.add(advanceId);
    }
    setSelectedAdvances(newSelected);
  };

  const calculateProjectTotal = () => {
    return projects
      .filter(p => selectedProjects.has(p.id))
      .reduce((sum, p) => sum + Number(p.fee || 0), 0);
  };

  const calculateDeduction = () => {
    return advances
      .filter(a => selectedAdvances.has(a.id))
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
  };

  const calculateFinalTotal = () => {
    return Math.max(0, calculateProjectTotal() - calculateDeduction());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedProjects.size === 0) {
      toast.error("Please select at least one project");
      return;
    }

    if (!formData.clientId) {
      toast.error("Please select a client for the invoice");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      const projectTotal = calculateProjectTotal();
      const deduction = calculateDeduction();
      const finalTotal = calculateFinalTotal();
      const invoiceNumber = `INV-${Date.now()}`;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert({
          user_id: user.id,
          client_id: formData.clientId,
          amount: projectTotal,
          total_amount: finalTotal,
          invoice_number: invoiceNumber,
          notes: formData.notes
            ? `${formData.notes}${deduction > 0 ? `\n\nAdvance Deduction: ₹${deduction.toLocaleString('en-IN')}` : ''}`
            : deduction > 0 ? `Advance Deduction: ₹${deduction.toLocaleString('en-IN')}` : null,
          due_date: formData.dueDate || null,
          status: 'draft',
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Link projects to invoice
      for (const projectId of selectedProjects) {
        const { error: updateError } = await supabase
          .from("projects")
          .update({ invoice_id: invoice.id })
          .eq("id", projectId);

        if (updateError) throw updateError;
      }

      // Mark advances as deducted
      for (const advanceId of selectedAdvances) {
        const { error: advanceError } = await supabase
          .from("advances")
          .update({
            is_deducted: true,
            deducted_in_invoice_id: invoice.id
          })
          .eq("id", advanceId);

        if (advanceError) throw advanceError;
      }

      toast.success("Invoice created successfully");
      setFormData({ clientId: "", notes: "", dueDate: "" });
      setSelectedProjects(new Set());
      setSelectedAdvances(new Set());
      setAdvances([]);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Invoice</DialogTitle>
          <DialogDescription>Select projects and a client to create an invoice</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select
              value={formData.clientId}
              onValueChange={(value) => setFormData({ ...formData, clientId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (Optional)</Label>
            <Input
              id="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
            />
          </div>

          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Select Projects</Label>
            <ScrollArea className="h-[150px] rounded-md border p-4">
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects available for invoicing</p>
              ) : (
                <div className="space-y-2">
                  {projects.map((project) => (
                    <div key={project.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={project.id}
                        checked={selectedProjects.has(project.id)}
                        onCheckedChange={() => toggleProject(project.id)}
                      />
                      <label
                        htmlFor={project.id}
                        className="flex-1 text-sm font-medium leading-none cursor-pointer"
                      >
                        {project.name} - ₹{Number(project.fee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Available Advances for Deduction */}
          {advances.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Deduct Advances
                <Badge variant="secondary" className="text-xs">{advances.length} available</Badge>
              </Label>
              <ScrollArea className="h-[120px] rounded-md border p-4 bg-warning/5">
                <div className="space-y-2">
                  {advances.map((advance) => (
                    <div key={advance.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`adv-${advance.id}`}
                        checked={selectedAdvances.has(advance.id)}
                        onCheckedChange={() => toggleAdvance(advance.id)}
                      />
                      <label
                        htmlFor={`adv-${advance.id}`}
                        className="flex-1 text-sm font-medium leading-none cursor-pointer"
                      >
                        <span className="text-warning font-semibold">
                          -₹{Number(advance.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-muted-foreground ml-2 text-xs">
                          {advance.description || 'Advance'} ({new Date(advance.advance_date).toLocaleDateString('en-IN')})
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Total Summary */}
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm">Projects Total:</span>
              <span className="font-semibold">₹{calculateProjectTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            {calculateDeduction() > 0 && (
              <div className="flex justify-between items-center text-warning">
                <span className="text-sm">Advance Deduction:</span>
                <span className="font-semibold">-₹{calculateDeduction().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between items-center border-t pt-2">
              <span className="font-semibold">Final Amount:</span>
              <span className="text-2xl font-bold">₹{calculateFinalTotal().toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedProjects.size} project{selectedProjects.size !== 1 ? 's' : ''} selected
              {selectedAdvances.size > 0 && `, ${selectedAdvances.size} advance${selectedAdvances.size !== 1 ? 's' : ''} deducted`}
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || selectedProjects.size === 0 || !formData.clientId}>
              {loading ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
