import { useEffect, useState } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Crown, CreditCard, User, Zap, CheckCircle2, XCircle, AlertCircle,
    ArrowRight, Star,
    Sparkles, Loader2, ArrowLeft, Gift
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

declare global {
    interface Window {
        Razorpay: any;
    }
}

interface UserSubscription {
    id: string;
    plan_id: string;
    status: string;
    is_trial: boolean;
    start_date: string;
    end_date: string;
    razorpay_subscription_id: string;
}

const SubscriptionManagement = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [processing, setProcessing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("editor");
    const [billingPeriod, setBillingPeriod] = useState("monthly");
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
    const [isTrialEligible, setIsTrialEligible] = useState(false);
    const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
    const [activeSubscription, setActiveSubscription] = useState<UserSubscription | null>(null);
    const { plans: allPlans, loading: plansLoading } = usePlans();
    const { formatPrice } = useCurrency();

    const categories = [
        { id: "editor", name: "Editor", icon: Sparkles, description: "For individual video editors" },
        { id: "client", name: "Client", icon: Crown, description: "For clients managing projects" },
        { id: "agency", name: "Agency", icon: Zap, description: "For teams and agencies" }
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

            // Load profile
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profileData) {
                setProfile(profileData);
                setIsTrialEligible(!(profileData as any)?.trial_used);
                setHasActiveSubscription((profileData as any)?.subscription_active === true);
            }

            // Load active subscription
            const { data: subData } = await supabase
                .from('user_subscriptions' as any)
                .select('*')
                .eq('user_id', session.user.id)
                .in('status', ['active', 'created', 'pending', 'cancelling'])
                .order('created_at', { ascending: false })
                .limit(1);

            if (subData && subData.length > 0) {
                const sub = subData[0] as unknown as UserSubscription;
                setActiveSubscription(sub);

                // Set active flag if profile says active OR if subscription is cancelling (feature access depends on this)
                const isProfileActive = (profileData as any)?.subscription_active === true;
                setHasActiveSubscription(isProfileActive || sub.status === 'cancelling');
            } else {
                setActiveSubscription(null);
                setHasActiveSubscription((profileData as any)?.subscription_active === true);
            }
        } catch (error: any) {
            console.error("Load data error:", error);
            toast.error("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    const loadRazorpayScript = (): Promise<boolean> => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleSubscribe = async (planId: string, isTrial: boolean = false) => {
        if (!profile) {
            toast.error("Please login to subscribe");
            navigate("/auth");
            return;
        }

        setProcessing(true);
        setSelectedPlan(planId);

        try {
            // Load Razorpay script
            const loaded = await loadRazorpayScript();
            if (!loaded) {
                throw new Error('Failed to load payment gateway');
            }

            // Get plan details
            const plan = allPlans.find(p => p.id === planId);
            const useTrial = isTrial && isTrialEligible;

            // For trial, use ₹1 order API instead of subscription API
            if (useTrial) {
                // Create ₹1 order for trial verification
                const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
                    body: {
                        planId,
                        isTrial: true,
                        amount: 1 // ₹1 trial fee
                    }
                });

                if (error) throw error;
                if (!data) throw new Error('No response from server');

                // Open Razorpay checkout with ₹1
                const options = {
                    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                    order_id: data.order_id,
                    amount: 100, // ₹1 in paise
                    currency: 'INR',
                    name: 'Xrozen Workflow',
                    description: `${plan?.name} - ₹1 Trial (First Month)`,
                    prefill: {
                        email: profile?.email || '',
                        contact: ''
                    },
                    theme: { color: '#22c55e' },
                    handler: async (response: any) => {
                        try {
                            const { error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
                                body: {
                                    ...response,
                                    isTrial: true,
                                    planId: planId
                                }
                            });

                            if (verifyError) throw verifyError;

                            toast.success('Trial activated! You will be charged ₹1 now and full price next month.');
                            await loadData();
                        } catch (error: any) {
                            console.error("Verification error:", error);
                            toast.error("Payment successful but verification failed. Please contact support.");
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            setProcessing(false);
                            setSelectedPlan(null);
                        }
                    }
                };

                const razorpay = new window.Razorpay(options);
                razorpay.on('payment.failed', (response: any) => {
                    console.error('Payment failed:', response.error);
                    toast.error('Payment failed. Please try again.');
                    setProcessing(false);
                    setSelectedPlan(null);
                });
                razorpay.open();
            } else {
                // Regular subscription (non-trial) - use subscription API
                const { data, error } = await supabase.functions.invoke('create-razorpay-subscription', {
                    body: { planId, isTrial: false }
                });

                if (error) throw error;
                if (!data) throw new Error('No response from server');

                // Open Razorpay checkout
                const options = {
                    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                    subscription_id: data.subscription_id,
                    name: 'Xrozen Workflow',
                    description: `${plan?.name} - Monthly Subscription`,
                    prefill: {
                        email: profile?.email || '',
                        contact: ''
                    },
                    theme: { color: '#22c55e' },
                    handler: async (response: any) => {
                        try {
                            const { error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
                                body: response
                            });

                            if (verifyError) throw verifyError;

                            toast.success('Subscription activated successfully!');
                            await loadData();
                        } catch (error: any) {
                            console.error("Verification error:", error);
                            toast.error("Payment successful but verification failed. Please contact support.");
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            setProcessing(false);
                            setSelectedPlan(null);
                        }
                    }
                };

                const razorpay = new window.Razorpay(options);
                razorpay.on('payment.failed', (response: any) => {
                    console.error('Payment failed:', response.error);
                    toast.error('Payment failed. Please try again.');
                    setProcessing(false);
                    setSelectedPlan(null);
                });
                razorpay.open();
            }
        } catch (error: any) {
            console.error("Subscription error:", error);
            toast.error(error.message || "Failed to create subscription");
            setProcessing(false);
            setSelectedPlan(null);
        }
    };

    const handleCancelSubscription = async () => {
        if (!activeSubscription) {
            toast.error("No active subscription found");
            return;
        }

        setProcessing(true);
        try {
            const { data, error } = await supabase.functions.invoke('cancel-subscription', {
                body: {
                    subscriptionId: activeSubscription.id,
                    cancelAtEnd: true // Cancel at end of billing period
                }
            });

            if (error) throw error;
            if (!data) throw new Error('No response from server');

            toast.success(data.message || "Subscription updated successfully.");
            await loadData(); // Reload to get updated status
        } catch (error: any) {
            console.error("Cancel error:", error);
            toast.error(error.message || "Failed to cancel subscription");
        } finally {
            setProcessing(false);
        }
    };

    const handleResumeSubscription = async () => {
        if (!activeSubscription || activeSubscription.status !== 'cancelling') {
            toast.error("No cancelling subscription found to resume");
            return;
        }

        setProcessing(true);
        const currentPlan = allPlans.find(p => p.id === activeSubscription.plan_id);

        if (!currentPlan) {
            toast.error("Original plan not found. Please subscribe to a new plan.");
            setProcessing(false);
            return;
        }

        try {
            // Load Razorpay script
            const loaded = await loadRazorpayScript();
            if (!loaded) {
                throw new Error('Failed to load payment gateway');
            }

            // Create a ₹1 order for resume verification (not full subscription)
            const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
                body: {
                    planId: activeSubscription.plan_id,
                    isTrial: false,
                    isResume: true, // Flag to indicate this is a resume verification
                    subscriptionId: activeSubscription.id
                }
            });

            if (error) throw error;
            if (!data) throw new Error('No response from server');

            // Open Razorpay checkout with ₹1 amount
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                order_id: data.order_id,
                amount: 100, // ₹1 in paise
                currency: 'INR',
                name: 'Xrozen Workflow',
                description: `Resume ${currentPlan.name} - Verification Fee`,
                prefill: {
                    email: profile?.email || '',
                    contact: ''
                },
                theme: { color: '#22c55e' },
                handler: async (response: any) => {
                    try {
                        // Verify the payment and resume subscription
                        const { error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
                            body: {
                                ...response,
                                isResume: true,
                                subscriptionId: activeSubscription.id
                            }
                        });

                        if (verifyError) throw verifyError;

                        toast.success('Subscription resumed successfully!');
                        await loadData();
                    } catch (error: any) {
                        console.error("Verification error:", error);
                        toast.error("Payment successful but verification failed.");
                    }
                },
                modal: {
                    ondismiss: () => {
                        setProcessing(false);
                        setSelectedPlan(null);
                    }
                }
            };

            const razorpay = new window.Razorpay(options);
            razorpay.on('payment.failed', (response: any) => {
                console.error('Payment failed:', response.error);
                toast.error('Payment failed. Please try again.');
                setProcessing(false);
            });
            razorpay.open();

        } catch (error: any) {
            console.error("Resume error:", error);
            toast.error(error.message || "Failed to resume subscription");
            setProcessing(false);
        }
    };

    const currentTier = profile?.subscription_tier || "basic";
    const currentCategory = profile?.user_category || "editor";

    const getPlansByCategory = (category: string) => {
        return allPlans.filter(plan => plan.category === category);
    };

    const filteredPlans = getPlansByCategory(selectedCategory).filter(plan =>
        plan.billing_period === billingPeriod
    );

    const isPlanPopular = (planTier: string) => planTier === 'pro';

    // Skeleton loading component
    const LoadingSkeleton = () => (
        <SidebarProvider>
            <div className="flex w-full min-h-screen bg-background">
                <AppSidebar />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <header className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                        <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
                            <SidebarTrigger />
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                                    <CreditCard className="w-5 h-5 text-primary-foreground" />
                                </div>
                                <h1 className="text-lg lg:text-xl font-bold truncate">Subscription Management</h1>
                            </div>
                        </div>
                    </header>
                    <main className="flex-1 overflow-y-auto">
                        <div className="px-4 lg:px-8 py-6 max-w-7xl mx-auto w-full">
                            <div className="grid gap-6">
                                <Card className="shadow-elegant border-2">
                                    <CardHeader>
                                        <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
                                        <div className="h-4 w-32 bg-muted/40 rounded animate-pulse mt-2" />
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 bg-muted/50 rounded-lg animate-pulse" />
                                            <div className="space-y-2">
                                                <div className="h-7 w-24 bg-muted/50 rounded animate-pulse" />
                                                <div className="h-4 w-20 bg-muted/40 rounded animate-pulse" />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <div className="space-y-4">
                                    <div className="h-6 w-32 bg-muted/50 rounded animate-pulse" />
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                        {[1, 2, 3].map((i) => (
                                            <Card key={i} className="shadow-elegant">
                                                <CardHeader>
                                                    <div className="flex items-center justify-between">
                                                        <div className="w-12 h-12 bg-muted/50 rounded-lg animate-pulse" />
                                                    </div>
                                                    <div className="h-7 w-32 bg-muted/50 rounded animate-pulse mt-4" />
                                                    <div className="h-8 w-24 bg-muted/40 rounded animate-pulse mt-2" />
                                                </CardHeader>
                                                <CardContent className="space-y-3">
                                                    {[1, 2, 3].map((j) => (
                                                        <div key={j} className="h-4 w-full bg-muted/30 rounded animate-pulse" />
                                                    ))}
                                                    <div className="h-10 w-full bg-muted/40 rounded animate-pulse mt-4" />
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );

    if (loading || plansLoading) {
        return <LoadingSkeleton />;
    }

    const getStatusBadge = () => {
        if (!hasActiveSubscription) return null;

        if (activeSubscription?.status === 'cancelling') {
            return (
                <Badge className="bg-orange-500 text-white hover:bg-orange-600 text-xs sm:text-sm border-0">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Cancelling
                </Badge>
            );
        }

        return (
            <Badge className="bg-success text-xs sm:text-sm">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                {activeSubscription?.is_trial ? 'Trial Active' : 'Active'}
            </Badge>
        );
    };

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
                                        Manage your plan and billing
                                    </p>
                                </div>
                                <CurrencySelector />
                            </div>
                        </div>
                    </header>

                    <main className="flex-1 overflow-y-auto">
                        <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-7xl mx-auto w-full">
                            <div className="grid gap-4 sm:gap-6">
                                {/* Trial Banner for eligible users */}
                                {isTrialEligible && (
                                    <Card className="border-2 border-success/50 bg-success/5">
                                        <CardContent className="py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-full bg-success/20">
                                                    <Gift className="w-5 h-5 text-success" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-success">Trial Available!</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Get your first month for just ₹1! After the trial, regular pricing applies.
                                                    </p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Current Subscription Card */}
                                <Card className="shadow-elegant border-2">
                                    <CardHeader>
                                        <div className="flex items-center justify-between flex-wrap gap-3">
                                            <div>
                                                <CardTitle className="text-lg sm:text-xl">Current Subscription</CardTitle>
                                                <CardDescription className="text-xs sm:text-sm">
                                                    {hasActiveSubscription
                                                        ? (activeSubscription?.status === 'cancelling' ? "Subscription cancelling at period end" : "Active")
                                                        : "No Active Subscription"}
                                                </CardDescription>
                                            </div>
                                            {getStatusBadge()}
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {activeSubscription ? (
                                            <>
                                                <div className="flex items-center justify-between flex-wrap gap-4">
                                                    <div className="flex items-center gap-3">
                                                        {React.createElement(categories.find(c => c.id === currentCategory)?.icon || User, {
                                                            className: "w-8 h-8 sm:w-10 sm:h-10 text-primary"
                                                        })}
                                                        <div>
                                                            <h3 className="text-xl sm:text-2xl font-bold capitalize">{currentTier}</h3>
                                                            <p className="text-sm sm:text-base text-muted-foreground capitalize">
                                                                {currentCategory} Plan
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {activeSubscription?.end_date && (
                                                        <div className="text-right">
                                                            <p className="text-xs text-muted-foreground">
                                                                {activeSubscription?.status === 'cancelling' ? 'Access until' : (activeSubscription?.is_trial ? 'Trial ends' : 'Next billing')}
                                                            </p>
                                                            <p className="text-sm sm:text-base font-semibold">
                                                                {format(new Date(activeSubscription.end_date), "MMM dd, yyyy")}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                {(activeSubscription?.status === 'cancelling' || activeSubscription?.is_trial) && (
                                                    <div className={`p-3 rounded-lg border ${activeSubscription?.status === 'cancelling' ? 'bg-orange-500/10 border-orange-500/20' : 'bg-warning/10 border-warning/20'}`}>
                                                        <div className="flex items-center gap-2">
                                                            <AlertCircle className={`w-4 h-4 ${activeSubscription?.status === 'cancelling' ? 'text-orange-500' : 'text-warning'}`} />
                                                            <p className={`text-sm ${activeSubscription?.status === 'cancelling' ? 'text-orange-600' : 'text-warning'}`}>
                                                                {activeSubscription?.status === 'cancelling'
                                                                    ? `Subscription cancelled - Active until ${format(new Date(activeSubscription.end_date), "MMM dd")}`
                                                                    : `Trial period - Full charges apply after ${format(new Date(activeSubscription.end_date), "MMM dd")}`
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-3 py-2">
                                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                                    <User className="w-5 h-5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <h3 className="text-xl font-bold text-muted-foreground">No Plan</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Choose a plan below to get started
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {hasActiveSubscription && (
                                            <>
                                                <Separator />
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    {activeSubscription?.status === 'cancelling' ? (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    disabled={processing}
                                                                    className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-xs sm:text-sm"
                                                                >
                                                                    {processing ? (
                                                                        <>
                                                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                            Resuming...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <CreditCard className="w-4 h-4 mr-2" />
                                                                            Resume Subscription
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Resume Subscription</AlertDialogTitle>
                                                                    <AlertDialogDescription className="space-y-2">
                                                                        <p>
                                                                            To resume your subscription seamlessly, we need to schedule a new billing cycle starting from <strong>{format(new Date(activeSubscription.end_date!), "MMM dd, yyyy")}</strong>.
                                                                        </p>
                                                                        <div className="p-3 bg-muted rounded-md text-sm border">
                                                                            <p className="font-semibold text-foreground mb-1">Important Note:</p>
                                                                            <p>
                                                                                You will be redirected to verify your payment method. A refundable verification fee (₹1) may be charged to authorize the future payment, but you will <strong>NOT</strong> be charged the full plan amount today.
                                                                            </p>
                                                                        </div>
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={handleResumeSubscription}>
                                                                        Proceed to Resume
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    ) : (
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
                                                                        Your subscription will remain active until the end of the current billing period ({format(new Date(activeSubscription?.end_date || new Date()), "MMM dd, yyyy")}).
                                                                        You can resume it any time before then.
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
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Available Plans */}
                                <div className="space-y-3 sm:space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div>
                                            <h2 className="text-lg sm:text-xl font-bold">Available Plans</h2>
                                            <p className="text-xs sm:text-sm text-muted-foreground">Choose a plan that fits your needs</p>
                                        </div>

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
                                            const isCurrent = hasActiveSubscription &&
                                                activeSubscription?.plan_id === plan.id;
                                            const showTrial = isTrialEligible && plan.billing_period === 'monthly';

                                            return (
                                                <Card key={plan.id} className={cn(
                                                    "shadow-elegant transition-all hover:shadow-2xl flex flex-col",
                                                    isCurrent && "border-primary border-2",
                                                    isPlanPopular(plan.tier) && "border-primary/50"
                                                )}>
                                                    <CardHeader>
                                                        <div className="flex items-center justify-between">
                                                            <div className={cn(
                                                                "p-2 rounded-lg bg-gradient-to-br",
                                                                isPlanPopular(plan.tier) ? "from-green-500 to-emerald-600" : "from-gray-500 to-gray-600"
                                                            )}>
                                                                <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                                                            </div>
                                                            {isCurrent && (
                                                                <Badge className="bg-primary">
                                                                    <Star className="w-3 h-3 mr-1" />
                                                                    Current
                                                                </Badge>
                                                            )}
                                                            {isPlanPopular(plan.tier) && !isCurrent && (
                                                                <Badge className="bg-success">Popular</Badge>
                                                            )}
                                                        </div>
                                                        <CardTitle className="text-xl sm:text-2xl">{plan.name}</CardTitle>
                                                        <div className="space-y-1">
                                                            {showTrial ? (
                                                                <>
                                                                    <div className="flex items-baseline gap-2">
                                                                        <p className="text-2xl sm:text-3xl font-bold text-success">₹1</p>
                                                                        <p className="text-sm text-muted-foreground line-through">
                                                                            {formatPrice(plan.price_inr || plan.price)}
                                                                        </p>
                                                                    </div>
                                                                    <p className="text-xs sm:text-sm text-success font-semibold">
                                                                        First month trial, then {formatPrice(plan.price_inr || plan.price)}/month
                                                                    </p>
                                                                </>
                                                            ) : plan.billing_period === 'annual' && plan.annual_discount_percentage && plan.annual_discount_percentage > 0 ? (
                                                                <>
                                                                    <div className="flex items-baseline gap-2">
                                                                        <p className="text-sm text-muted-foreground line-through">
                                                                            {formatPrice(Math.round((plan.price_inr || plan.price) / (1 - plan.annual_discount_percentage / 100)))}
                                                                        </p>
                                                                        <Badge className="bg-success text-xs">Save {plan.annual_discount_percentage}%</Badge>
                                                                    </div>
                                                                    <p className="text-2xl sm:text-3xl font-bold text-success">
                                                                        {formatPrice(plan.price_inr || plan.price)}
                                                                    </p>
                                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                                        per year
                                                                    </p>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <p className="text-2xl sm:text-3xl font-bold">
                                                                        {formatPrice(plan.price_inr || plan.price)}
                                                                    </p>
                                                                    <p className="text-xs sm:text-sm text-muted-foreground">
                                                                        per {plan.billing_period}
                                                                    </p>
                                                                </>
                                                            )}
                                                        </div>
                                                        {plan.description && (
                                                            <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                                                        )}
                                                    </CardHeader>
                                                    <CardContent className="flex flex-col flex-1 space-y-4">
                                                        <Separator />

                                                        {/* Limits info */}
                                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                                            <div className="p-2 rounded bg-muted/50">
                                                                <p className="text-muted-foreground">Editors</p>
                                                                <p className="font-semibold">{plan.editor_limit !== null && plan.editor_limit !== undefined ? plan.editor_limit : 'Unlimited'}</p>
                                                            </div>
                                                            <div className="p-2 rounded bg-muted/50">
                                                                <p className="text-muted-foreground">Clients</p>
                                                                <p className="font-semibold">{plan.client_limit !== null && plan.client_limit !== undefined ? plan.client_limit : 'Unlimited'}</p>
                                                            </div>
                                                        </div>

                                                        <ul className="space-y-2 flex-1">
                                                            {(plan.features || []).map((feature: string, idx: number) => (
                                                                <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                                                                    <span>{feature}</span>
                                                                </li>
                                                            ))}
                                                        </ul>

                                                        <Button
                                                            onClick={() => !isCurrent && handleSubscribe(plan.id, showTrial)}
                                                            disabled={isCurrent || (processing && selectedPlan === plan.id)}
                                                            className={cn("w-full text-xs sm:text-sm mt-auto", !isCurrent && "gradient-primary")}
                                                            variant={isCurrent ? "outline" : "default"}
                                                        >
                                                            {isCurrent ? (
                                                                <>
                                                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                                                    Current Plan
                                                                </>
                                                            ) : processing && selectedPlan === plan.id ? (
                                                                <>
                                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                    Processing...
                                                                </>
                                                            ) : showTrial ? (
                                                                <>
                                                                    <Gift className="w-4 h-4 mr-2" />
                                                                    Start ₹1 Trial
                                                                </>
                                                            ) : hasActiveSubscription ? (
                                                                <>
                                                                    <ArrowRight className="w-4 h-4 mr-2" />
                                                                    Switch Plan
                                                                </>
                                                            ) : (
                                                                <>
                                                                    Subscribe
                                                                    <ArrowRight className="w-4 h-4 ml-2" />
                                                                </>
                                                            )}
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>

                                    {filteredPlans.length === 0 && (
                                        <Card className="p-8 text-center">
                                            <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                                            <h3 className="text-lg font-semibold">No Plans Available</h3>
                                            <p className="text-muted-foreground">
                                                No plans are currently available for this category and billing period.
                                            </p>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </div>
                    </main>
                </div>
            </div>
        </SidebarProvider>
    );
};

export default SubscriptionManagement;
