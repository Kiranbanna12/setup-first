
import React, { useRef } from "react";
import { Brain, Sparkles, Wand2, MessageSquareText, Search, FileJson } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { MagneticWrapper } from "@/components/shared/MagneticWrapper";
import gsap from "gsap";

export const AiAssistantSection = () => {
    const containerRef = useRef(null);


    useGSAP(() => {
        const tl = gsap.timeline({
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top center",
                end: "bottom center",
                scrub: 1
            }
        });

        tl.to(".ai-glow", { scale: 1.5, opacity: 0.8 })
            .to(".ai-glow", { scale: 1, opacity: 0.4 });

    }, { scope: containerRef });

    return (
        <section ref={containerRef} className="py-32 bg-zinc-950 px-4 relative overflow-hidden">
            {/* Gradient Masks for Smooth Transition */}
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-zinc-950 to-transparent z-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-zinc-950 to-transparent z-20 pointer-events-none" />

            {/* Background Effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-600/20 rounded-full blur-[120px] ai-glow opacity-40 pointer-events-none" />

            <div className="container mx-auto relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-16">

                    {/* Visual Side */}
                    <div className="w-full lg:w-1/2 flex justify-center">
                        <div className="relative w-[400px] aspect-square">
                            {/* Central Brain Core */}
                            <div className="absolute inset-0 m-auto w-48 h-48 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.5)] z-20 animate-float">
                                <Brain className="w-24 h-24 text-white" />
                            </div>

                            {/* Orbiting Elements */}
                            {[
                                { icon: MessageSquareText, color: "text-emerald-400", bg: "bg-emerald-900/50", pos: "top-0 left-10" },
                                { icon: Search, color: "text-teal-400", bg: "bg-teal-900/50", pos: "top-20 right-0" },
                                { icon: FileJson, color: "text-green-400", bg: "bg-green-900/50", pos: "bottom-10 left-0" },
                                { icon: Wand2, color: "text-lime-400", bg: "bg-lime-900/50", pos: "bottom-0 right-10" },
                            ].map((item, i) => (
                                <div key={i} className={`absolute ${item.pos}`} style={{ zIndex: 30 }}>
                                    <MagneticWrapper intensity={0.8} className="p-2">
                                        <div className={`p-4 rounded-2xl ${item.bg} backdrop-blur-md border border-white/10 shadow-xl cursor-default`}>
                                            <item.icon className={`w-6 h-6 ${item.color}`} />
                                        </div>
                                    </MagneticWrapper>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Content Side */}
                    <div className="w-full lg:w-1/2 text-white">
                        <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                            <Sparkles className="w-4 h-4" />
                            <span>Xrozen AI Mini</span>
                        </div>

                        <h2 className="text-5xl lg:text-6xl font-bold mb-8 leading-tight">
                            Meet Your <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">Studio Assistant</span>
                        </h2>

                        <p className="text-xl text-zinc-400 mb-10 leading-relaxed">
                            Xrozen AI Mini isn't just a chatbot. It's your studio manager. It tracks deadlines, summarizes long feedback chains, and helps you find that one missing file instantly.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[
                                { title: "Instant Invoicing", desc: "Just say 'Create invoice for Music Video'—done." },
                                { title: "Asset Retrieval", desc: "Find 'drone shots from the beach shoot' in seconds." },
                                { title: "Feedback Summary", desc: "Turns messy client chats into a clean To-Do list." },
                                { title: "24/7 Availability", desc: "Always ready to organize your workflow." }
                            ].map((feat, i) => (
                                <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                    <h3 className="font-bold text-lg mb-1">{feat.title}</h3>
                                    <p className="text-sm text-zinc-500">{feat.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};
