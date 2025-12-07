import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Settings, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { isAdminEmail } from "@/lib/adminAuth";
import { AdminLayout } from "@/layouts/AdminLayout";

export default function AdminSettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [razorpayKeyId, setRazorpayKeyId] = useState("");
  const [razorpayKeySecret, setRazorpayKeySecret] = useState("");

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if user email is in local admin list
    if (!isAdminEmail(user.email)) {
      toast.error("Access denied. Admin only.");
      navigate("/dashboard");
      return;
    }

    loadSettings();
  };

  const loadSettings = async () => {
    try {
      // Load Razorpay config
      const { data: razorpayData } = await supabase
        .from("app_settings" as any)
        .select("value")
        .eq("key", "razorpay_config")
        .single();

      if (razorpayData && "value" in razorpayData) {
        const config = razorpayData.value as any;
        setRazorpayKeyId(config.key_id || "");
        setRazorpayKeySecret(config.key_secret || "");
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };



  const saveRazorpayConfig = async () => {
    try {
      const { error } = await supabase
        .from("app_settings" as any)
        .update({
          value: {
            key_id: razorpayKeyId,
            key_secret: razorpayKeySecret
          }
        })
        .eq("key", "razorpay_config");

      if (error) throw error;
      toast.success("Razorpay configuration saved");
    } catch (error) {
      console.error("Error saving Razorpay config:", error);
      toast.error("Failed to save Razorpay configuration");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AdminLayout title="Admin Settings" description="Configure app-wide settings">
      <div className="max-w-4xl space-y-6">

        {/* Razorpay Configuration */}
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Razorpay Configuration
            </CardTitle>
            <CardDescription>
              Configure Razorpay payment gateway
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="razorpay-key-id">Razorpay Key ID</Label>
              <Input
                id="razorpay-key-id"
                value={razorpayKeyId}
                onChange={(e) => setRazorpayKeyId(e.target.value)}
                placeholder="rzp_test_..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="razorpay-key-secret">Razorpay Key Secret</Label>
              <Input
                id="razorpay-key-secret"
                type="password"
                value={razorpayKeySecret}
                onChange={(e) => setRazorpayKeySecret(e.target.value)}
                placeholder="Enter secret key"
              />
            </div>

            <Button
              className="gradient-primary w-full"
              onClick={saveRazorpayConfig}
            >
              Save Razorpay Configuration
            </Button>

            <div className="text-sm text-muted-foreground p-3 bg-muted rounded-lg">
              <p className="font-semibold mb-1">How to get Razorpay keys:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Sign up at razorpay.com</li>
                <li>Go to Settings → API Keys</li>
                <li>Generate keys for Test/Live mode</li>
                <li>Copy and paste here</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
