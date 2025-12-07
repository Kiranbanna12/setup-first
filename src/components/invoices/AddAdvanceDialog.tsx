// @ts-nocheck - Waiting for database migration to generate types
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AddAdvanceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
    userCategory: string; // 'editor' or 'client'
    subscriptionTier?: string; // 'agency', 'pro', 'free'
}

export default function AddAdvanceDialog({
    open,
    onOpenChange,
    onSuccess,
    userCategory,
    subscriptionTier
}: AddAdvanceDialogProps) {
    const [loading, setLoading] = useState(false);
    const [editors, setEditors] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        recipientType: "",
        recipientId: "",
        amount: "",
        description: "",
        advanceDate: new Date().toISOString().slice(0, 10),
    });

    useEffect(() => {
        if (open) {
            loadRecipients();

            // Auto-set recipient type based on role/plan
            if (subscriptionTier !== 'agency') {
                if (userCategory === 'editor') {
                    setFormData(prev => ({ ...prev, recipientType: 'client' }));
                } else if (userCategory === 'client') {
                    setFormData(prev => ({ ...prev, recipientType: 'editor' }));
                }
            }
        }
    }, [open, userCategory, subscriptionTier]);

    const loadRecipients = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Load editors
            const { data: editorsData } = await supabase
                .from("editors")
                .select("id, full_name")
                .eq("created_by", user.id);
            setEditors(editorsData || []);

            // Load clients
            const { data: clientsData } = await supabase
                .from("clients")
                .select("id, full_name")
                .eq("created_by", user.id);
            setClients(clientsData || []);

        } catch (error) {
            console.error("Error loading recipients:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.recipientType || !formData.recipientId || !formData.amount) {
            toast.error("Please fill all required fields");
            return;
        }

        const amount = Number(formData.amount);
        if (amount <= 0) {
            toast.error("Amount must be greater than 0");
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("You must be logged in");
                return;
            }

            const { error } = await supabase
                .from("advances")
                .insert({
                    user_id: user.id,
                    recipient_id: formData.recipientId,
                    recipient_type: formData.recipientType,
                    amount: amount,
                    description: formData.description || null,
                    advance_date: formData.advanceDate,
                });

            if (error) throw error;

            toast.success("Advance added successfully!");
            setFormData({
                recipientType: "",
                recipientId: "",
                amount: "",
                description: "",
                advanceDate: new Date().toISOString().slice(0, 10),
            });
            onOpenChange(false);
            onSuccess();
        } catch (error) {
            console.error("Error adding advance:", error);
            toast.error("Failed to add advance");
        } finally {
            setLoading(false);
        }
    };

    // Get recipients based on selected type
    const getRecipients = () => {
        if (formData.recipientType === "editor") return editors;
        if (formData.recipientType === "client") return clients;
        return [];
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Add Advance Payment</DialogTitle>
                    <DialogDescription>Record an advance payment given to an editor or client</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Recipient Type */}
                    <div className="space-y-2">
                        <Label>Recipient Type *</Label>
                        <Select
                            value={formData.recipientType}
                            onValueChange={(value) => setFormData({ ...formData, recipientType: value, recipientId: "" })}
                            disabled={subscriptionTier !== 'agency'} // Lock if not agency
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                {/* Agency Plan (or admin) can see both */}
                                {(subscriptionTier === 'agency' || userCategory === 'agency' || userCategory === 'client') && (
                                    <SelectItem value="editor">Editor</SelectItem>
                                )}

                                {/* Agency Plan, Editor, or Admin can see Client */}
                                {(subscriptionTier === 'agency' || userCategory === 'agency' || userCategory === 'editor') && (
                                    <SelectItem value="client">Client</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Recipient Selection */}
                    {formData.recipientType && (
                        <div className="space-y-2">
                            <Label>Select {formData.recipientType === "editor" ? "Editor" : "Client"} *</Label>
                            <Select
                                value={formData.recipientId}
                                onValueChange={(value) => setFormData({ ...formData, recipientId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={`Select ${formData.recipientType}`} />
                                </SelectTrigger>
                                <SelectContent>
                                    {getRecipients().map((recipient) => (
                                        <SelectItem key={recipient.id} value={recipient.id}>
                                            {recipient.full_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {/* Amount */}
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount (₹) *</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="Enter amount"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                            required
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description / Reason</Label>
                        <Textarea
                            id="description"
                            placeholder="e.g., Advance for project work, Travel expense, etc."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                        />
                    </div>

                    {/* Date */}
                    <div className="space-y-2">
                        <Label htmlFor="advanceDate">Date</Label>
                        <Input
                            id="advanceDate"
                            type="date"
                            value={formData.advanceDate}
                            onChange={(e) => setFormData({ ...formData, advanceDate: e.target.value })}
                        />
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !formData.recipientType || !formData.recipientId || !formData.amount}
                        >
                            {loading ? "Adding..." : "Add Advance"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
