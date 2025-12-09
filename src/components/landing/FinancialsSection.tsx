
import React, { useRef } from "react";
import { DollarSign, PieChart, FileText, ArrowUpRight } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export const FinancialsSection = () => {
    const containerRef = useRef(null);
    const chartsRef = useRef(null);

    useGSAP(() => {
        gsap.from(chartsRef.current, {
            scrollTrigger: {
                trigger: chartsRef.current,
                start: "top center+=100",
            },
            scale: 0.8,
            opacity: 0,
            duration: 1,
            ease: "back.out(1.7)"
        });

        gsap.from(".fin-item", {
            scrollTrigger: {
                trigger: containerRef.current,
                start: "top bottom-=100"
            },
            x: -50,
            opacity: 0,
            duration: 0.6,
            stagger: 0.1
        });
    }, { scope: containerRef });

    return (
        <section ref={containerRef} className="py-24 bg-zinc-950 relative" id="financials">
            <div className="container mx-auto px-4">
                <div className="flex flex-col lg:flex-row items-center gap-16">
                    <div className="lg:w-1/2">
                        <h2 className="text-4xl font-bold mb-6 text-white">Built-in Financial Suite</h2>
                        <p className="text-xl text-zinc-400 mb-10">
                            Stop using separate tools for billing. Xrozen Workflow integrates invoicing and expense tracking directly into your projects, so you know exactly how profitable every cut is.
                        </p>

                        <div className="space-y-6">
                            {[
                                { icon: FileText, title: "Smart Invoices", desc: "Auto-generated from project milestones. PDF export & email delivery." },
                                { icon: ArrowUpRight, title: "Expense Tracking", desc: "Log software subscriptions, assets, and freelancer payouts." },
                                { icon: PieChart, title: "Profit Analytics", desc: "Visual breakdowns of revenue vs expenses per project." }
                            ].map((item, i) => (
                                <div key={i} className="fin-item flex items-start gap-4 p-4 rounded-xl hover:bg-zinc-900 transition-colors">
                                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                                        <item.icon className="w-6 h-6 text-emerald-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">{item.title}</h3>
                                        <p className="text-zinc-500">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="lg:w-1/2" ref={chartsRef}>
                        {/* Abstract Financial UI Representation */}
                        <div className="relative bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-800 p-6 md:p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <div className="text-sm text-muted-foreground">Total Revenue</div>
                                    <div className="text-3xl font-bold text-foreground">₹2,45,000</div>
                                </div>
                                <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-600 text-sm font-semibold">
                                    +12.5%
                                </div>
                            </div>

                            {/* Fake Chart Bars */}
                            <div className="flex items-end justify-between h-40 gap-2 mb-8">
                                {[40, 60, 45, 70, 50, 80, 65, 90].map((h, i) => (
                                    <div key={i} className="w-full bg-muted rounded-t-lg relative group">
                                        <div
                                            className="absolute bottom-0 left-0 right-0 bg-emerald-500/80 rounded-t-lg transition-all duration-1000 group-hover:bg-emerald-400"
                                            style={{ height: `${h}%` }}
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Recent Transactions List */}
                            <div className="space-y-4">
                                {[
                                    { name: "Project Alpha Invoice", date: "Today", amount: "+ ₹15,000", type: "inc" },
                                    { name: "Envato Elements", date: "Yesterday", amount: "- ₹2,400", type: "exp" }
                                ].map((t, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${t.type === 'inc' ? 'bg-emerald-500/20' : 'bg-red-500/20'}`}>
                                                <DollarSign className={`w-4 h-4 ${t.type === 'inc' ? 'text-emerald-500' : 'text-red-500'}`} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold">{t.name}</div>
                                                <div className="text-xs text-muted-foreground">{t.date}</div>
                                            </div>
                                        </div>
                                        <div className={`font-mono text-sm ${t.type === 'inc' ? 'text-emerald-600' : 'text-red-600'}`}>
                                            {t.amount}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
