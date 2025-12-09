
import React, { useRef } from "react";
import {
    GitBranch, MessageSquare, Users, Layers, Zap, CheckCircle2,
    LayoutDashboard, Globe, Shield, Smartphone
} from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export const FeaturesSection = () => {
    const containerRef = useRef(null);

    useGSAP(() => {
        // Header Animation linked to scroll
        gsap.from(".section-header", {
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top bottom", // Start when section top hits viewport bottom
                end: "top center",   // End when section top hits viewport center
                scrub: 1             // Smooth scrubbing
            },
            y: 50,
            opacity: 0,
            duration: 1,
            ease: "linear" // Linear ease is better for scrub
        });

        // Cards Animation linked to scroll
        // animating cards as a group might be too uniform, let's keep the stagger but link it to a longer scroll distance
        const cards = gsap.utils.toArray(".bento-card");

        gsap.from(cards, {
            scrollTrigger: {
                trigger: ".bento-grid",
                start: "top 75%",      // Start when grid top is 75% down the screen (lower)
                end: "bottom 50%",     // End when grid bottom is 50% down the screen (covers full height)
                scrub: 0.2             // Practically instant (realtime) but smooth
            },
            y: 50,
            opacity: 0,
            duration: 1,
            stagger: 0.5,              // Larger stagger creates distinct "one by one" feel
            ease: "linear"
        });
    }, { scope: containerRef });

    return (
        <section ref={containerRef} className="py-24 bg-zinc-950 relative overflow-hidden" id="features">
            <div className="container mx-auto px-4">
                <div className="text-center max-w-3xl mx-auto mb-20 section-header">
                    <h2 className="text-4xl md:text-5xl font-bold mb-6">Everything You Need</h2>
                    <p className="text-xl text-muted-foreground">
                        A powerhouse of features designed to unify your entire creative workflow.
                    </p>
                </div>

                {/* Bento Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[250px] bento-grid">

                    {/* Large Featured Card */}
                    <div className="bento-card col-span-1 md:col-span-2 lg:col-span-2 row-span-2 bg-zinc-900 border border-zinc-800 rounded-3xl p-8 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-emerald-600/20 via-green-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="relative z-10 h-full flex flex-col">
                            <div className="w-12 h-12 bg-zinc-800 rounded-2xl flex items-center justify-center mb-6">
                                <LayoutDashboard className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-3xl font-bold mb-4 text-white">Centralized Project Hub</h3>
                            <p className="text-zinc-400 text-lg mb-8 flex-grow">
                                Add unlimited projects, invite clients & editors, and track every cut. A single dashboard to manage your entire production house, just like an OS.
                            </p>
                            {/* Abstract mini-UI Mockup */}
                            <div className="w-full h-40 bg-zinc-800/50 rounded-xl border border-zinc-700/50 p-4 flex gap-4">
                                <div className="w-1/3 bg-zinc-700/50 rounded-lg animate-pulse" />
                                <div className="w-2/3 space-y-3">
                                    <div className="w-full h-4 bg-zinc-700/50 rounded-md" />
                                    <div className="w-3/4 h-4 bg-zinc-700/50 rounded-md" />
                                    <div className="w-1/2 h-4 bg-zinc-700/50 rounded-md" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chat Card */}
                    <div className="bento-card col-span-1 md:col-span-1 lg:col-span-2 row-span-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10 transition-all group-hover:bg-emerald-500/20" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                                    <MessageSquare className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="text-xl font-bold">No More WhatsApp Chaos</h3>
                            </div>
                            <p className="text-muted-foreground">Dedicated, project-based chat channels. Keeps feedback organized per project, never mixed up.</p>
                        </div>
                    </div>

                    {/* Version Control */}
                    <div className="bento-card col-span-1 md:col-span-1 row-span-1 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 relative group overflow-hidden">
                        <div className="absolute inset-0 bg-dotted-pattern opacity-10" />
                        <GitBranch className="w-8 h-8 text-emerald-500 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">Smart Versioning</h3>
                        <p className="text-sm text-zinc-400">Manage V1, V2, Final iterations cleanly. Restore old cuts in one click.</p>
                    </div>

                    {/* Client Portal */}
                    <div className="bento-card col-span-1 md:col-span-1 row-span-1 bg-emerald-600 text-white rounded-3xl p-6 relative overflow-hidden group">
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                        <Globe className="w-8 h-8 text-white mb-4" />
                        <h3 className="text-lg font-bold mb-2">Client Portal</h3>
                        <p className="text-sm text-emerald-100">Professional review links. Clients approve cuts without needing an account.</p>
                    </div>

                    {/* Mobile App */}
                    <div className="bento-card col-span-1 md:col-span-1 row-span-1 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 flex flex-col justify-between group cursor-pointer hover:border-emerald-500/50 transition-colors">
                        <div>
                            <Smartphone className="w-8 h-8 text-teal-500 mb-4" />
                            <h3 className="text-lg font-bold mb-2">Xrozen App</h3>
                        </div>
                        <div className="text-right">
                            <div className="inline-block px-3 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full text-xs font-bold">Download Now</div>
                        </div>
                    </div>

                    {/* Security */}
                    <div className="bento-card col-span-1 md:col-span-1 lg:col-span-2 row-span-1 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex items-center justify-between relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-zinc-800/0 via-zinc-800/50 to-zinc-800/0 w-1/2 -skew-x-12 translate-x-full group-hover:animate-shimmer" />
                        <div>
                            <h3 className="text-xl font-bold text-white mb-1">Financial Suite</h3>
                            <p className="text-zinc-400 text-sm">Generate Invoices & Track Expenses directly within projects.</p>
                        </div>
                        <Shield className="w-10 h-10 text-zinc-600" />
                    </div>

                </div>
            </div>
        </section>
    );
};
