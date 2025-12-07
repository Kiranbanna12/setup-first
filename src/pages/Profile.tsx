import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  User, Crown, CreditCard, Mail, Shield, Sparkles, TrendingUp, LogOut,
  Bell, Lock, CheckCircle2, XCircle, Clock, Building2, Phone,
  ChevronRight, Settings, Zap
} from "lucide-react";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface SubscriptionFeature {
  name: string;
  included: boolean;
  limit?: string;
}

interface SubscriptionTierInfo {
  name: string;
  price: string;
  features: SubscriptionFeature[];
  color: string;
  icon: any;
  badge: string;
  gradient: string;
}

const SUBSCRIPTION_TIERS: Record<string, SubscriptionTierInfo> = {
  basic: {
    name: "Free Plan",
    price: "₹0",
    badge: "Free Plan",
    color: "bg-secondary",
    gradient: "from-gray-500 to-gray-600",
    icon: User,
    features: [
      { name: "Up to 5 Projects", included: true },
      { name: "Up to 3 Clients", included: true },
      { name: "Basic Support", included: true },
      { name: "1 GB Storage", included: true },
      { name: "Email Notifications", included: true },
      { name: "Advanced Analytics", included: false },
      { name: "Priority Support", included: false },
      { name: "Custom Branding", included: false },
    ]
  },
  pro: {
    name: "Pro",
    price: "₹2,499",
    badge: "Professional",
    color: "bg-primary",
    gradient: "from-green-500 to-emerald-600",
    icon: Zap,
    features: [
      { name: "Up to 50 Projects", included: true },
      { name: "Up to 20 Clients", included: true },
      { name: "Priority Support", included: true },
      { name: "10 GB Storage", included: true },
      { name: "Email & SMS Notifications", included: true },
      { name: "Advanced Analytics", included: true },
      { name: "API Access", included: true },
      { name: "Custom Branding", included: false },
    ]
  },
  premium: {
    name: "Premium",
    price: "₹4,999",
    badge: "Enterprise",
    color: "bg-success",
    gradient: "from-purple-500 to-pink-600",
    icon: Crown,
    features: [
      { name: "Unlimited Projects", included: true },
      { name: "Unlimited Clients", included: true },
      { name: "24/7 Premium Support", included: true },
      { name: "Unlimited Storage", included: true },
      { name: "All Notifications", included: true },
      { name: "Advanced Analytics", included: true },
      { name: "API Access", included: true },
      { name: "Custom Branding", included: true },
    ]
  }
};

const Profile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        // Merge auth user metadata with profile data
        const mergedProfile = {
          ...user,
          ...profileData,
          email: user.email // Ensure email comes from auth
        } as any;

        setProfile(mergedProfile);
        setFullName(mergedProfile.full_name || "");
        setPhoneNumber(mergedProfile.phone_number || "");
        setCompanyName(mergedProfile.company_name || "");
      } catch (error) {
        console.error("Error fetching profile details:", error);
        // Fallback to basic user info if profile fetch fails
        setProfile(user);
        setFullName(user.user_metadata?.full_name || "");
      }
    } catch (error: any) {
      console.error("Load profile error:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      toast.error("Profile not loaded");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone_number: phoneNumber,
          company_name: companyName,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      await loadProfile();
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/auth");
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  const getTierInfo = (): SubscriptionTierInfo => {
    // Check Supabase profile subscription_tier
    const tier = profile?.subscription_tier || "basic";
    return SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.basic;
  };

  const getCurrentPlanPrice = (): string => {
    // If we had active_subscription table/json, we'd check that. 
    // Usually Supabase profiles might retain a price if custom.
    // For now, return tier default price as per UI requirement.
    const tierInfo = getTierInfo();
    return tierInfo.price;
  };

  const getCurrentPlanName = (): string => {
    const tierInfo = getTierInfo();
    return tierInfo.name;
  };

  const getBillingPeriod = (): string => {
    // Default to monthly for now unless data suggests otherwise
    return 'per month';
  };

  const getInitials = (name: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const getSubscriptionStatus = () => {
    if (profile?.subscription_active === false) { // Explicit check for false
      return { text: "Inactive", color: "text-destructive", icon: XCircle, bg: "bg-destructive/10" };
    }
    // Check trial or subscription end date
    const endDateStr = profile?.trial_end_date || profile?.subscription_end_date;
    if (endDateStr) {
      const endDate = new Date(endDateStr);
      const daysRemaining = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7 && daysRemaining > 0) {
        return { text: "Expiring Soon", color: "text-warning", icon: Clock, bg: "bg-warning/10" };
      }
      if (daysRemaining < 0) {
        return { text: "Expired", color: "text-destructive", icon: XCircle, bg: "bg-destructive/10" };
      }
    }
    return { text: "Active", color: "text-success", icon: CheckCircle2, bg: "bg-success/10" };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  const tierInfo = getTierInfo();
  const IconComponent = tierInfo.icon;
  const status = getSubscriptionStatus();
  const StatusIcon = status.icon;

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
                  <User className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Profile & Settings</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                    Manage your account and subscription
                  </p>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-6xl mx-auto w-full">
              <div className="grid gap-4 sm:gap-6">
                <Card className="shadow-elegant border-2">
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-4 border-primary/20 shadow-lg">
                          <AvatarImage src={profile?.avatar_url} />
                          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xl sm:text-2xl font-bold">
                            {getInitials(fullName || profile?.email || "User")}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn("absolute -bottom-1 -right-1 h-6 w-6 sm:h-7 sm:w-7 rounded-full flex items-center justify-center shadow-lg border-2 border-background", tierInfo.color)}>
                          <IconComponent className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 text-center sm:text-left space-y-2 sm:space-y-3 min-w-0 w-full sm:w-auto">
                        <div>
                          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">{fullName || "User"}</h2>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{profile?.email}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                          <Badge className={cn("gap-1 text-xs sm:text-sm", tierInfo.color)}>
                            <Crown className="w-3 h-3 sm:w-4 sm:h-4" />
                            {tierInfo.badge}
                          </Badge>
                          <Badge variant="outline" className={cn("gap-1 text-xs sm:text-sm", status.bg, status.color)}>
                            <StatusIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                            {status.text}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 pt-2">
                          <div className="text-center sm:text-left">
                            <p className="text-xs text-muted-foreground">Member Since</p>
                            <p className="text-xs sm:text-sm font-semibold">
                              {profile?.created_at ? format(new Date(profile.created_at), "MMM yyyy") : "N/A"}
                            </p>
                          </div>
                          <div className="text-center sm:text-left">
                            <p className="text-xs text-muted-foreground">Plan</p>
                            <p className="text-xs sm:text-sm font-semibold capitalize">{getCurrentPlanName()}</p>
                          </div>
                          {(profile?.subscription_tier === 'pro' || profile?.subscription_tier === 'premium') && (
                            <div className="text-center sm:text-left col-span-2 sm:col-span-1">
                              <p className="text-xs text-muted-foreground">Next Billing</p>
                              <p className="text-xs sm:text-sm font-semibold">
                                {profile?.trial_end_date ? format(new Date(profile.trial_end_date), "dd MMM yyyy") :
                                  (profile?.subscription_end_date ? format(new Date(profile.subscription_end_date), "dd MMM yyyy") : "N/A")}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="w-full sm:w-auto flex-shrink-0">
                        <Button variant="outline" onClick={handleLogout} className="w-full sm:w-auto gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 h-9 sm:h-10 text-xs sm:text-sm">
                          <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>Logout</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                    <Card className="shadow-elegant">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Settings className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          <div>
                            <CardTitle className="text-base sm:text-lg">Profile Information</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">Update your personal details</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSave} className="space-y-4 sm:space-y-5">
                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-xs sm:text-sm flex items-center gap-2">
                              <Mail className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                              Email Address
                            </Label>
                            <Input id="email" type="email" value={profile?.email || ""} disabled className="bg-muted text-xs sm:text-sm h-9 sm:h-10" />
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Email cannot be changed</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="fullname" className="text-xs sm:text-sm flex items-center gap-2">
                              <User className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                              Full Name
                            </Label>
                            <Input id="fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" className="text-xs sm:text-sm h-9 sm:h-10" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="phone" className="text-xs sm:text-sm flex items-center gap-2">
                              <Phone className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                              Phone Number
                            </Label>
                            <Input id="phone" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+91 98765 43210" className="text-xs sm:text-sm h-9 sm:h-10" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="company" className="text-xs sm:text-sm flex items-center gap-2">
                              <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                              Company Name (Optional)
                            </Label>
                            <Input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your company or studio name" className="text-xs sm:text-sm h-9 sm:h-10" />
                          </div>
                          <Separator />
                          <Button type="submit" className="w-full gradient-primary text-xs sm:text-sm h-9 sm:h-10" disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>
                    <Card className="shadow-elegant">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          <div>
                            <CardTitle className="text-base sm:text-lg">Security Settings</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">Manage your account security</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <Button variant="outline" className="w-full justify-between text-xs sm:text-sm h-9 sm:h-10" onClick={() => navigate("/settings")}>
                          <span className="flex items-center gap-2">
                            <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                            Change Password
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button variant="outline" className="w-full justify-between text-xs sm:text-sm h-9 sm:h-10" onClick={() => navigate("/settings")}>
                          <span className="flex items-center gap-2">
                            <Bell className="w-3 h-3 sm:w-4 sm:h-4" />
                            Notification Preferences
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="space-y-4 sm:space-y-6">
                    <Card className="shadow-elegant border-2">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <div className={cn("p-2 rounded-lg bg-gradient-to-br", tierInfo.gradient)}>
                            <IconComponent className="w-4 h-4 sm:w-5 sm:w-5 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-base sm:text-lg">Current Plan</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">{getCurrentPlanName()}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-center py-3 sm:py-4">
                          <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">{getCurrentPlanPrice()}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground mt-1">{getBillingPeriod()}</p>
                        </div>
                        <Separator />
                        <div className="space-y-2 sm:space-y-3">
                          <p className="text-xs sm:text-sm font-semibold">Plan Features:</p>
                          <div className="space-y-1.5 sm:space-y-2">
                            {tierInfo.features.slice(0, 5).map((feature, index) => (
                              <div key={index} className="flex items-start gap-2">
                                {feature.included ? (
                                  <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4 text-success flex-shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                )}
                                <span className={cn("text-[10px] sm:text-xs", feature.included ? "text-foreground" : "text-muted-foreground line-through")}>
                                  {feature.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <Button className="w-full gap-2 gradient-primary text-xs sm:text-sm h-9 sm:h-10" onClick={() => navigate("/subscription-management")}>
                            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                            Manage Subscription
                          </Button>
                          <Button variant="outline" className="w-full gap-2 text-xs sm:text-sm h-9 sm:h-10" onClick={() => navigate("/billing-history")}>
                            <CreditCard className="w-3 h-3 sm:w-4 sm:h-4" />
                            Billing History
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="shadow-elegant bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                          <CardTitle className="text-base sm:text-lg">Why Upgrade?</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 sm:space-y-3">
                          <div className="flex items-start gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Get more projects and clients</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Access advanced features</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Priority customer support</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Unlock unlimited potential</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Profile;
