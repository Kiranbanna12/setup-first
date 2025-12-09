
import React, { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ShowcaseGallery = () => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef(null);

    const scroll = (direction: "left" | "right") => {
        if (scrollContainerRef.current) {
            const { current } = scrollContainerRef;
            const scrollAmount = direction === "left" ? -400 : 400;
            current.scrollBy({ left: scrollAmount, behavior: "smooth" });
        }
    };

    useGSAP(() => {
        gsap.from(".gallery-card", {
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top bottom-=100",
            },
            x: 100,
            opacity: 0,
            duration: 0.8,
            stagger: 0.2
        });
    }, { scope: containerRef });

    return (
        <section ref={containerRef} className="py-24 bg-zinc-950 border-y border-zinc-900">
            <div className="container mx-auto px-4 mb-12 flex items-end justify-between">
                <div>
                    <h2 className="text-4xl text-white font-bold mb-4">Inside the Workspace</h2>
                    <p className="text-zinc-400 max-w-xl">
                        See how Xrozen Workflow organizes your chaotic editing process into a streamlined pipeline.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button variant="outline" size="icon" onClick={() => scroll("left")} className="rounded-full border-zinc-800 hover:bg-zinc-900 text-white">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => scroll("right")} className="rounded-full border-zinc-800 hover:bg-zinc-900 text-white">
                        <ArrowRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>

            <div
                ref={scrollContainerRef}
                className="flex gap-8 overflow-x-auto px-4 pb-12 snap-x snap-mandatory scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {/* Mockup Cards */}
                {[
                    { title: "Project Dashboard", color: "bg-blue-900/20", border: "border-blue-500/20" },
                    { title: "Editor Worksheet", color: "bg-purple-900/20", border: "border-purple-500/20" },
                    { title: "Client Review Portal", color: "bg-green-900/20", border: "border-green-500/20" },
                    { title: "Invoice Generator", color: "bg-orange-900/20", border: "border-orange-500/20" },
                    { title: "Team Chat", color: "bg-pink-900/20", border: "border-pink-500/20" },
                ].map((item, i) => (
                    <div
                        key={i}
                        className={`gallery-card min-w-[300px] md:min-w-[600px] aspect-video rounded-3xl border ${item.border} ${item.color} relative overflow-hidden snap-center flex items-center justify-center group`}
                    >
                        <div className="absolute inset-0 bg-zinc-950/50 group-hover:bg-zinc-950/30 transition-colors" />

                        {/* Placeholder Content */}
                        <div className="z-10 text-center">
                            <div className="text-3xl font-bold text-white mb-2 opacity-50 group-hover:opacity-100 transition-opacity">{item.title}</div>
                            <div className="bg-white/10 px-4 py-2 rounded-full text-sm text-white backdrop-blur-md inline-block">High Fidelity UI</div>
                        </div>

                        {/* Decorative Lines */}
                        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </div>
                ))}
            </div>
        </section>
    );
};
