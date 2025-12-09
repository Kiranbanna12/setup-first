
import React, { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export const ExpandableGallery = () => {
    const containerRef = useRef(null);

    useGSAP(() => {
        gsap.from(".expandable-card", {
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top bottom-=100",
            },
            y: 50,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: "power2.out"
        });
    }, { scope: containerRef });

    const cards = [
        {
            title: "Command Center",
            subtitle: "Global Overview",
            image: "/assets/Screenshots/Dashboard.png",
            color: "from-emerald-600/20 to-emerald-900/20"
        },
        {
            title: "Projects",
            subtitle: "Kanban & Lists",
            image: "/assets/Screenshots/Projects.png",
            color: "from-green-600/20 to-green-900/20"
        },
        {
            title: "Chat",
            subtitle: "Contextual Comms",
            image: "/assets/Screenshots/Chat.png",
            color: "from-teal-600/20 to-teal-900/20"
        },
        {
            title: "AI Mini",
            subtitle: "Smart Assistant",
            image: "/assets/Screenshots/Xrozen-ai-mini.png",
            color: "from-lime-600/20 to-lime-900/20"
        },
        {
            title: "Financials",
            subtitle: "Invoicing Suite",
            image: "/assets/Screenshots/Invoice.png",
            color: "from-emerald-600/20 to-emerald-900/20"
        }
    ];

    return (
        <section ref={containerRef} className="py-24 bg-zinc-950 relative overflow-hidden">
            <div className="container mx-auto px-4">
                <div className="mb-16 text-center">
                    <h2 className="text-4xl font-bold mb-4 text-white">Xrozen In Action</h2>
                    <p className="text-zinc-400 max-w-xl mx-auto text-lg">
                        Navigate your entire production pipeline from a single, beautiful interface.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-4 h-[600px] w-full max-w-6xl mx-auto">
                    {cards.map((card, index) => (
                        <div
                            key={index}
                            className="expandable-card relative flex-1 hover:flex-[3] transition-[flex] duration-500 ease-in-out rounded-3xl overflow-hidden cursor-pointer group border border-zinc-800"
                        >
                            {/* Image Background */}
                            <div className="absolute inset-0">
                                <img
                                    src={card.image}
                                    alt={card.title}
                                    className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-110 opacity-60 group-hover:opacity-100" // Increased opacity on hover for clarity
                                />
                                <div className={`absolute inset-0 bg-gradient-to-b ${card.color} mix-blend-overlay`} />
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-90" />
                            </div>

                            {/* Content */}
                            <div className="absolute bottom-8 left-8 z-10 opacity-100 md:opacity-0 md:group-hover:opacity-100 translate-y-0 md:translate-y-4 md:group-hover:translate-y-0 transition-all duration-500 delay-100">
                                <h3 className="text-2xl font-bold text-white mb-1">{card.title}</h3>
                                <p className="text-zinc-300 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-sm inline-block">
                                    {card.subtitle}
                                </p>
                            </div>

                            {/* Vertical Title (Visible when collapsed on desktop) */}
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 md:group-hover:opacity-0 transition-opacity duration-300 hidden md:block">
                                <span className="writing-vertical-rl text-zinc-500 font-bold tracking-widest uppercase text-xs">
                                    {card.title}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
