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

            // Check subscription status
            const { data: profile } = await supabase
                .from("profiles")
                .select("subscription_active, subscription_tier")
                .eq("id", user.id)
                .single();

            // Check if subscription is truly active
            const hasActiveSubscription = (profile as any)?.subscription_active === true;

            // Count user's projects
            const { count: projectCount } = await supabase
                .from("projects")
                .select("*", { count: "exact", head: true })
                .eq("created_by", user.id);

            const currentProjectCount = projectCount || 0;

            // Calculate limits based on subscription status
            if (hasActiveSubscription) {
                // Paid users have full access
                setLimits({
                    hasActiveSubscription: true,
                    projectCount: currentProjectCount,
                    canAddProject: true,
                    canAddEditor: true,
                    canAddClient: true,
                    canCreateEditableShare: true,
                    loading: false,
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
