import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { isAdminEmail } from "@/lib/adminAuth";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit, Plus, Trash2, Loader2, CheckCircle2, AlertCircle, Calendar, Percent } from "lucide-react";
import { toast } from "sonner";

export default function AdminPlansManagement() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    tier: "basic",
    user_category: "editor",
    billing_period: "monthly",
    price_inr: "",
    client_limit: "",
    editor_limit: "",
    project_limit: "",
    description: "",
    features: "",
    is_active: true
  });
  const [annualDialogOpen, setAnnualDialogOpen] = useState(false);
  const [selectedMonthlyPlan, setSelectedMonthlyPlan] = useState<any>(null);
  const [discountPercentage, setDiscountPercentage] = useState("20");
  const [generatingAnnual, setGeneratingAnnual] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkDiscountPercentage, setBulkDiscountPercentage] = useState("20");
  const [bulkGenerating, setBulkGenerating] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!isAdminEmail(user.email)) {
      toast.error("Access denied. Admin only.");
      navigate("/dashboard");
      return;
    }

    loadPlans();
  };

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans" as any)
        .select("*")
        .order("user_category", { ascending: true })
        .order("price_inr", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error loading plans:", error);
      toast.error("Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  const createRazorpayPlan = async (planId: string, planData: any) => {
    setSyncing(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-razorpay-plan', {
        body: {
          planId,
          name: planData.name,
          description: planData.description || `${planData.name} subscription plan`,
          amount: planData.price_inr,
          period: planData.billing_period === 'annual' ? 'yearly' : 'monthly',
          interval: 1
        }
      });

      if (error) throw error;

      toast.success('Razorpay plan created successfully!');
      await loadPlans();
    } catch (error: any) {
      console.error('Error creating Razorpay plan:', error);
      toast.error(error.message || 'Failed to create Razorpay plan');
    } finally {
      setSyncing(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const planData = {
        name: formData.name,
        tier: formData.tier,
        user_category: formData.user_category,
        billing_period: formData.billing_period,
        price: parseFloat(formData.price_inr) || 0,
        price_inr: parseFloat(formData.price_inr) || 0,
        client_limit: formData.client_limit ? parseInt(formData.client_limit) : null,
        editor_limit: formData.editor_limit ? parseInt(formData.editor_limit) : null,
        project_limit: formData.project_limit ? parseInt(formData.project_limit) : null,
        description: formData.description,
        features: formData.features.split("\n").filter(f => f.trim()),
        is_active: formData.is_active
      };

      let savedPlan;
      if (editingPlan) {
        const { data, error } = await supabase
          .from("subscription_plans" as any)
          .update(planData)
          .eq("id", editingPlan.id)
          .select()
          .single();

        if (error) throw error;
        savedPlan = data;
        toast.success("Plan updated successfully");
      } else {
        const { data, error } = await supabase
          .from("subscription_plans" as any)
          .insert(planData)
          .select()
          .single();

        if (error) throw error;
        savedPlan = data;
        toast.success("Plan created successfully");

        // Automatically create Razorpay plan for new plans
        if (savedPlan) {
          await createRazorpayPlan(savedPlan.id, planData);
        }
      }

      setIsDialogOpen(false);
      resetForm();
      loadPlans();
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Failed to save plan");
    }
  };

  const handleEdit = (plan: any) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      tier: plan.tier || "basic",
      user_category: plan.user_category || "editor",
      billing_period: plan.billing_period || "monthly",
      price_inr: (plan.price_inr || plan.price || 0).toString(),
      client_limit: plan.client_limit?.toString() || "",
      editor_limit: plan.editor_limit?.toString() || "",
      project_limit: plan.project_limit?.toString() || "",
      description: plan.description || "",
      features: Array.isArray(plan.features) ? plan.features.join("\n") : "",
      is_active: plan.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this plan?")) return;

    try {
      const { error } = await supabase
        .from("subscription_plans" as any)
        .delete()
        .eq("id", planId);

      if (error) throw error;
      toast.success("Plan deleted successfully");
      loadPlans();
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast.error("Failed to delete plan");
    }
  };

  const togglePlanStatus = async (planId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("subscription_plans" as any)
        .update({ is_active: !currentStatus })
        .eq("id", planId);

      if (error) throw error;
      toast.success("Plan status updated");
      loadPlans();
    } catch (error) {
      console.error("Error updating plan status:", error);
      toast.error("Failed to update plan status");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      tier: "basic",
      user_category: "editor",
      billing_period: "monthly",
      price_inr: "",
      client_limit: "",
      editor_limit: "",
      project_limit: "",
      description: "",
      features: "",
      is_active: true
    });
    setEditingPlan(null);
  };

  const openAnnualDialog = (plan: any) => {
    setSelectedMonthlyPlan(plan);
    setDiscountPercentage("20");
    setAnnualDialogOpen(true);
  };

  const generateAnnualPlan = async () => {
    if (!selectedMonthlyPlan) return;

    const discount = parseInt(discountPercentage) || 0;
    const monthlyPrice = selectedMonthlyPlan.price_inr || selectedMonthlyPlan.price || 0;
    const annualPrice = Math.round(monthlyPrice * 12 * (1 - discount / 100));

    setGeneratingAnnual(true);
    try {
      // Create annual plan
      const annualPlanData = {
        name: `${selectedMonthlyPlan.name} (Annual)`,
        tier: selectedMonthlyPlan.tier,
        user_category: selectedMonthlyPlan.user_category,
        billing_period: "annual",
        price: annualPrice,
        price_inr: annualPrice,
        client_limit: selectedMonthlyPlan.client_limit,
        editor_limit: selectedMonthlyPlan.editor_limit,
        project_limit: selectedMonthlyPlan.project_limit,
        description: selectedMonthlyPlan.description,
        features: selectedMonthlyPlan.features,
        is_active: true,
        annual_discount_percentage: discount,
        base_monthly_plan_id: selectedMonthlyPlan.id
      };

      const { data, error } = await supabase
        .from("subscription_plans" as any)
        .insert(annualPlanData)
        .select()
        .single();

      if (error) throw error;

      toast.success(`Annual plan created with ${discount}% discount! Price: ₹${annualPrice}/year`);

      // Create Razorpay plan
      if (data) {
        await createRazorpayPlan(data.id, annualPlanData);
      }

      setAnnualDialogOpen(false);
      setSelectedMonthlyPlan(null);
      loadPlans();
    } catch (error: any) {
      console.error("Error generating annual plan:", error);
      toast.error(error.message || "Failed to generate annual plan");
    } finally {
      setGeneratingAnnual(false);
    }
  };

  const getMonthlyPlansWithoutAnnual = () => {
    const monthlyPlans = plans.filter(p => p.billing_period === 'monthly');
    const annualPlanBaseIds = plans
      .filter(p => p.billing_period === 'annual' && p.base_monthly_plan_id)
      .map(p => p.base_monthly_plan_id);
    return monthlyPlans.filter(p => !annualPlanBaseIds.includes(p.id));
  };

  const bulkGenerateAnnualPlans = async () => {
    const plansToConvert = getMonthlyPlansWithoutAnnual();
    if (plansToConvert.length === 0) {
      toast.error("No monthly plans available for conversion (all already have annual versions)");
      return;
    }

    const discount = parseInt(bulkDiscountPercentage) || 0;
    setBulkGenerating(true);

    try {
      let successCount = 0;
      let errorCount = 0;

      for (const plan of plansToConvert) {
        const monthlyPrice = plan.price_inr || plan.price || 0;
        const annualPrice = Math.round(monthlyPrice * 12 * (1 - discount / 100));

        const annualPlanData = {
          name: `${plan.name} (Annual)`,
          tier: plan.tier,
          user_category: plan.user_category,
          billing_period: "annual",
          price: annualPrice,
          price_inr: annualPrice,
          client_limit: plan.client_limit,
          editor_limit: plan.editor_limit,
          project_limit: plan.project_limit,
          description: plan.description,
          features: plan.features,
          is_active: true,
          annual_discount_percentage: discount,
          base_monthly_plan_id: plan.id
        };

        try {
          const { data, error } = await supabase
            .from("subscription_plans" as any)
            .insert(annualPlanData)
            .select()
            .single();

          if (error) throw error;

          if (data) {
            await createRazorpayPlan(data.id, annualPlanData);
          }
          successCount++;
        } catch (err) {
          console.error(`Error creating annual plan for ${plan.name}:`, err);
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`Created ${successCount} annual plan(s) with ${discount}% discount!`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to create ${errorCount} plan(s)`);
      }

      setBulkDialogOpen(false);
      loadPlans();
    } catch (error: any) {
      console.error("Error in bulk generation:", error);
      toast.error(error.message || "Failed to generate annual plans");
    } finally {
      setBulkGenerating(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Plans Management" description="Create and manage subscription plans with Razorpay integration">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="h-10 w-32 bg-muted/50 rounded animate-pulse" />
          </div>
          <Card className="shadow-elegant">
            <CardHeader>
              <div className="h-6 w-32 bg-muted/50 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 w-full bg-muted/30 rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Plans Management" description="Create and manage subscription plans with Razorpay integration">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary" onClick={resetForm}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingPlan ? "Edit Plan" : "Create New Plan"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Plan Name</Label>
                      <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Pro Editor"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tier</Label>
                      <Select
                        value={formData.tier}
                        onValueChange={(value) => setFormData({ ...formData, tier: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="basic">Basic</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>User Category</Label>
                      <Select
                        value={formData.user_category}
                        onValueChange={(value) => setFormData({ ...formData, user_category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="agency">Agency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Billing Period</Label>
                      <Select
                        value={formData.billing_period}
                        onValueChange={(value) => setFormData({ ...formData, billing_period: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Price (₹)</Label>
                      <Input
                        type="number"
                        value={formData.price_inr}
                        onChange={(e) => setFormData({ ...formData, price_inr: e.target.value })}
                        placeholder="e.g., 899"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Project Limit</Label>
                      <Input
                        type="number"
                        placeholder="Leave empty for unlimited"
                        value={formData.project_limit}
                        onChange={(e) => setFormData({ ...formData, project_limit: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Client Limit</Label>
                      <Input
                        type="number"
                        placeholder="Leave empty for unlimited"
                        value={formData.client_limit}
                        onChange={(e) => setFormData({ ...formData, client_limit: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Editor Limit</Label>
                      <Input
                        type="number"
                        placeholder="Leave empty for unlimited"
                        value={formData.editor_limit}
                        onChange={(e) => setFormData({ ...formData, editor_limit: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Brief description of the plan"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Features (one per line)</Label>
                    <Textarea
                      rows={5}
                      value={formData.features}
                      onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                      placeholder="Up to 5 Clients&#10;Unlimited Projects&#10;Priority Support"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                    <Label>Active</Label>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="gradient-primary">
                      {editingPlan ? "Update Plan" : "Create Plan"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {/* Annual Plan Generation Dialog */}
            <Dialog open={annualDialogOpen} onOpenChange={setAnnualDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Generate Annual Plan
                  </DialogTitle>
                </DialogHeader>
                {selectedMonthlyPlan && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                      <p className="text-sm font-medium">Source Plan: {selectedMonthlyPlan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Monthly Price: ₹{selectedMonthlyPlan.price_inr || selectedMonthlyPlan.price}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Percent className="w-4 h-4" />
                        Discount Percentage
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={discountPercentage}
                          onChange={(e) => setDiscountPercentage(e.target.value)}
                          placeholder="e.g., 20"
                          className="flex-1"
                        />
                        <span className="flex items-center text-muted-foreground">%</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg bg-success/10 border border-success/20 space-y-2">
                      <p className="text-sm font-medium text-success">Annual Plan Preview</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm line-through text-muted-foreground">
                          ₹{(selectedMonthlyPlan.price_inr || selectedMonthlyPlan.price) * 12}
                        </span>
                        <span className="text-lg font-bold text-success">
                          ₹{Math.round((selectedMonthlyPlan.price_inr || selectedMonthlyPlan.price) * 12 * (1 - (parseInt(discountPercentage) || 0) / 100))}
                        </span>
                        <span className="text-sm text-muted-foreground">/ year</span>
                      </div>
                      <Badge className="bg-success">Save {discountPercentage || 0}%</Badge>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setAnnualDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="gradient-primary"
                        onClick={generateAnnualPlan}
                        disabled={generatingAnnual}
                      >
                        {generatingAnnual && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Generate Annual Plan
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Bulk Annual Conversion Button & Dialog */}
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(true)}
              disabled={getMonthlyPlansWithoutAnnual().length === 0}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Convert All to Annual
              {getMonthlyPlansWithoutAnnual().length > 0 && (
                <Badge className="ml-2 bg-success">{getMonthlyPlansWithoutAnnual().length}</Badge>
              )}
            </Button>

            <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Bulk Convert to Annual Plans
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                    <p className="text-sm font-medium">Monthly Plans to Convert:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {getMonthlyPlansWithoutAnnual().map(plan => (
                        <div key={plan.id} className="text-xs flex justify-between">
                          <span>{plan.name} ({plan.user_category})</span>
                          <span className="text-muted-foreground">₹{plan.price_inr}/mo</span>
                        </div>
                      ))}
                    </div>
                    {getMonthlyPlansWithoutAnnual().length === 0 && (
                      <p className="text-xs text-muted-foreground">All monthly plans already have annual versions</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Discount Percentage (applied to all)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={bulkDiscountPercentage}
                        onChange={(e) => setBulkDiscountPercentage(e.target.value)}
                        placeholder="e.g., 20"
                        className="flex-1"
                      />
                      <span className="flex items-center text-muted-foreground">%</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-success/10 border border-success/20 space-y-2">
                    <p className="text-sm font-medium text-success">Summary</p>
                    <p className="text-xs">
                      {getMonthlyPlansWithoutAnnual().length} annual plan(s) will be created with {bulkDiscountPercentage}% discount
                    </p>
                    <Badge className="bg-success">Save {bulkDiscountPercentage || 0}% on all annual plans</Badge>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setBulkDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="gradient-primary"
                      onClick={bulkGenerateAnnualPlans}
                      disabled={bulkGenerating || getMonthlyPlansWithoutAnnual().length === 0}
                    >
                      {bulkGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Convert {getMonthlyPlansWithoutAnnual().length} Plan(s)
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>All Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Limits</TableHead>
                    <TableHead>Razorpay</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell className="capitalize">{plan.user_category}</TableCell>
                      <TableCell className="capitalize">{plan.tier}</TableCell>
                      <TableCell>₹{plan.price_inr || plan.price}/{plan.billing_period === 'annual' ? 'yr' : 'mo'}</TableCell>
                      <TableCell>
                        <div className="text-xs space-y-1">
                          <div>Editors: {plan.editor_limit === null ? "∞" : plan.editor_limit}</div>
                          <div>Clients: {plan.client_limit === null ? "∞" : plan.client_limit}</div>
                          <div>Projects: {plan.project_limit === null ? "∞" : plan.project_limit}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {plan.razorpay_plan_id ? (
                          <Badge className="bg-success text-xs">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Synced
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => createRazorpayPlan(plan.id, plan)}
                            disabled={syncing === plan.id}
                          >
                            {syncing === plan.id ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <AlertCircle className="w-3 h-3 mr-1 text-warning" />
                            )}
                            Sync to Razorpay
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={plan.is_active ? "bg-success" : "bg-secondary"}>
                          {plan.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          {plan.billing_period === 'monthly' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => openAnnualDialog(plan)}
                            >
                              <Calendar className="w-3 h-3 mr-1" />
                              Annual
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleEdit(plan)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => togglePlanStatus(plan.id, plan.is_active)}
                          >
                            {plan.is_active ? "Disable" : "Enable"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(plan.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {plans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No plans created yet. Click "Create Plan" to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
