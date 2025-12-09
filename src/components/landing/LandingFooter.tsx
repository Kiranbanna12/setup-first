
import React from "react";
import { Link } from "react-router-dom";
import { Github, Twitter, Linkedin } from "lucide-react";

export const LandingFooter = () => {
    return (
        <footer className="bg-black border-t border-zinc-900 pt-16 pb-8">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
                    <div className="col-span-1 md:col-span-2">
                        <h3 className="text-2xl font-bold mb-4 text-white">Xrozen Workflow</h3>
                        <p className="text-zinc-500 max-w-sm">
                            The ultimate project management solution tailored for video editors and creative agencies. Streamline your production pipeline today.
                        </p>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-6 text-white">Product</h4>
                        <ul className="space-y-4 text-zinc-500">
                            <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                            <li><a href="#financials" className="hover:text-primary transition-colors">Pricing</a></li>
                            <li><span className="hover:text-primary transition-colors cursor-pointer">Download</span></li>
                            <li><Link to="/auth" className="hover:text-primary transition-colors">Sign In</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-6 text-white">Legal</h4>
                        <ul className="space-y-4 text-zinc-500">
                            <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                            <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-muted-foreground">
                        © {new Date().getFullYear()} Xrozen Inc. All rights reserved.
                    </div>
                    <div className="flex items-center gap-6">
                        <Github className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
                        <Twitter className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
                        <Linkedin className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer" />
                    </div>
                </div>
            </div>
        </footer>
    );
};
