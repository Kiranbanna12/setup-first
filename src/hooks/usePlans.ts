import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionPlan {
    id: string;
    name: string;
    category: string;
    tier: string;
    price: number;
    billing_period: string;
    features: string[];
    project_limit: number | null;
    storage_limit: number | null;
    is_active: boolean;
    trial_days: number;
    created_at: string;
}

export function usePlans() {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            setLoading(true);
            setError(null);

            // Try to load from Supabase first
            try {
                const { data, error: supabaseError } = await supabase
                    .from('subscription_plans')
                    .select('*')
                    .eq('is_active', true)
                    .order('price', { ascending: true });

                if (!supabaseError && data && data.length > 0) {
                    const transformedPlans: SubscriptionPlan[] = data.map((plan: any) => ({
                        id: plan.id,
                        name: plan.name,
                        category: plan.category || 'editor',
                        tier: plan.tier || 'basic',
                        price: plan.price,
                        billing_period: plan.billing_period || 'monthly',
                        features: Array.isArray(plan.features) ? plan.features : [],
                        project_limit: plan.project_limit || null,
                        storage_limit: plan.storage_limit || null,
                        is_active: plan.is_active,
                        trial_days: plan.trial_days || 30,
                        created_at: plan.created_at
                    }));
                    setPlans(transformedPlans);
                    return;
                }
            } catch (apiError) {
                console.warn('Supabase plans not available, using mock data:', apiError);
            }

            // Fallback to mock data if Supabase fails or returns empty
            const mockPlans: SubscriptionPlan[] = [
                // Editor Plans
                {
                    id: "editor-basic-monthly",
                    name: "Basic",
                    category: "editor",
                    tier: "basic",
                    price: 499,
                    billing_period: "monthly",
                    features: [
                        "5 Active Projects",
                        "Basic Project Management",
                        "Video Version Control",
                        "Client Collaboration Tools",
                        "Basic Analytics Dashboard",
                        "Email Support",
                        "1GB Storage",
                        "Invoice Generation"
                    ],
                    project_limit: 5,
                    storage_limit: 1,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "editor-basic-annual",
                    name: "Basic (Annual)",
                    category: "editor",
                    tier: "basic",
                    price: 4790,
                    billing_period: "annual",
                    features: [
                        "5 Active Projects",
                        "Basic Project Management",
                        "Video Version Control",
                        "Client Collaboration Tools",
                        "Basic Analytics Dashboard",
                        "Email Support",
                        "1GB Storage",
                        "Invoice Generation",
                        "20% Annual Discount"
                    ],
                    project_limit: 5,
                    storage_limit: 1,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "editor-pro-monthly",
                    name: "Pro",
                    category: "editor",
                    tier: "pro",
                    price: 699,
                    billing_period: "monthly",
                    features: [
                        "25 Active Projects",
                        "Advanced Project Management",
                        "Unlimited Video Versions",
                        "Real-time Chat & Collaboration",
                        "Advanced Analytics & Reports",
                        "Priority Support",
                        "10GB Storage",
                        "Automated Invoicing",
                        "XrozenAI Assistant Access",
                        "Sub-project Management"
                    ],
                    project_limit: 25,
                    storage_limit: 10,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "editor-pro-annual",
                    name: "Pro (Annual)",
                    category: "editor",
                    tier: "pro",
                    price: 6710,
                    billing_period: "annual",
                    features: [
                        "25 Active Projects",
                        "Advanced Project Management",
                        "Unlimited Video Versions",
                        "Real-time Chat & Collaboration",
                        "Advanced Analytics & Reports",
                        "Priority Support",
                        "10GB Storage",
                        "Automated Invoicing",
                        "XrozenAI Assistant Access",
                        "Sub-project Management",
                        "20% Annual Discount"
                    ],
                    project_limit: 25,
                    storage_limit: 10,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "editor-premium-monthly",
                    name: "Premium",
                    category: "editor",
                    tier: "premium",
                    price: 899,
                    billing_period: "monthly",
                    features: [
                        "Unlimited Projects",
                        "Complete Project Suite",
                        "Unlimited Storage (100GB)",
                        "Team Collaboration Tools",
                        "Full Analytics Suite",
                        "24/7 Priority Support",
                        "Advanced XrozenAI Features",
                        "White-label Reports",
                        "API Access",
                        "Custom Integrations",
                        "Dedicated Account Manager"
                    ],
                    project_limit: null,
                    storage_limit: 100,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "editor-premium-annual",
                    name: "Premium (Annual)",
                    category: "editor",
                    tier: "premium",
                    price: 8630,
                    billing_period: "annual",
                    features: [
                        "Unlimited Projects",
                        "Complete Project Suite",
                        "Unlimited Storage (100GB)",
                        "Team Collaboration Tools",
                        "Full Analytics Suite",
                        "24/7 Priority Support",
                        "Advanced XrozenAI Features",
                        "White-label Reports",
                        "API Access",
                        "Custom Integrations",
                        "Dedicated Account Manager",
                        "20% Annual Discount"
                    ],
                    project_limit: null,
                    storage_limit: 100,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                // Client Plans
                {
                    id: "client-basic-monthly",
                    name: "Basic",
                    category: "client",
                    tier: "basic",
                    price: 499,
                    billing_period: "monthly",
                    features: [
                        "5 Active Projects",
                        "Video Review & Approval",
                        "Feedback & Corrections",
                        "Basic Communication Tools",
                        "Payment Tracking",
                        "Email Support",
                        "1GB Storage",
                        "Invoice Management"
                    ],
                    project_limit: 5,
                    storage_limit: 1,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "client-basic-annual",
                    name: "Basic (Annual)",
                    category: "client",
                    tier: "basic",
                    price: 4790,
                    billing_period: "annual",
                    features: [
                        "5 Active Projects",
                        "Video Review & Approval",
                        "Feedback & Corrections",
                        "Basic Communication Tools",
                        "Payment Tracking",
                        "Email Support",
                        "1GB Storage",
                        "Invoice Management",
                        "20% Annual Discount"
                    ],
                    project_limit: 5,
                    storage_limit: 1,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "client-pro-monthly",
                    name: "Pro",
                    category: "client",
                    tier: "pro",
                    price: 699,
                    billing_period: "monthly",
                    features: [
                        "25 Active Projects",
                        "Advanced Review System",
                        "Multi-editor Management",
                        "Real-time Chat",
                        "Project Analytics",
                        "Priority Support",
                        "10GB Storage",
                        "Payment Automation",
                        "XrozenAI Query Access",
                        "Bulk Approvals"
                    ],
                    project_limit: 25,
                    storage_limit: 10,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "client-pro-annual",
                    name: "Pro (Annual)",
                    category: "client",
                    tier: "pro",
                    price: 6710,
                    billing_period: "annual",
                    features: [
                        "25 Active Projects",
                        "Advanced Review System",
                        "Multi-editor Management",
                        "Real-time Chat",
                        "Project Analytics",
                        "Priority Support",
                        "10GB Storage",
                        "Payment Automation",
                        "XrozenAI Query Access",
                        "Bulk Approvals",
                        "20% Annual Discount"
                    ],
                    project_limit: 25,
                    storage_limit: 10,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "client-premium-monthly",
                    name: "Premium",
                    category: "client",
                    tier: "premium",
                    price: 899,
                    billing_period: "monthly",
                    features: [
                        "Unlimited Projects",
                        "Complete Review Workflow",
                        "Team Management",
                        "Unlimited Storage (100GB)",
                        "Full Analytics Dashboard",
                        "24/7 Support",
                        "Advanced XrozenAI",
                        "Custom Workflows",
                        "API Integration",
                        "Multi-brand Management",
                        "Dedicated Support"
                    ],
                    project_limit: null,
                    storage_limit: 100,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "client-premium-annual",
                    name: "Premium (Annual)",
                    category: "client",
                    tier: "premium",
                    price: 8630,
                    billing_period: "annual",
                    features: [
                        "Unlimited Projects",
                        "Complete Review Workflow",
                        "Team Management",
                        "Unlimited Storage (100GB)",
                        "Full Analytics Dashboard",
                        "24/7 Support",
                        "Advanced XrozenAI",
                        "Custom Workflows",
                        "API Integration",
                        "Multi-brand Management",
                        "Dedicated Support",
                        "20% Annual Discount"
                    ],
                    project_limit: null,
                    storage_limit: 100,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                // Agency Plans
                {
                    id: "agency-basic-monthly",
                    name: "Basic",
                    category: "agency",
                    tier: "basic",
                    price: 899,
                    billing_period: "monthly",
                    features: [
                        "10 Active Projects",
                        "3 Team Members",
                        "All Editor Features",
                        "All Client Features",
                        "Team Management",
                        "Centralized Billing",
                        "Email Support",
                        "5GB Storage",
                        "Basic Team Analytics"
                    ],
                    project_limit: 10,
                    storage_limit: 5,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "agency-basic-annual",
                    name: "Basic (Annual)",
                    category: "agency",
                    tier: "basic",
                    price: 8630,
                    billing_period: "annual",
                    features: [
                        "10 Active Projects",
                        "3 Team Members",
                        "All Editor Features",
                        "All Client Features",
                        "Team Management",
                        "Centralized Billing",
                        "Email Support",
                        "5GB Storage",
                        "Basic Team Analytics",
                        "20% Annual Discount"
                    ],
                    project_limit: 10,
                    storage_limit: 5,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "agency-pro-monthly",
                    name: "Pro",
                    category: "agency",
                    tier: "pro",
                    price: 1199,
                    billing_period: "monthly",
                    features: [
                        "50 Active Projects",
                        "10 Team Members",
                        "All Editor Pro Features",
                        "All Client Pro Features",
                        "Advanced Team Tools",
                        "Project Assignment",
                        "Priority Support",
                        "25GB Storage",
                        "Team Performance Analytics",
                        "XrozenAI for All Members",
                        "Custom Branding"
                    ],
                    project_limit: 50,
                    storage_limit: 25,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "agency-pro-annual",
                    name: "Pro (Annual)",
                    category: "agency",
                    tier: "pro",
                    price: 11510,
                    billing_period: "annual",
                    features: [
                        "50 Active Projects",
                        "10 Team Members",
                        "All Editor Pro Features",
                        "All Client Pro Features",
                        "Advanced Team Tools",
                        "Project Assignment",
                        "Priority Support",
                        "25GB Storage",
                        "Team Performance Analytics",
                        "XrozenAI for All Members",
                        "Custom Branding",
                        "20% Annual Discount"
                    ],
                    project_limit: 50,
                    storage_limit: 25,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "agency-premium-monthly",
                    name: "Premium",
                    category: "agency",
                    tier: "premium",
                    price: 1499,
                    billing_period: "monthly",
                    features: [
                        "Unlimited Projects",
                        "Unlimited Team Members",
                        "All Premium Features",
                        "White-label Platform",
                        "Unlimited Storage (500GB)",
                        "Dedicated Account Manager",
                        "24/7 Premium Support",
                        "Custom Workflows",
                        "API & Webhooks",
                        "Advanced Security",
                        "Custom Integrations",
                        "SLA Guarantee"
                    ],
                    project_limit: null,
                    storage_limit: 500,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                },
                {
                    id: "agency-premium-annual",
                    name: "Premium (Annual)",
                    category: "agency",
                    tier: "premium",
                    price: 14390,
                    billing_period: "annual",
                    features: [
                        "Unlimited Projects",
                        "Unlimited Team Members",
                        "All Premium Features",
                        "White-label Platform",
                        "Unlimited Storage (500GB)",
                        "Dedicated Account Manager",
                        "24/7 Premium Support",
                        "Custom Workflows",
                        "API & Webhooks",
                        "Advanced Security",
                        "Custom Integrations",
                        "SLA Guarantee",
                        "20% Annual Discount"
                    ],
                    project_limit: null,
                    storage_limit: 500,
                    is_active: true,
                    trial_days: 30,
                    created_at: new Date().toISOString()
                }
            ];

            setPlans(mockPlans);
        } catch (err: any) {
            console.error('Error loading plans:', err);
            setError(err.message || 'Failed to load plans');
        } finally {
            setLoading(false);
        }
    };

    const getPlansByCategory = (category: string) => {
        return plans.filter(plan => plan.category === category && plan.is_active);
    };

    const getPlanById = (id: string) => {
        return plans.find(plan => plan.id === id);
    };

    const getActivePlans = () => {
        return plans.filter(plan => plan.is_active);
    };

    const refreshPlans = () => {
        loadPlans();
    };

    return {
        plans,
        loading,
        error,
        getPlansByCategory,
        getPlanById,
        getActivePlans,
        refreshPlans
    };
}
