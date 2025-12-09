
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell, Lock, Palette, Settings as SettingsIcon, Sparkles, Shield,
  Globe, Download, Trash2, Eye, EyeOff, Smartphone, Monitor,
  Clock, AlertCircle, CheckCircle2, Key, Users, Database,
  ChevronRight, Mail, Volume2, Moon, Sun, FileText, AlertTriangle
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { NotificationPreferences } from "@/components/notifications/NotificationPreferences";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useTheme } from "@/contexts/ThemeContext";

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  // Security
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Appearance

  const [showAIAssistant, setShowAIAssistant] = useState(() => {
    const saved = localStorage.getItem('xrozen-ai-visible');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Preferences
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [dateFormat, setDateFormat] = useState("dd/MM/yyyy");

  // Notifications
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Privacy


  // Delete Account
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active Subscription
  const [activeSubscription, setActiveSubscription] = useState<{
    plan_name: string;
    tier: string;
    status: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        // Merge auth user metadata with profile data
        setProfile({ ...user, ...profileData, email: user.email });
        // Load 2FA setting from profile
        setTwoFactorEnabled(profileData?.two_factor_enabled || false);

        // Load active subscription with plan details
        const { data: subData } = await supabase
          .from('user_subscriptions' as any)
          .select(`
            status,
            subscription_plans!inner(name, tier)
          `)
          .eq('user_id', user.id)
          .in('status', ['active', 'created', 'pending', 'cancelling'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (subData && subData.length > 0) {
          const sub = subData[0] as any;
          setActiveSubscription({
            plan_name: sub.subscription_plans?.name || 'Unknown',
            tier: sub.subscription_plans?.tier || 'basic',
            status: sub.status
          });
        } else {
          setActiveSubscription(null);
        }

        // Load General Settings
        if (profileData?.general_settings) {
          const settings = typeof profileData.general_settings === 'string'
            ? JSON.parse(profileData.general_settings)
            : profileData.general_settings;

          setEmailNotifications(settings.email_notifications ?? true);
          setPushNotifications(settings.push_notifications ?? true);
          setSoundEnabled(settings.sound_enabled ?? true);

          // Load regional settings
          if (settings.language) setLanguage(settings.language);
          if (settings.timezone) setTimezone(settings.timezone);
          if (settings.date_format) setDateFormat(settings.date_format);
        }
      } catch (error) {
        console.error("Profile fetch error:", error);
        setProfile(user);
      }
    } catch (error) {
      console.error("Load data error:", error);
      navigate("/auth");
    } finally {
      setInitialLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: "", color: "" };

    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 1) return { strength, label: "Weak", color: "text-destructive" };
    if (strength <= 3) return { strength, label: "Medium", color: "text-warning" };
    return { strength, label: "Strong", color: "text-success" };
  };

  const handleExportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      toast.info("Exporting data...", { description: "Please wait while we gather your information." });

      // Fetch all user data
      const [profileData, projectsData, invoicesData, paymentsData] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('projects').select('*').eq('created_by', user.id),
        supabase.from('invoices').select('*').eq('user_id', user.id),
        supabase.from('payments').select('*').eq('user_id', user.id)
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        user: profileData.data,
        projects: projectsData.data, // Projects created by user
        invoices: invoicesData.data,
        payments: paymentsData.data
      };

      // Create downloadable file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Data export ready", { description: "Your data has been downloaded successfully." });
    } catch (error: any) {
      console.error("Export error:", error);
      toast.error("Export failed", { description: error.message || "Could not export data." });
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteDialog(true);
  };

  const confirmDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.functions.invoke('delete-account', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) throw error;

      toast.success("Account deleted successfully");
      await supabase.auth.signOut();
      navigate("/");
    } catch (error: any) {
      console.error("Delete account error:", error);
      toast.error("Failed to delete account", { description: error.message || "Please try again later." });
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const updateGeneralSettings = async (updates: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentSettings = {
        email_notifications: emailNotifications,
        push_notifications: pushNotifications,
        sound_enabled: soundEnabled,
        language,
        timezone,
        date_format: dateFormat,
        ...updates
      };

      // Update local state immediately for responsiveness
      if (updates.email_notifications !== undefined) setEmailNotifications(updates.email_notifications);
      if (updates.push_notifications !== undefined) setPushNotifications(updates.push_notifications);
      if (updates.sound_enabled !== undefined) setSoundEnabled(updates.sound_enabled);
      if (updates.language !== undefined) setLanguage(updates.language);
      if (updates.timezone !== undefined) setTimezone(updates.timezone);
      if (updates.date_format !== undefined) setDateFormat(updates.date_format);

      const { error } = await supabase
        .from('profiles')
        .update({ general_settings: currentSettings })
        .eq('id', user.id);

      if (error) throw error;
      toast.success("Settings updated");
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
      // Revert state on error if needed, but keeping it simple for now
    }
  };

  const passwordStrength = getPasswordStrength(newPassword);

  // Skeleton loading component for faster perceived loading
  const LoadingSkeleton = () => (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex-shrink-0 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center px-3 sm:px-4 lg:px-6 py-3 sm:py-4 gap-2 sm:gap-4">
              <SidebarTrigger />
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Settings</h1>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-6xl mx-auto w-full">
              <div className="grid gap-4 sm:gap-6">
                {/* Profile card skeleton */}
                <Card className="shadow-elegant border-2">
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted/50 animate-pulse" />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="h-5 w-32 bg-muted/50 rounded animate-pulse" />
                        <div className="h-4 w-48 bg-muted/40 rounded animate-pulse" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {/* Settings cards skeleton */}
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} className="shadow-elegant">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-muted/50 rounded animate-pulse" />
                        <div className="h-5 w-32 bg-muted/50 rounded animate-pulse" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="flex items-center justify-between">
                          <div className="space-y-2">
                            <div className="h-4 w-28 bg-muted/40 rounded animate-pulse" />
                            <div className="h-3 w-40 bg-muted/30 rounded animate-pulse" />
                          </div>
                          <div className="h-6 w-10 bg-muted/40 rounded-full animate-pulse" />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );

  if (initialLoading) {
    return <LoadingSkeleton />;
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
                  <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg lg:text-xl font-bold truncate">Settings</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate hidden sm:block">
                    Manage your account and preferences
                  </p>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-6xl mx-auto w-full">

              <div className="grid gap-4 sm:gap-6">
                {/* Account Overview Card */}
                {profile && (
                  <Card className="shadow-elegant border-2">
                    <CardContent className="pt-4 sm:pt-6">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-lg sm:text-xl font-bold text-white flex-shrink-0">
                          {profile.full_name?.charAt(0) || profile.email?.charAt(0) || "U"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-base sm:text-lg font-bold truncate">{profile.full_name || "User"}</h2>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{profile.email}</p>
                        </div>
                        <Badge variant={activeSubscription ? "default" : "secondary"} className="capitalize text-xs sm:text-sm">
                          {activeSubscription ? activeSubscription.plan_name : "Free Plan"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Security Section */}
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <div>
                        <CardTitle className="text-base sm:text-lg">Security</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Manage your password and account security</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 sm:space-y-6">
                    {/* Password Change */}
                    <div className="space-y-3 sm:space-y-4">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm sm:text-base font-semibold">Change Password</h3>
                      </div>
                      <form onSubmit={handlePasswordChange} className="space-y-3 sm:space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="current-password" className="text-xs sm:text-sm">Current Password</Label>
                          <div className="relative">
                            <Input
                              id="current-password"
                              type={showCurrentPassword ? "text" : "password"}
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="pr-10 text-xs sm:text-sm h-9 sm:h-10"
                              placeholder="Enter current password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-9 sm:h-10 px-3"
                              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            >
                              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="new-password" className="text-xs sm:text-sm">New Password</Label>
                          <div className="relative">
                            <Input
                              id="new-password"
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="pr-10 text-xs sm:text-sm h-9 sm:h-10"
                              placeholder="Enter new password"
                              minLength={6}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-0 top-0 h-9 sm:h-10 px-3"
                              onClick={() => setShowNewPassword(!showNewPassword)}
                            >
                              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                          {newPassword && (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn("h-full transition-all",
                                    passwordStrength.strength <= 1 ? "w-1/3 bg-destructive" :
                                      passwordStrength.strength <= 3 ? "w-2/3 bg-warning" :
                                        "w-full bg-success"
                                  )}
                                />
                              </div>
                              <span className={cn("text-xs font-medium", passwordStrength.color)}>
                                {passwordStrength.label}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirm-password" className="text-xs sm:text-sm">Confirm New Password</Label>
                          <Input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="text-xs sm:text-sm h-9 sm:h-10"
                            placeholder="Confirm new password"
                            minLength={6}
                          />
                        </div>
                        <Button type="submit" className="w-full sm:w-auto gradient-primary text-xs sm:text-sm h-9 sm:h-10" disabled={loading}>
                          {loading ? "Updating..." : "Update Password"}
                        </Button>
                      </form>
                    </div>

                    <Separator />

                    {/* Two-Factor Authentication */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-muted-foreground" />
                            <Label htmlFor="2fa" className="text-sm sm:text-base font-semibold">Two-Factor Authentication</Label>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            Add an extra layer of security to your account
                          </p>
                        </div>
                        <Switch
                          id="2fa"
                          checked={twoFactorEnabled}
                          onCheckedChange={async (checked) => {
                            setTwoFactorEnabled(checked);
                            try {
                              const { data: { user } } = await supabase.auth.getUser();
                              if (user) {
                                const { error } = await (supabase as any)
                                  .from('profiles')
                                  .update({ two_factor_enabled: checked })
                                  .eq('id', user.id);

                                if (error) throw error;
                                toast.success(checked ? "Two-factor authentication enabled" : "Two-factor authentication disabled");
                              }
                            } catch (error: any) {
                              console.error("Error updating 2FA setting:", error);
                              setTwoFactorEnabled(!checked); // Revert on error
                              toast.error("Failed to update 2FA setting");
                            }
                          }}
                        />
                      </div>
                      {twoFactorEnabled && (
                        <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                            <p className="text-xs sm:text-sm text-success">
                              Two-factor authentication is enabled. Your account is more secure.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Active Sessions */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm sm:text-base font-semibold">Active Sessions</h3>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Monitor className="w-5 h-5 text-primary flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-medium truncate">Current Device</p>
                              <p className="text-[10px] sm:text-xs text-muted-foreground">
                                Last active: {format(new Date(), "MMM dd, yyyy 'at' HH:mm")}
                              </p>
                            </div>
                          </div>
                          <Badge className="bg-success text-[10px] sm:text-xs">Active</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notifications Section */}
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <div>
                        <CardTitle className="text-base sm:text-lg">Notifications</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Manage how you receive notifications</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 sm:space-y-5">
                    {/* Notification Preferences Component */}
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm sm:text-base font-semibold">Notification Types</h3>
                        <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground font-medium">
                          <span>In-App</span>
                          <span>Email</span>
                        </div>
                      </div>
                      <NotificationPreferences />
                    </div>

                    <Separator />

                    {/* General Notification Settings */}
                    <div className="space-y-3">
                      <h3 className="text-sm sm:text-base font-semibold">General Settings</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <Label htmlFor="email-notif" className="text-xs sm:text-sm">Email Notifications</Label>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Receive notifications via email</p>
                          </div>
                          <Switch
                            id="email-notif"
                            checked={emailNotifications}
                            onCheckedChange={(checked) => updateGeneralSettings({ email_notifications: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Bell className="w-4 h-4 text-muted-foreground" />
                              <Label htmlFor="push-notif" className="text-xs sm:text-sm">Push Notifications</Label>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Receive browser push notifications</p>
                          </div>
                          <Switch
                            id="push-notif"
                            checked={pushNotifications}
                            onCheckedChange={(checked) => updateGeneralSettings({ push_notifications: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <Volume2 className="w-4 h-4 text-muted-foreground" />
                              <Label htmlFor="sound" className="text-xs sm:text-sm">Notification Sounds</Label>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground">Play sound when notifications arrive</p>
                          </div>
                          <Switch
                            id="sound"
                            checked={soundEnabled}
                            onCheckedChange={(checked) => updateGeneralSettings({ sound_enabled: checked })}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Appearance Section */}
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <div>
                        <CardTitle className="text-base sm:text-lg">Appearance</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Customize how the app looks</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Moon className="w-4 h-4 text-muted-foreground" />
                            <Label htmlFor="dark-mode" className="text-xs sm:text-sm">Dark Mode</Label>
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Toggle dark/light theme</p>
                        </div>
                        <Switch
                          id="dark-mode"
                          checked={isDark}
                          onCheckedChange={(checked) => {
                            setTheme(checked ? "dark" : "light");
                            toast.info(checked ? "Dark mode enabled" : "Light mode enabled");
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-muted-foreground" />
                            <Label htmlFor="ai-assistant" className="text-xs sm:text-sm">Show AI Assistant</Label>
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">Display floating AI button</p>
                        </div>
                        <Switch
                          id="ai-assistant"
                          checked={showAIAssistant}
                          onCheckedChange={(checked) => {
                            setShowAIAssistant(checked);
                            localStorage.setItem('xrozen-ai-visible', JSON.stringify(checked));
                            toast.success(
                              checked
                                ? "AI Assistant enabled"
                                : "AI Assistant hidden"
                            );
                            window.dispatchEvent(new StorageEvent('storage', {
                              key: 'xrozen-ai-visible',
                              newValue: JSON.stringify(checked)
                            }));
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Preferences Section */}
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <div>
                        <CardTitle className="text-base sm:text-lg">Preferences</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Language, timezone, and regional settings</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="language" className="text-xs sm:text-sm">Language</Label>
                        <Select value="en" disabled>
                          <SelectTrigger id="language" className="text-xs sm:text-sm h-9 sm:h-10">
                            <SelectValue placeholder="English (Coming Soon)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English (Multi-language coming soon)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="timezone" className="text-xs sm:text-sm">Timezone</Label>
                        <Select value={timezone} onValueChange={(value) => updateGeneralSettings({ timezone: value })}>
                          <SelectTrigger id="timezone" className="text-xs sm:text-sm h-9 sm:h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Asia/Kolkata">IST (Asia/Kolkata)</SelectItem>
                            <SelectItem value="America/New_York">EST (New York)</SelectItem>
                            <SelectItem value="Europe/London">GMT (London)</SelectItem>
                            <SelectItem value="Asia/Tokyo">JST (Tokyo)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date-format" className="text-xs sm:text-sm">Date Format</Label>
                        <Select value={dateFormat} onValueChange={(value) => updateGeneralSettings({ date_format: value })}>
                          <SelectTrigger id="date-format" className="text-xs sm:text-sm h-9 sm:h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dd/MM/yyyy">DD/MM/YYYY</SelectItem>
                            <SelectItem value="MM/dd/yyyy">MM/DD/YYYY</SelectItem>
                            <SelectItem value="yyyy-MM-dd">YYYY-MM-DD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs sm:text-sm">Preview</Label>
                        <div className="h-9 sm:h-10 flex items-center px-3 bg-muted rounded-md text-xs sm:text-sm">
                          {format(new Date(), dateFormat)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Privacy & Data Section */}
                <Card className="shadow-elegant">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      <div>
                        <CardTitle className="text-base sm:text-lg">Privacy & Data</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">Control your data and privacy settings</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">


                    <div className="space-y-2">
                      <h3 className="text-sm sm:text-base font-semibold">Data Management</h3>
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          className="w-full justify-between text-xs sm:text-sm h-9 sm:h-10"
                          onClick={handleExportData}
                        >
                          <span className="flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Export Your Data
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-between text-destructive hover:text-destructive hover:bg-destructive/10 text-xs sm:text-sm h-9 sm:h-10"
                          onClick={handleDeleteAccount}
                        >
                          <span className="flex items-center gap-2">
                            <Trash2 className="w-4 h-4" />
                            Delete Account
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm font-medium">Your data is secure</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            We use industry-standard encryption to protect your data. Read our{" "}
                            <Button variant="link" className="h-auto p-0 text-[10px] sm:text-xs">Privacy Policy</Button>
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Help & Support Card */}
                <Card className="shadow-elegant bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                  <CardContent className="pt-4 sm:pt-6">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <h3 className="text-sm sm:text-base font-semibold">Need Help?</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">
                          Check out our documentation or contact support for assistance.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" className="text-xs">
                            Documentation
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs">
                            Contact Support
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Account?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account and remove your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeleteAccount();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Yes, Delete My Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
