// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { isAdminEmail } from "@/lib/adminAuth";
import { AdminLayout } from "@/layouts/AdminLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Key, Plus, Edit, Trash2, AlertCircle, CheckCircle, Sparkles, Bot } from "lucide-react";
import { toast } from "sonner";

// AI Provider Models Configuration
const AI_PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  google: [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash Experimental" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { value: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.0-pro", label: "Gemini 1.0 Pro" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-4-turbo-preview", label: "GPT-4 Turbo Preview" },
    { value: "gpt-4", label: "GPT-4" },
    { value: "gpt-4-32k", label: "GPT-4 32K" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
    { value: "gpt-3.5-turbo-16k", label: "GPT-3.5 Turbo 16K" },
    { value: "o1", label: "O1" },
    { value: "o1-mini", label: "O1 Mini" },
    { value: "o1-preview", label: "O1 Preview" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Latest)" },
    { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Latest)" },
    { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
    { value: "claude-3-sonnet-20240229", label: "Claude 3 Sonnet" },
    { value: "claude-3-haiku-20240307", label: "Claude 3 Haiku" },
    { value: "claude-2.1", label: "Claude 2.1" },
    { value: "claude-2.0", label: "Claude 2.0" },
  ],
  mistral: [
    { value: "mistral-large-latest", label: "Mistral Large (Latest)" },
    { value: "mistral-medium-latest", label: "Mistral Medium (Latest)" },
    { value: "mistral-small-latest", label: "Mistral Small (Latest)" },
    { value: "open-mixtral-8x22b", label: "Mixtral 8x22B" },
    { value: "open-mixtral-8x7b", label: "Mixtral 8x7B" },
    { value: "open-mistral-7b", label: "Mistral 7B" },
    { value: "codestral-latest", label: "Codestral (Latest)" },
  ],
  cohere: [
    { value: "command-r-plus", label: "Command R+" },
    { value: "command-r", label: "Command R" },
    { value: "command", label: "Command" },
    { value: "command-light", label: "Command Light" },
  ],
};

// AI Provider names for display
const AI_PROVIDERS = [
  { value: "google", label: "Google Gemini" },
  { value: "openai", label: "OpenAI GPT" },
  { value: "anthropic", label: "Anthropic Claude" },
  { value: "mistral", label: "Mistral AI" },
  { value: "cohere", label: "Cohere" },
];

// Regular API Providers (non-AI)
const REGULAR_PROVIDERS = [
  { value: "stripe", label: "Stripe" },
  { value: "twilio", label: "Twilio" },
  { value: "sendgrid", label: "SendGrid" },
  { value: "aws", label: "AWS" },
  { value: "other", label: "Other" },
];

interface APIKey {
  id: string;
  name: string;
  provider: string;
  api_key: string;
  is_active: boolean;
  usage_limit: number | null;
  current_usage: number;
  environment: string;
  created_at: string;
  last_used: string | null;
}

interface AIProviderConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  api_key: string;
  is_active: boolean;
  is_default: boolean;
  usage_limit: number | null;
  current_usage: number;
  environment: string;
  created_at: string;
  updated_at: string;
}

export default function AdminAPI() {
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [aiConfigs, setAIConfigs] = useState<AIProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<APIKey | null>(null);
  const [editingAIConfig, setEditingAIConfig] = useState<AIProviderConfig | null>(null);
  const [activeTab, setActiveTab] = useState("ai");

  const [formData, setFormData] = useState({
    name: "",
    provider: "openai",
    api_key: "",
    usage_limit: "",
    environment: "production",
    is_active: true,
  });

  const [aiFormData, setAIFormData] = useState({
    name: "",
    provider: "google",
    model: "gemini-2.5-flash",
    api_key: "",
    usage_limit: "",
    environment: "production",
    is_active: true,
    is_default: false,
  });

  useEffect(() => {
    checkAdminAuth();
    loadAPIKeys();
    loadAIConfigs();
  }, []);

  const checkAdminAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if user email is in local admin list
    if (!isAdminEmail(user.email)) {
      toast.error("Unauthorized access");
      navigate("/dashboard");
      return;
    }
  };

  const loadAPIKeys = async () => {
    try {
      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setApiKeys((data as any) || []);
    } catch (error) {
      console.error("Error loading API keys:", error);
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  };

  const loadAIConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_provider_configs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.log("AI configs table may not exist yet:", error);
        return;
      }
      setAIConfigs((data as any) || []);
    } catch (error) {
      console.error("Error loading AI configs:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const keyData = {
        name: formData.name,
        provider: formData.provider,
        api_key: formData.api_key,
        usage_limit: formData.usage_limit ? Number(formData.usage_limit) : null,
        environment: formData.environment,
        is_active: formData.is_active,
      };

      if (editingKey) {
        const { error } = await supabase
          .from("api_keys")
          .update(keyData)
          .eq("id", editingKey.id);

        if (error) throw error;
        toast.success("API key updated successfully");
      } else {
        const { error } = await supabase
          .from("api_keys")
          .insert({ ...keyData, current_usage: 0 });

        if (error) throw error;
        toast.success("API key created successfully");
      }

      resetForm();
      setDialogOpen(false);
      loadAPIKeys();
    } catch (error: any) {
      console.error("Error saving API key:", error);
      toast.error(error.message || "Failed to save API key");
    }
  };

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const configData = {
        name: aiFormData.name,
        provider: aiFormData.provider,
        model: aiFormData.model,
        api_key: aiFormData.api_key,
        usage_limit: aiFormData.usage_limit ? Number(aiFormData.usage_limit) : null,
        environment: aiFormData.environment,
        is_active: aiFormData.is_active,
        is_default: aiFormData.is_default,
      };

      if (editingAIConfig) {
        const { error } = await supabase
          .from("ai_provider_configs")
          .update(configData)
          .eq("id", editingAIConfig.id);

        if (error) throw error;
        toast.success("AI configuration updated successfully");
      } else {
        const { error } = await supabase
          .from("ai_provider_configs")
          .insert({ ...configData, current_usage: 0 });

        if (error) throw error;
        toast.success("AI configuration created successfully");
      }

      resetAIForm();
      setDialogOpen(false);
      loadAIConfigs();
    } catch (error: any) {
      console.error("Error saving AI config:", error);
      toast.error(error.message || "Failed to save AI configuration");
    }
  };

  const handleEdit = (key: APIKey) => {
    setEditingKey(key);
    setEditingAIConfig(null);
    setFormData({
      name: key.name,
      provider: key.provider,
      api_key: key.api_key,
      usage_limit: key.usage_limit?.toString() || "",
      environment: key.environment,
      is_active: key.is_active,
    });
    setActiveTab("regular");
    setDialogOpen(true);
  };

  const handleAIEdit = (config: AIProviderConfig) => {
    setEditingAIConfig(config);
    setEditingKey(null);
    setAIFormData({
      name: config.name,
      provider: config.provider,
      model: config.model,
      api_key: config.api_key,
      usage_limit: config.usage_limit?.toString() || "",
      environment: config.environment,
      is_active: config.is_active,
      is_default: config.is_default,
    });
    setActiveTab("ai");
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;

    try {
      const { error } = await supabase
        .from("api_keys")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("API key deleted successfully");
      loadAPIKeys();
    } catch (error) {
      console.error("Error deleting API key:", error);
      toast.error("Failed to delete API key");
    }
  };

  const handleAIDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this AI configuration?")) return;

    try {
      const { error } = await supabase
        .from("ai_provider_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("AI configuration deleted successfully");
      loadAIConfigs();
    } catch (error) {
      console.error("Error deleting AI config:", error);
      toast.error("Failed to delete AI configuration");
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("api_keys")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(`API key ${!currentStatus ? 'enabled' : 'disabled'}`);
      loadAPIKeys();
    } catch (error) {
      console.error("Error toggling API key:", error);
      toast.error("Failed to update API key status");
    }
  };

  const toggleAIStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("ai_provider_configs")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(`AI configuration ${!currentStatus ? 'enabled' : 'disabled'}`);
      loadAIConfigs();
    } catch (error) {
      console.error("Error toggling AI config:", error);
      toast.error("Failed to update AI configuration status");
    }
  };

  const setAsDefaultAI = async (id: string) => {
    try {
      const { error } = await supabase
        .from("ai_provider_configs")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
      toast.success("Set as default AI model for Xrozen AI");
      loadAIConfigs();
    } catch (error) {
      console.error("Error setting default AI:", error);
      toast.error("Failed to set as default");
    }
  };

  const resetForm = () => {
    setEditingKey(null);
    setFormData({
      name: "",
      provider: "openai",
      api_key: "",
      usage_limit: "",
      environment: "production",
      is_active: true,
    });
  };

  const resetAIForm = () => {
    setEditingAIConfig(null);
    setAIFormData({
      name: "",
      provider: "google",
      model: "gemini-2.5-flash",
      api_key: "",
      usage_limit: "",
      environment: "production",
      is_active: true,
      is_default: false,
    });
  };

  const maskApiKey = (key: string) => {
    return key.substring(0, 8) + "..." + key.substring(key.length - 4);
  };

  const getUsagePercentage = (current: number, limit: number | null) => {
    if (!limit) return 0;
    return (current / limit) * 100;
  };

  const getProviderLabel = (value: string) => {
    const aiProvider = AI_PROVIDERS.find(p => p.value === value);
    if (aiProvider) return aiProvider.label;
    const regularProvider = REGULAR_PROVIDERS.find(p => p.value === value);
    return regularProvider?.label || value;
  };

  const getModelLabel = (provider: string, model: string) => {
    const models = AI_PROVIDER_MODELS[provider];
    if (!models) return model;
    const found = models.find(m => m.value === model);
    return found?.label || model;
  };

  if (loading) {
    return (
      <AdminLayout title="API Management" description="Manage API keys and AI model configurations">
        <div className="max-w-7xl space-y-6">
          <div className="flex justify-between">
            <div className="h-10 w-40 bg-muted/50 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="shadow-elegant">
                <CardHeader className="pb-2">
                  <div className="h-4 w-28 bg-muted/50 rounded animate-pulse" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-12 bg-muted/50 rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            <div className="h-6 w-48 bg-muted/50 rounded animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} className="shadow-elegant">
                  <CardHeader>
                    <div className="h-6 w-40 bg-muted/50 rounded animate-pulse" />
                    <div className="h-4 w-32 bg-muted/40 rounded animate-pulse mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-4 w-full bg-muted/30 rounded animate-pulse" />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="API Management" description="Manage API keys and AI model configurations">
      <div className="max-w-7xl space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <Button onClick={() => { resetForm(); resetAIForm(); setDialogOpen(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Configuration
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="shadow-elegant">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">AI Configurations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{aiConfigs.length}</div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active AI Models</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {aiConfigs.filter(c => c.is_active).length}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Other API Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{apiKeys.length}</div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Default Model</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm font-medium truncate">
                {aiConfigs.find(c => c.is_default)?.model || "Not set"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* AI Configurations Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">AI Provider Configurations</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Configure AI models for Xrozen AI. The default model will be used for AI conversations.
          </p>

          {aiConfigs.length === 0 ? (
            <Card className="shadow-elegant p-8 text-center">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No AI Configurations</h3>
              <p className="text-muted-foreground mb-4">
                Add your first AI provider configuration to power Xrozen AI.
              </p>
              <Button onClick={() => { resetAIForm(); setActiveTab("ai"); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add AI Configuration
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {aiConfigs.map((config) => {
                const usagePercentage = getUsagePercentage(config.current_usage, config.usage_limit);
                const isNearLimit = usagePercentage > 80;

                return (
                  <Card key={config.id} className={`shadow-elegant ${config.is_default ? 'ring-2 ring-primary' : ''}`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{config.name}</CardTitle>
                            <CardDescription>{getProviderLabel(config.provider)}</CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2 items-center flex-wrap justify-end">
                          {config.is_default && (
                            <Badge className="bg-primary">Default</Badge>
                          )}
                          <Badge className={config.is_active ? "bg-success" : "bg-muted"}>
                            {config.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className="capitalize">{config.environment}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Model</p>
                          <Badge variant="secondary" className="font-mono">
                            {getModelLabel(config.provider, config.model)}
                          </Badge>
                        </div>

                        <div>
                          <p className="text-sm text-muted-foreground mb-1">API Key</p>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{maskApiKey(config.api_key)}</code>
                        </div>

                        {config.usage_limit && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Usage</span>
                              <span className={isNearLimit ? "text-warning font-medium" : ""}>
                                {config.current_usage} / {config.usage_limit}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${isNearLimit ? "bg-warning" : "bg-success"
                                  }`}
                                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t flex-wrap">
                          {!config.is_default && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setAsDefaultAI(config.id)}
                            >
                              Set Default
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleAIStatus(config.id, config.is_active)}
                          >
                            {config.is_active ? (
                              <>
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Disable
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Enable
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAIEdit(config)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAIDelete(config.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Regular API Keys Section */}
        <div className="space-y-4 mt-8">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Other API Keys</h2>
          </div>
          <p className="text-muted-foreground text-sm">
            Manage API keys for external services like Stripe, AWS, SendGrid, etc.
          </p>

          {apiKeys.length === 0 ? (
            <Card className="shadow-elegant p-8 text-center">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No API Keys</h3>
              <p className="text-muted-foreground mb-4">
                Add API keys for external service integrations.
              </p>
              <Button variant="outline" onClick={() => { resetForm(); setActiveTab("regular"); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add API Key
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {apiKeys.map((apiKey) => {
                const usagePercentage = getUsagePercentage(apiKey.current_usage, apiKey.usage_limit);
                const isNearLimit = usagePercentage > 80;

                return (
                  <Card key={apiKey.id} className="shadow-elegant">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Key className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{apiKey.name}</CardTitle>
                            <CardDescription className="capitalize">{getProviderLabel(apiKey.provider)}</CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Badge className={apiKey.is_active ? "bg-success" : "bg-muted"}>
                            {apiKey.is_active ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className="capitalize">{apiKey.environment}</Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">API Key</p>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{maskApiKey(apiKey.api_key)}</code>
                        </div>

                        {apiKey.usage_limit && (
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-muted-foreground">Usage</span>
                              <span className={isNearLimit ? "text-warning font-medium" : ""}>
                                {apiKey.current_usage} / {apiKey.usage_limit}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all ${isNearLimit ? "bg-warning" : "bg-success"
                                  }`}
                                style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {apiKey.last_used && (
                          <div className="text-sm text-muted-foreground">
                            Last used: {new Date(apiKey.last_used).toLocaleDateString()}
                          </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => toggleStatus(apiKey.id, apiKey.is_active)}
                          >
                            {apiKey.is_active ? (
                              <>
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Disable
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Enable
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => handleEdit(apiKey)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(apiKey.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { resetForm(); resetAIForm(); } setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingKey ? "Edit API Key" : editingAIConfig ? "Edit AI Configuration" : "Add New Configuration"}
            </DialogTitle>
            <DialogDescription>
              Configure API keys or AI model settings
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="ai" className="gap-2">
                <Sparkles className="h-4 w-4" />
                AI Models
              </TabsTrigger>
              <TabsTrigger value="regular" className="gap-2">
                <Key className="h-4 w-4" />
                Other APIs
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai" className="mt-4">
              <form onSubmit={handleAISubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai_name">Configuration Name</Label>
                    <Input
                      id="ai_name"
                      placeholder="e.g., Gemini Production"
                      value={aiFormData.name}
                      onChange={(e) => setAIFormData({ ...aiFormData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai_provider">AI Provider</Label>
                    <Select
                      value={aiFormData.provider}
                      onValueChange={(value) => {
                        const defaultModel = AI_PROVIDER_MODELS[value]?.[0]?.value || "";
                        setAIFormData({ ...aiFormData, provider: value, model: defaultModel });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AI_PROVIDERS.map((provider) => (
                          <SelectItem key={provider.value} value={provider.value}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_model">Model</Label>
                  <Select
                    value={aiFormData.model}
                    onValueChange={(value) => setAIFormData({ ...aiFormData, model: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(AI_PROVIDER_MODELS[aiFormData.provider] || []).map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ai_api_key">API Key</Label>
                  <Input
                    id="ai_api_key"
                    type="password"
                    placeholder="Enter your API key..."
                    value={aiFormData.api_key}
                    onChange={(e) => setAIFormData({ ...aiFormData, api_key: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ai_usage_limit">Usage Limit (optional)</Label>
                    <Input
                      id="ai_usage_limit"
                      type="number"
                      placeholder="10000"
                      value={aiFormData.usage_limit}
                      onChange={(e) => setAIFormData({ ...aiFormData, usage_limit: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ai_environment">Environment</Label>
                    <Select
                      value={aiFormData.environment}
                      onValueChange={(value) => setAIFormData({ ...aiFormData, environment: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ai_is_active"
                      checked={aiFormData.is_active}
                      onCheckedChange={(checked) => setAIFormData({ ...aiFormData, is_active: checked })}
                    />
                    <Label htmlFor="ai_is_active">Active</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="ai_is_default"
                      checked={aiFormData.is_default}
                      onCheckedChange={(checked) => setAIFormData({ ...aiFormData, is_default: checked })}
                    />
                    <Label htmlFor="ai_is_default">Set as Default for Xrozen AI</Label>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingAIConfig ? "Update Configuration" : "Add Configuration"}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="regular" className="mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Key Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Stripe Production"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Select value={formData.provider} onValueChange={(value) => setFormData({ ...formData, provider: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REGULAR_PROVIDERS.map((provider) => (
                          <SelectItem key={provider.value} value={provider.value}>
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api_key">API Key</Label>
                  <Input
                    id="api_key"
                    type="password"
                    placeholder="sk-..."
                    value={formData.api_key}
                    onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="usage_limit">Usage Limit (optional)</Label>
                    <Input
                      id="usage_limit"
                      type="number"
                      placeholder="10000"
                      value={formData.usage_limit}
                      onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="environment">Environment</Label>
                    <Select value={formData.environment} onValueChange={(value) => setFormData({ ...formData, environment: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="development">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingKey ? "Update Key" : "Add Key"}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
