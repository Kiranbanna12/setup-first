import { useEffect, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Crown, CreditCard, User, Zap, CheckCircle2, XCircle, AlertCircle,
    Calendar, ArrowRight, Plus, Trash2, Star, Shield, Clock,
    Sparkles, Loader2, ArrowLeft
} from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { usePlans } from "@/hooks/usePlans";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CurrencySelector } from "@/components/CurrencySelector";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PaymentMethod {
    id: string;
    type: string;
    last4: string;
    brand: string;
    expiry: string;
    is_default: boolean;
}

const SubscriptionManagement = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [processing, setProcessing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("editor");
    const [billingPeriod, setBillingPeriod] = useState("monthly");
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [isTrialEligible, setIsTrialEligible] = useState(false);
    const [hasAnySubscription, setHasAnySubscription] = useState(false);
    const { plans: allPlans, loading: plansLoading } = usePlans();
    const { formatPrice, currency, currencyInfo } = useCurrency();

    const categories = [
        {
            id: "editor",
            name: "Editor",
            icon: Sparkles,
            description: "For individual video editors"
        },
        {
            id: "client",
            name: "Client",
            icon: Crown,
            description: "For clients managing projects"
        },
        {
            id: "agency",
            name: "Agency",
            icon: Zap,
            description: "For teams and agencies"
        }
    ];

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate("/auth");
                return;
            }

            try {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profileData) {
                    setProfile(profileData);

                    // Check trial eligibility
                    const hasActiveOrPastSub = profileData?.subscription_active ||
                        (profileData?.subscription_tier && profileData.subscription_tier !== 'basic');
                    setHasAnySubscription(!!hasActiveOrPastSub);
                    setIsTrialEligible(!hasActiveOrPastSub);
                }
            } catch (error) {
                setProfile({ ...session.user });
                setIsTrialEligible(true); // First time user
                setHasAnySubscription(false);
            }

            // Load payment methods (mock for now)
            setPaymentMethods([]);
        } catch (error: any) {
            console.error("Load data error:", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (tier: string) => {
        if (tier === profile?.subscription_tier) {
            toast.info("You are already on this plan");
            return;
        }

        // Find the plan with this tier
        const plan = allPlans.find(p => p.tier === tier && p.category === profile?.user_category);
        if (plan) {
            await initiateRazorpayPayment(plan);
        } else {
            toast.error("Plan not found");
        }
    };

    const handleCancelSubscription = async () => {
        setProcessing(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    subscription_active: false,
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id);

            if (error) throw error;

            toast.success("Subscription cancelled. It will remain active until the end of the billing period.");
            await loadData();
        } catch (error: any) {
            toast.error(error.message || "Failed to cancel subscription");
        } finally {
            setProcessing(false);
        }
    };

    const initiateRazorpayPayment = async (plan: any) => {
        setProcessing(true);
        setSelectedPlan(plan.id);

        try {
            // Get Razorpay config
            const { data: config } = await supabase
                .from("app_settings" as any)
                .select("value")
                .eq("key", "razorpay_config")
                .single();

            if (!config || !("value" in config) || !(config.value as any).key_id) {
                toast.error("Payment gateway not configured. Please contact admin.");
                setProcessing(false);
                setSelectedPlan(null);
                return;
            }

            const razorpayKeyId = (config.value as any).key_id;

            // Create order via edge function
            const { data: order, error: orderError } = await supabase.functions.invoke("create-razorpay-order", {
                body: { amount: plan.price, planId: plan.id }
            });

            if (orderError) throw orderError;

            // Load Razorpay script if not already loaded
            if (!(window as any).Razorpay) {
                const script = document.createElement('script');
                script.src = 'https://checkout.razorpay.com/v1/checkout.js';
                script.async = true;
                document.body.appendChild(script);
                await new Promise(resolve => script.onload = resolve);
            }

            // Initialize Razorpay
            const options = {
                key: razorpayKeyId,
                amount: plan.price * 100, // Amount in paise
                currency: "INR",
                name: "Xrozen Workflow",
                description: `${plan.name} - ${plan.billing_period}`,
                order_id: order.id,
                handler: async (response: any) => {
                    await verifyPaymentAndActivate(response, plan);
                },
                prefill: {
                    email: profile?.email || ""
                },
                theme: {
                    color: "#6366f1"
                }
            };

            const razorpay = new (window as any).Razorpay(options);
            razorpay.on('payment.failed', (response: any) => {
                toast.error("Payment failed. Please try again.");
                setProcessing(false);
                setSelectedPlan(null);
            });
            razorpay.open();
        } catch (error: any) {
            console.error("Payment initiation error:", error);
            toast.error(error.message || "Failed to initiate payment");
            setProcessing(false);
            setSelectedPlan(null);
        }
    };

    const verifyPaymentAndActivate = async (paymentResponse: any, plan: any) => {
        try {
            // Verify payment via edge function
            const { error: verifyError } = await supabase.functions.invoke("verify-razorpay-payment", {
                body: paymentResponse
            });

            if (verifyError) throw verifyError;

            // Payment verified - now activate subscription
            const endDate = new Date();
            if (plan.billing_period === 'monthly') {
                endDate.setMonth(endDate.getMonth() + 1);
            } else {
                endDate.setFullYear(endDate.getFullYear() + 1);
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    subscription_tier: plan.tier,
                    subscription_active: true,
                    billing_period: plan.billing_period,
                    subscription_end_date: endDate.toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', profile.id);

            if (updateError) throw updateError;

            toast.success("Payment successful! Subscription activated.");
            await loadData();
        } catch (error: any) {
            console.error("Payment verification error:", error);
            toast.error(error.message || "Payment verification failed");
        } finally {
            setProcessing(false);
            setSelectedPlan(null);
        }
    };

    const handleSubscribe = async (planId: string) => {
        if (!profile) {
            toast.error("Please login to subscribe");
            navigate("/auth");
            return;
        }

        const plan = allPlans.find(p => p.id === planId);
        if (plan) {
            await initiateRazorpayPayment(plan);
        } else {
            toast.error("Plan not found");
        }
    };

    const handleSetDefaultPayment = async (id: string) => {
        toast.info("Default payment method updated");
    };

    const handleRemovePayment = async (id: string) => {
        toast.info("Payment method removed");
    };

    const currentTier = profile?.subscription_tier || "basic";
    const hasActiveSubscription = profile?.subscription_active === true;
    const currentCategory = profile?.user_category;

    const getPlansByCategory = (category: string) => {
        return allPlans.filter(plan => plan.category === category);
    };

    const filteredPlans = getPlansByCategory(selectedCategory).filter(plan =>
        plan.billing_period === billingPeriod
    );

    const isPlanPopular = (planTier: string) => {
        return planTier === 'pro';
    };

    if (loading || plansLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center space-y-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="text-sm text-muted-foreground">Loading subscription details...</p>
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
                                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Subscription Management</h1>
                                    <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                                        Manage your plan and payment methods
                                    </p>
                                </div>
                                <CurrencySelector />
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto">
                        <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto w-full">
                            <div className="grid gap-4 sm:gap-6">
                                {/* Current Subscription Card */}
                                <Card className="shadow-elegant border-2">
                                    <CardHeader>
                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                            <div>
                                                <CardTitle className="text-lg sm:text-xl">Current Subscription</CardTitle>
                                                <CardDescription className="text-xs sm:text-sm">
                                                    {profile?.subscription_active ? "Active" : "Inactive"}
                                                </CardDescription>
                                            </div>
                                            {profile?.subscription_active && (
                                                <Badge className="bg-success text-xs sm:text-sm">
                                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                                    Active
                                                </Badge>
                                            )}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-center justify-between flex-wrap gap-4">
                                            <div className="flex items-center gap-3">
                                                {React.createElement(categories.find(c => c.id === profile?.user_category)?.icon || User, {
                                                    className: "w-8 h-8 sm:w-10 sm:h-10 text-primary"
                                                })}
                                                <div>
                                                    <h3 className="text-xl sm:text-2xl font-bold capitalize">{currentTier}</h3>
                                                    <p className="text-sm sm:text-base text-muted-foreground">
                                                        {profile?.subscription_active ? "Active Plan" : "No Active Plan"}
                                                    </p>
                                                </div>
                                            </div>
                                            {profile?.subscription_end_date && (
                                                <div className="text-right">
                                                    <p className="text-xs text-muted-foreground">Next billing date</p>
                                                    <p className="text-sm sm:text-base font-semibold">
                                                        {format(new Date(profile.subscription_end_date), "MMM dd, yyyy")}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        {profile?.subscription_active && (
                                            <>
                                                <Separator />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="outline" className="w-full sm:w-auto text-destructive hover:bg-destructive/10 text-xs sm:text-sm">
                                                            <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                                                            Cancel Subscription
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Cancel Subscription?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Your subscription will remain active until the end of the current billing period.
                                                                After that, you'll be downgraded to the Basic plan.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                                                            <AlertDialogAction
                                                                onClick={handleCancelSubscription}
                                                                className="bg-destructive hover:bg-destructive/90"
                                                            >
                                                                {processing ? "Cancelling..." : "Yes, Cancel"}
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Available Plans */}
                                <div className="space-y-3 sm:space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div>
                                            <h2 className="text-lg sm:text-xl font-bold">Available Plans</h2>
                                            <p className="text-xs sm:text-sm text-muted-foreground">Upgrade or change your subscription</p>
                                        </div>

                                        {/* Category & Billing Period Selectors */}
                                        <div className="flex items-center gap-3">
                                            <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
                                                <TabsList className="grid grid-cols-3">
                                                    {categories.map((category) => (
                                                        <TabsTrigger key={category.id} value={category.id} className="text-xs">
                                                            {category.name}
                                                        </TabsTrigger>
                                                    ))}
                                                </TabsList>
                                            </Tabs>

                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    variant={billingPeriod === "monthly" ? "default" : "outline"}
                                                    onClick={() => setBillingPeriod("monthly")}
                                                    className="text-xs"
                                                >
                                                    Monthly
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant={billingPeriod === "annual" ? "default" : "outline"}
                                                    onClick={() => setBillingPeriod("annual")}
                                                    className="text-xs"
                                                >
                                                    Annual
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                                        {filteredPlans.map((plan) => {
                                            const IconComponent = categories.find(c => c.id === plan.category)?.icon || User;

                                            // Get user's actual billing period from active subscription
                                            const userBillingPeriod = profile?.billing_period || 'monthly';

                                            // Only show as current if user has ACTIVE subscription AND tier+category+billing_period ALL match
                                            const isCurrent = hasActiveSubscription &&
                                                plan.tier === currentTier &&
                                                plan.category === currentCategory &&
                                                plan.billing_period === userBillingPeriod;

                                            // Determine if this is upgrade, downgrade, or category change
                                            const tierOrder = { basic: 0, pro: 1, premium: 2 };
                                            const categoryOrder = { editor: 0, client: 1, agency: 2 };

                                            const currentTierOrder = tierOrder[currentTier as keyof typeof tierOrder] || 0;
                                            const planTierOrder = tierOrder[plan.tier as keyof typeof tierOrder] || 0;
                                            const currentCategoryOrder = categoryOrder[currentCategory as keyof typeof categoryOrder] || 0;
                                            const planCategoryOrder = categoryOrder[plan.category as keyof typeof categoryOrder] || 0;

                                            // Check if same category or different category
                                            const isSameCategory = plan.category === currentCategory;
                                            const isCategoryChange = !isSameCategory && hasActiveSubscription;

                                            // Check billing period change
                                            const isBillingPeriodChange = hasActiveSubscription && plan.billing_period !== userBillingPeriod;
                                            const isMonthlyToAnnual = hasActiveSubscription && userBillingPeriod === 'monthly' && plan.billing_period === 'annual';

                                            // For same category: show upgrade/downgrade based on tier
                                            // BUT: Monthly to Annual is always upgrade (never downgrade)
                                            let isUpgrade = false;
                                            let isDowngrade = false;

                                            if (hasActiveSubscription && isSameCategory) {
                                                if (isMonthlyToAnnual) {
                                                    // Monthly to Annual: always upgrade regardless of tier
                                                    isUpgrade = true;
                                                } else if (plan.billing_period === userBillingPeriod) {
                                                    // Same billing period: check tier
                                                    isUpgrade = planTierOrder > currentTierOrder;
                                                    isDowngrade = planTierOrder < currentTierOrder && !isCurrent;
                                                } else {
                                                    // Annual to Monthly: can be downgrade if lower tier
                                                    isUpgrade = planTierOrder > currentTierOrder;
                                                    isDowngrade = planTierOrder < currentTierOrder && !isCurrent;
                                                }
                                            }

                                            // For agency category: always show upgrade (highest category)
                                            const isAgencyUpgrade = hasActiveSubscription && plan.category === 'agency' && currentCategory !== 'agency';

                                            // Only show trial for monthly plans
                                            const showTrial = isTrialEligible && plan.billing_period !== 'annual';

                                            return (
                                                <Card key={plan.id} className={cn("shadow-elegant transition-all hover:shadow-2xl flex flex-col", isCurrent && "border-primary border-2", isPlanPopular(plan.tier) && "border-primary/50")}>
                                                    <CardHeader>
                                                        <div className="flex items-center justify-between">
                                                            <div className={cn("p-2 rounded-lg bg-gradient-to-br", isPlanPopular(plan.tier) ? "from-green-500 to-emerald-600" : "from-gray-500 to-gray-600")}>
                                                                <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                                            </div>
                                                            {isCurrent && (
                                                                <Badge className="bg-primary">
                                                                    <Star className="w-3 h-3 mr-1" />
                                                                    Current
                                                                </Badge>
                                                            )}
                                                            {isPlanPopular(plan.tier) && !isCurrent && (
                                                                <Badge className="bg-success">
                                                                    Popular
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <CardTitle className="text-xl sm:text-2xl">{plan.name}</CardTitle>
                                                        <div className="space-y-1">
                                                            {showTrial ? (
                                                                <>
                                                                    <div className="flex items-baseline gap-2">
                                                                        <p className="text-2xl sm:text-3xl font-bold text-success">₹2</p>
                                                                        <p className="text-sm text-muted-foreground line-through">{formatPrice(plan.price)}</p>
                                                                    </div>
                                                                    <p className="text-xs sm:text-sm text-success font-semibold">First month trial, then {formatPrice(plan.price)}/{plan.billing_period}</p>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <p className="text-2xl sm:text-3xl font-bold">{formatPrice(plan.price)}</p>
                                                                    <p className="text-xs sm:text-sm text-muted-foreground">per {plan.billing_period}</p>
                                                                </>
                                                            )}
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="flex flex-col flex-1 space-y-4">
                                                        <Separator />
                                                        <ul className="space-y-2 flex-1">
                                                            {plan.features.map((feature, idx) => (
                                                                <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                                                                    <span>{feature}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <Button
                                                            onClick={() => isCurrent ? null : handleSubscribe(plan.id)}
                                                            disabled={isCurrent || (processing && selectedPlan === plan.id)}
                                                            className={cn("w-full text-xs sm:text-sm mt-auto", isCurrent ? "" : "gradient-primary")}
                                                            variant={isCurrent ? "outline" : "default"}
                                                        >
                                                            {isCurrent ? (
                                                                <>
                                                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                                                    Current Plan
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {processing && selectedPlan === plan.id ? (
                                                                        <>
                                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                            Processing...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            {showTrial ? (
                                                                                <>
                                                                                    <Sparkles className="w-4 h-4 mr-2" />
                                                                                    Start Your Free Trial
                                                                                </>
                                                                            ) : isAgencyUpgrade ? (
                                                                                <>
                                                                                    <ArrowRight className="w-4 h-4 mr-2" />
                                                                                    Upgrade to Agency
                                                                                </>
                                                                            ) : isUpgrade ? (
                                                                                <>
                                                                                    <ArrowRight className="w-4 h-4 mr-2" />
                                                                                    Upgrade Plan
                                                                                </>
                                                                            ) : isDowngrade ? (
                                                                                <>
                                                                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                                                                    Downgrade Plan
                                                                                </>
                                                                            ) : isCategoryChange ? (
                                                                                <>
                                                                                    <ArrowRight className="w-4 h-4 mr-2" />
                                                                                    Change Plan
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    Subscribe
                                                                                    <ArrowRight className="w-4 h-4 ml-2" />
                                                                                </>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </>
                                                            )}
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Payment Methods */}
                                <Card className="shadow-elegant">
                                    <CardHeader>
                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                            <div>
                                                <CardTitle className="text-lg sm:text-xl">Payment Methods</CardTitle>
                                                <CardDescription className="text-xs sm:text-sm">Manage your saved payment methods</CardDescription>
                                            </div>
                                            <Button onClick={() => toast.info("Add payment method feature coming soon!")} size="sm" className="text-xs sm:text-sm">
                                                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                                                Add Method
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {paymentMethods.length === 0 ? (
                                            <div className="text-center py-8">
                                                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                                                <p className="text-sm text-muted-foreground">No payment methods added</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-4 text-xs sm:text-sm"
                                                    onClick={() => toast.info("Add payment method feature coming soon!")}
                                                >
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Add Your First Method
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {paymentMethods.map((method) => (
                                                    <div key={method.id} className="flex items-center justify-between p-3 sm:p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
                                                                <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <p className="text-sm sm:text-base font-semibold capitalize">{method.brand}</p>
                                                                    {method.is_default && (
                                                                        <Badge className="bg-success text-[10px] sm:text-xs">Default</Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs sm:text-sm text-muted-foreground">•••• {method.last4}</p>
                                                                <p className="text-[10px] sm:text-xs text-muted-foreground">Expires {method.expiry}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            {!method.is_default && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleSetDefaultPayment(method.id)}
                                                                    className="text-xs"
                                                                >
                                                                    Set Default
                                                                </Button>
                                                            )}
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="ghost"
                                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    >
                                                                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Remove Payment Method?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            This payment method will be permanently removed from your account.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction
                                                                            onClick={() => handleRemovePayment(method.id)}
                                                                            className="bg-destructive hover:bg-destructive/90"
                                                                        >
                                                                            Remove
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Subscription Info */}
                                <Card className="shadow-elegant bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                                    <CardHeader>
                                        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                                            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                                            Subscription Benefits
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex items-start gap-2">
                                            <Clock className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs sm:text-sm font-semibold">Flexible Billing</p>
                                                <p className="text-[10px] sm:text-xs text-muted-foreground">Cancel anytime, no questions asked</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <Shield className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs sm:text-sm font-semibold">Secure Payments</p>
                                                <p className="text-[10px] sm:text-xs text-muted-foreground">All transactions are encrypted and secure</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-primary mt-1 flex-shrink-0" />
                                            <div>
                                                <p className="text-xs sm:text-sm font-semibold">No Hidden Fees</p>
                                                <p className="text-[10px] sm:text-xs text-muted-foreground">What you see is what you pay</p>
                                            </div>
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
};

export default SubscriptionManagement;
