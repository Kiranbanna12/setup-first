import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionLimits {
    hasActiveSubscription: boolean;
    projectCount: number;
    canAddProject: boolean;
    canAddEditor: boolean;
    canAddClient: boolean;
    canCreateEditableShare: boolean;
    loading: boolean;
    editorLimit: number;
    clientLimit: number;
    currentEditorCount: number;
    currentClientCount: number;
    canAccessEditorsPage: boolean;
    canAccessClientsPage: boolean;
    planAllowsEditors: boolean;
    planAllowsClients: boolean;
}

const FREE_TIER_PROJECT_LIMIT = 3;

export function useSubscriptionLimits() {
    const [limits, setLimits] = useState<SubscriptionLimits>({
        hasActiveSubscription: false,
        projectCount: 0,
        canAddProject: true,
        canAddEditor: false,
        canAddClient: false,
        canCreateEditableShare: false,
        loading: true,
        editorLimit: 0,
        clientLimit: 0,
        currentEditorCount: 0,
        currentClientCount: 0,
        canAccessEditorsPage: false,
        canAccessClientsPage: false,
        planAllowsEditors: false,
        planAllowsClients: false,
    });

    useEffect(() => {
        checkLimits();
    }, []);

    const checkLimits = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLimits(prev => ({ ...prev, loading: false }));
                return;
            }

            // Check subscription status and get plan limits
            const { data: activeSub } = await supabase
                .from('user_subscriptions' as any)
                .select(`
                    status,
                    plan_id,
                    subscription_plans (
                        editor_limit,
                        client_limit,
                        user_category
                    )
                `)
                .eq('user_id', user.id)
                .in('status', ['active', 'trialing', 'cancelling'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            // Check if subscription is truly active (or cancelling but valid)
            const hasActiveSubscription = !!activeSub;

            // Get plan limits and user_category (default to 0/null if no active sub or plan not found)
            // @ts-ignore
            const editorLimit = activeSub?.subscription_plans?.editor_limit || 0;
            // @ts-ignore
            const clientLimit = activeSub?.subscription_plans?.client_limit || 0;
            // @ts-ignore
            const planUserCategory = activeSub?.subscription_plans?.user_category || null;

            // Count user's projects
            const { count: projectCount } = await supabase
                .from("projects")
                .select("*", { count: "exact", head: true })
                .eq("created_by", user.id);

            // Count user's editors (Created by me)
            const { count: editorCount } = await supabase
                .from("editors")
                .select("*", { count: "exact", head: true })
                .eq("created_by", user.id);

            // Count user's clients (Created by me)
            const { count: clientCount } = await supabase
                .from("clients")
                .select("*", { count: "exact", head: true })
                .eq("created_by", user.id);

            // Check if user IS an editor for someone else
            const { count: assignedEditorCount } = await supabase
                .from("editors")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id);

            // Check if user IS a client for someone else
            const { count: assignedClientCount } = await supabase
                .from("clients")
                .select("*", { count: "exact", head: true })
                .eq("user_id", user.id);

            const currentProjectCount = projectCount || 0;
            const currentEditorCount = editorCount || 0;
            const currentClientCount = clientCount || 0;
            const isAssignedEditor = (assignedEditorCount || 0) > 0;
            const isAssignedClient = (assignedClientCount || 0) > 0;

            // Access Logic:
            // 1. Plan allows it based on user_category AND limit > 0
            // 2. Legacy/Existing data (count > 0)
            // 3. Assigned role (Linked items)
            // Note: If I am in 'clients' table (isAssignedClient), someone added me as client -> They are my Linked Editor.
            // Note: If I am in 'editors' table (isAssignedEditor), someone added me as editor -> They are my Linked Client.

            // Plan Capability Flags based on user_category:
            // - 'editor' plan users can ONLY add clients (not editors)
            // - 'client' plan users can ONLY add editors (not clients)
            // - 'agency' plan users can add BOTH
            const planAllowsEditors = (planUserCategory === 'agency' || planUserCategory === 'client') && editorLimit > 0;
            const planAllowsClients = (planUserCategory === 'agency' || planUserCategory === 'editor') && clientLimit > 0;

            const canAccessEditorsPage = planAllowsEditors || currentEditorCount > 0 || isAssignedClient;
            const canAccessClientsPage = planAllowsClients || currentClientCount > 0 || isAssignedEditor;

            // Calculate limits based on subscription status
            if (hasActiveSubscription) {
                // Paid/Trial users: Check specific plan limits
                setLimits({
                    hasActiveSubscription: true,
                    projectCount: currentProjectCount,
                    canAddProject: true, // Assuming paid plans have unlimited projects
                    canAddEditor: currentEditorCount < editorLimit,
                    canAddClient: currentClientCount < clientLimit,
                    canCreateEditableShare: true,
                    loading: false,
                    editorLimit,
                    clientLimit,
                    currentEditorCount,
                    currentClientCount,
                    canAccessEditorsPage,
                    canAccessClientsPage,
                    planAllowsEditors,
                    planAllowsClients,
                });
            } else {
                // Free tier restrictions
                setLimits({
                    hasActiveSubscription: false,
                    projectCount: currentProjectCount,
                    canAddProject: currentProjectCount < FREE_TIER_PROJECT_LIMIT,
                    canAddEditor: false,
                    canAddClient: false,
                    canCreateEditableShare: false,
                    loading: false,
                    editorLimit: 0,
                    clientLimit: 0,
                    currentEditorCount,
                    currentClientCount,
                    // For free tier, mostly blocked unless legacy/assigned
                    canAccessEditorsPage: currentEditorCount > 0 || isAssignedClient,
                    canAccessClientsPage: currentClientCount > 0 || isAssignedEditor,
                    planAllowsEditors: false,
                    planAllowsClients: false,
                });
            }
        } catch (error) {
            console.error("Error checking subscription limits:", error);
            setLimits(prev => ({ ...prev, loading: false }));
        }
    };

    const refreshLimits = () => {
        checkLimits();
    };

    return { ...limits, refreshLimits };
}
