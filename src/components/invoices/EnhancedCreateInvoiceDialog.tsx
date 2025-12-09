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
  editor_id?: string;
}

interface Client {
  id: string;
  full_name: string;
  employment_type?: string;
  monthly_rate?: number;
}

interface Editor {
  id: string;
  full_name: string;
  employment_type?: string;
  monthly_rate?: number;
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
  userCategory?: string; // 'editor' | 'client'
  isAgency?: boolean;
}

export default function EnhancedCreateInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
  userCategory = 'editor',
  isAgency = false
}: EnhancedCreateInvoiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [editors, setEditors] = useState<Editor[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [selectedAdvances, setSelectedAdvances] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    recipientId: "",
    recipientType: "" as "client" | "editor" | "",
    notes: "",
    dueDate: "",
  });
  const [includeMonthlyFee, setIncludeMonthlyFee] = useState(false);
  const [selectedRecipientData, setSelectedRecipientData] = useState<Client | Editor | null>(null);

  // Role-based logic
  const isEditor = userCategory === 'editor';
  const isClient = userCategory === 'client';
  const showClients = isAgency || isEditor;
  const showEditors = isAgency || isClient;

  // Get appropriate label
  const getRecipientLabel = () => {
    if (isAgency) return "Client/Editor";
    if (isEditor) return "Client";
    if (isClient) return "Editor";
    return "Recipient";
  };

  // Combine recipients based on role
  const getRecipientOptions = () => {
    const options: { id: string; name: string; type: 'client' | 'editor'; data: Client | Editor }[] = [];

    if (showClients && clients.length > 0) {
      clients.forEach(c => options.push({ id: c.id, name: c.full_name, type: 'client', data: c }));
    }

    if (showEditors && editors.length > 0) {
      editors.forEach(e => options.push({ id: e.id, name: e.full_name, type: 'editor', data: e }));
    }

    return options;
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  // Load pending advances and reset project selection when recipient changes
  useEffect(() => {
    if (formData.recipientId && formData.recipientType) {
      // Find the recipient in the appropriate list
      const recipientList = formData.recipientType === 'client' ? clients : editors;
      const recipient = recipientList.find(r => r.id === formData.recipientId) || null;
      setSelectedRecipientData(recipient);

      // Auto-select monthly fee if fulltime
      if (recipient?.employment_type === 'fulltime') {
        setIncludeMonthlyFee(true);
      } else {
        setIncludeMonthlyFee(false);
      }

      loadAdvancesForRecipient(formData.recipientId, formData.recipientType);
      // Reset project selection when recipient changes
      setSelectedProjects(new Set());
    } else {
      setSelectedRecipientData(null);
      setIncludeMonthlyFee(false);
      setAdvances([]);
      setSelectedAdvances(new Set());
      setSelectedProjects(new Set());
    }
  }, [formData.recipientId, formData.recipientType, clients, editors]);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load projects without invoice
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, fee, status, client_id, editor_id")
        .eq("created_by", user.id)
        .is("invoice_id", null)
        .not("fee", "is", null);

      if (projectsError) throw projectsError;
      setProjects(projectsData || []);

      // Load clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("id, full_name, employment_type, monthly_rate")
        .eq("created_by", user.id);

      if (clientsError) throw clientsError;
      setClients(clientsData || []);

      // Load editors
      const { data: editorsData, error: editorsError } = await supabase
        .from("editors")
        .select("id, full_name")
        .eq("created_by", user.id);

      if (editorsError) throw editorsError;
      setEditors(editorsData || []);

    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    }
  };

  const loadAdvancesForRecipient = async (recipientId: string, recipientType: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load pending advances for this recipient
      const { data: advancesData } = await supabase
        .from("advances")
        .select("*")
        .eq("user_id", user.id)
        .eq("recipient_id", recipientId)
        .eq("recipient_type", recipientType)
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
    const monthlyFee = includeMonthlyFee && selectedRecipientData?.monthly_rate ? Number(selectedRecipientData.monthly_rate) : 0;
    return Math.max(0, calculateProjectTotal() + monthlyFee - calculateDeduction());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedProjects.size === 0 && !includeMonthlyFee) {
      toast.error("Please select at least one project or include a monthly fee");
      return;
    }

    if (!formData.recipientId || !formData.recipientType) {
      toast.error(`Please select a ${getRecipientLabel().toLowerCase()} for the invoice`);
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

      // Create invoice - set client_id or editor_id based on recipient type
      const invoiceData: any = {
        user_id: user.id,
        amount: projectTotal,
        monthly_fee: includeMonthlyFee && selectedRecipientData?.monthly_rate ? Number(selectedRecipientData.monthly_rate) : 0,
        total_amount: finalTotal,
        invoice_number: invoiceNumber,
        notes: formData.notes
          ? `${formData.notes}${deduction > 0 ? `\n\nAdvance Deduction: ₹${deduction.toLocaleString('en-IN')}` : ''}`
          : deduction > 0 ? `Advance Deduction: ₹${deduction.toLocaleString('en-IN')}` : null,
        due_date: formData.dueDate || null,
        status: 'draft',
      };

      // Set client_id or editor_id based on recipient type
      if (formData.recipientType === 'client') {
        invoiceData.client_id = formData.recipientId;
      } else if (formData.recipientType === 'editor') {
        invoiceData.editor_id = formData.recipientId;
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert(invoiceData)
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
      setFormData({ recipientId: "", recipientType: "", notes: "", dueDate: "" });
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
          <DialogDescription>Select projects and a {getRecipientLabel().toLowerCase()} to create an invoice</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipient Selection (Client/Editor based on role) */}
          <div className="space-y-2">
            <Label htmlFor="recipient">{getRecipientLabel()} *</Label>
            <Select
              value={formData.recipientId ? `${formData.recipientType}:${formData.recipientId}` : ""}
              onValueChange={(value) => {
                const [type, id] = value.split(':');
                setFormData({ ...formData, recipientId: id, recipientType: type as 'client' | 'editor' });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={`Select a ${getRecipientLabel().toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {getRecipientOptions().map((recipient) => (
                  <SelectItem key={`${recipient.type}:${recipient.id}`} value={`${recipient.type}:${recipient.id}`}>
                    {recipient.name} {isAgency && <span className="text-muted-foreground">({recipient.type === 'client' ? 'Client' : 'Editor'})</span>}
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

          {selectedRecipientData && (
            <div className="flex items-center space-x-2 border rounded-lg p-3">
              <Checkbox
                id="monthlyFee"
                checked={includeMonthlyFee}
                onCheckedChange={(checked) => setIncludeMonthlyFee(!!checked)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="monthlyFee"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Include {selectedRecipientData.employment_type === 'fulltime' ? 'Monthly Salary' : 'Monthly Retainer'}
                </label>
                <p className="text-sm text-muted-foreground">
                  Add fee of ₹{Number(selectedRecipientData.monthly_rate || 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Select Projects {formData.recipientId && <span className="text-muted-foreground text-xs">(for selected {getRecipientLabel().toLowerCase()})</span>}</Label>
            <ScrollArea className="h-[150px] rounded-md border p-4">
              {!formData.recipientId ? (
                <p className="text-sm text-muted-foreground">Please select a {getRecipientLabel().toLowerCase()} first to see their projects</p>
              ) : (() => {
                // Filter projects based on recipient type
                const filteredProjects = projects.filter(p =>
                  formData.recipientType === 'client'
                    ? p.client_id === formData.recipientId
                    : p.editor_id === formData.recipientId
                );

                if (filteredProjects.length === 0) {
                  return <p className="text-sm text-muted-foreground">No projects available for this {getRecipientLabel().toLowerCase()}</p>;
                }

                return (
                  <div className="space-y-2">
                    {filteredProjects.map((project) => (
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
                );
              })()}
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
            <Button type="submit" disabled={loading || (selectedProjects.size === 0 && !includeMonthlyFee) || !formData.recipientId}>
              {loading ? "Creating..." : "Create Invoice"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
