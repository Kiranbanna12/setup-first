
import React, { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { FilePlus, Edit, Eye, MessageSquare, CreditCard } from "lucide-react";

export const WorkflowSteps = () => {
    const containerRef = useRef(null);

    useGSAP(() => {
        const steps = gsap.utils.toArray(".workflow-step");

        // Connector Line - Draws first/with the steps
        gsap.from(".connector-line", {
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top 70%",
                end: "bottom 60%",
                scrub: 0.2
            },
            scaleX: 0,
            opacity: 0.5,
            ease: "linear",
            transformOrigin: "left center" // Expands from left
        });

        // Steps - Pop up one by one
        gsap.from(steps, {
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top 70%",
                end: "bottom 60%",
                scrub: 0.2
            },
            y: 50,
            opacity: 0,
            scale: 0.8,
            stagger: 0.5, // Significant stagger to match scroll progress
            ease: "linear"
        });
    }, { scope: containerRef });

    const steps = [
        { icon: FilePlus, title: "Add Project", desc: "Create a new project workspace & invite your team." },
        { icon: Edit, title: "Versions", desc: "Upload cuts (V1, V2) & maintain clean history." },
        { icon: Eye, title: "Client Review", desc: "Share secure links for time-stamped feedback." },
        { icon: MessageSquare, title: "Refine", desc: "Chat with editors directly on the timeline." },
        { icon: CreditCard, title: "Get Paid", desc: "Generate invoices & track expenses instantly." },
    ];

    return (
        <section ref={containerRef} className="py-32 bg-zinc-950 relative">
            <div className="container mx-auto px-4">
                <div className="text-center mb-24">
                    <h2 className="text-4xl font-bold mb-4">The Perfect Pipeline</h2>
                    <p className="text-xl text-muted-foreground">From raw footage to final payment.</p>
                </div>

                <div className="relative flex flex-col md:flex-row justify-between items-center gap-8 max-w-6xl mx-auto">
                    {/* Connecting Line (Desktop) */}
                    <div className="absolute top-8 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent hidden md:block connector-line" />

                    {steps.map((step, i) => {
                        const Icon = step.icon;
                        return (
                            <div key={i} className="workflow-step relative z-10 flex flex-col items-center text-center max-w-[180px]">
                                <div className="w-16 h-16 rounded-2xl bg-card border-2 border-emerald-500/20 flex items-center justify-center mb-6 shadow-glow relative group transition-all hover:scale-110 hover:border-emerald-500">
                                    <div className="absolute inset-0 bg-emerald-500/5 rounded-2xl blur-lg -z-10 group-hover:bg-emerald-500/20 transition-colors" />
                                    <Icon className="w-7 h-7 text-emerald-500" />

                                    {/* Number Badge */}
                                    <div className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-sm font-bold shadow-sm text-emerald-400">
                                        {i + 1}
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                                <p className="text-sm text-muted-foreground">{step.desc}</p>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
