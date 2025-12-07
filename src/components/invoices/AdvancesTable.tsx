// @ts-nocheck - Waiting for database migration to generate types
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wallet, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AddAdvanceDialog from "./AddAdvanceDialog";

interface Advance {
    id: string;
    recipient_id: string;
    recipient_type: string;
    amount: number;
    description: string | null;
    advance_date: string;
    is_deducted: boolean;
    deducted_in_invoice_id: string | null;
    created_at: string;
}

interface AdvancesTableProps {
    userCategory: string;
    subscriptionTier?: string;
}

export default function AdvancesTable({ userCategory, subscriptionTier }: AdvancesTableProps) {
    const [advances, setAdvances] = useState<Advance[]>([]);
    const [editors, setEditors] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Load advances
            const { data: advancesData, error } = await supabase
                .from("advances")
                .select("*")
                .eq("user_id", user.id)
                .order("advance_date", { ascending: false });

            if (error) throw error;
            setAdvances(advancesData || []);

            // Load editors for name lookup
            const { data: editorsData } = await supabase
                .from("editors")
                .select("id, full_name")
                .eq("created_by", user.id);
            setEditors(editorsData || []);

            // Load clients for name lookup
            const { data: clientsData } = await supabase
                .from("clients")
                .select("id, full_name")
                .eq("created_by", user.id);
            setClients(clientsData || []);

        } catch (error) {
            console.error("Error loading advances:", error);
            toast.error("Failed to load advances");
        } finally {
            setLoading(false);
        }
    };

    const getRecipientName = (advance: Advance) => {
        if (advance.recipient_type === "editor") {
            const editor = editors.find(e => e.id === advance.recipient_id);
            return editor?.full_name || "Unknown Editor";
        } else {
            const client = clients.find(c => c.id === advance.recipient_id);
            return client?.full_name || "Unknown Client";
        }
    };

    const handleDelete = async (advance: Advance) => {
        if (advance.is_deducted) {
            toast.error("Cannot delete a deducted advance");
            return;
        }

        if (!confirm("Are you sure you want to delete this advance?")) return;

        try {
            const { error } = await supabase
                .from("advances")
                .delete()
                .eq("id", advance.id);

            if (error) throw error;

            toast.success("Advance deleted");
            loadData();
        } catch (error) {
            console.error("Error deleting advance:", error);
            toast.error("Failed to delete advance");
        }
    };

    // Calculate totals
    const pendingTotal = advances
        .filter(a => !a.is_deducted)
        .reduce((sum, a) => sum + Number(a.amount || 0), 0);

    const deductedTotal = advances
        .filter(a => a.is_deducted)
        .reduce((sum, a) => sum + Number(a.amount || 0), 0);

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
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Wallet className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle>Advances & Expenses</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    Track advance payments given to editors/clients
                                </p>
                            </div>
                        </div>
                        <Button onClick={() => setDialogOpen(true)} className="gap-2">
                            <Plus className="h-4 w-4" />
                            Add Advance
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-warning/10 rounded-lg p-4">
                            <p className="text-sm text-warning font-medium">Pending Advances</p>
                            <p className="text-2xl font-bold text-warning">
                                ₹{pendingTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {advances.filter(a => !a.is_deducted).length} pending
                            </p>
                        </div>
                        <div className="bg-success/10 rounded-lg p-4">
                            <p className="text-sm text-success font-medium">Deducted</p>
                            <p className="text-2xl font-bold text-success">
                                ₹{deductedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {advances.filter(a => a.is_deducted).length} completed
                            </p>
                        </div>
                    </div>

                    {/* Advances Table */}
                    {advances.length === 0 ? (
                        <div className="text-center py-12">
                            <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                            <p className="text-muted-foreground">No advances recorded yet</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                Add an advance to track payments given to editors or clients
                            </p>
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Recipient</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {advances.map((advance) => (
                                        <TableRow key={advance.id}>
                                            <TableCell className="font-medium">
                                                {new Date(advance.advance_date).toLocaleDateString('en-IN', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </TableCell>
                                            <TableCell className="font-semibold">
                                                {getRecipientName(advance)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">
                                                    {advance.recipient_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate">
                                                {advance.description || '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-warning">
                                                ₹{Number(advance.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell>
                                                {advance.is_deducted ? (
                                                    <Badge className="bg-success/10 text-success">Deducted</Badge>
                                                ) : (
                                                    <Badge className="bg-warning/10 text-warning">Pending</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {!advance.is_deducted && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(advance)}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <AddAdvanceDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSuccess={loadData}
                userCategory={userCategory}
                subscriptionTier={subscriptionTier}
            />
        </>
    );
}
