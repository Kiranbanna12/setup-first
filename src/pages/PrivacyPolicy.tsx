import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { Shield, Lock, Eye, Database, CreditCard, Users, Bot, FileVideo, Mail, Globe } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white dark">
      <Header />

      <main className="flex-1 bg-zinc-950">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
                <Shield className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
              <p className="text-muted-foreground">Last updated: December 2024</p>
              <p className="text-sm text-muted-foreground mt-2">
                Xrozen Workflow ("we", "our", "us") is committed to protecting your privacy.
              </p>
            </div>

            {/* Quick Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
              <Card className="text-center p-4">
                <Lock className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium">Encrypted Data</p>
              </Card>
              <Card className="text-center p-4">
                <Eye className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium">No Data Selling</p>
              </Card>
              <Card className="text-center p-4">
                <Database className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium">Secure Storage</p>
              </Card>
              <Card className="text-center p-4">
                <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                <p className="text-xs font-medium">Your Control</p>
              </Card>
            </div>

            <Card className="shadow-xl">
              <CardContent className="p-6 md:p-10 space-y-8">
                {/* Section 1 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">1</span>
                    Information We Collect
                  </h2>

                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Account Information</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>Full name and email address</li>
                        <li>Profile picture (optional)</li>
                        <li>Password (encrypted)</li>
                        <li>Phone number (optional)</li>
                        <li>Company/organization name (optional)</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Project & Content Data</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>Video projects and metadata you create</li>
                        <li>Video files and versions uploaded</li>
                        <li>Project notes, comments, and annotations</li>
                        <li>Chat messages with team members</li>
                        <li>Client and editor information you add</li>
                        <li>Invoice and expense data</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Payment Information</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>Subscription plan details</li>
                        <li>Billing history and invoices</li>
                        <li>Payment transactions (processed securely via Razorpay)</li>
                        <li>We do NOT store your credit/debit card numbers</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Usage Data</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>Login activity and session information</li>
                        <li>Feature usage patterns</li>
                        <li>Device type, browser, and IP address</li>
                        <li>Xrozen AI Mini conversation history</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Section 2 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">2</span>
                    How We Use Your Information
                  </h2>

                  <div className="space-y-3 text-muted-foreground">
                    <div className="flex items-start gap-3">
                      <FileVideo className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p><strong>Service Delivery:</strong> To provide project management, version control, and collaboration features</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <CreditCard className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p><strong>Billing:</strong> To process subscription payments and manage your account</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Bot className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p><strong>AI Features:</strong> To power Xrozen AI Mini for project insights and assistance</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Mail className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p><strong>Communication:</strong> To send notifications, updates, and support messages</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <Globe className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <p><strong>Improvement:</strong> To analyze usage patterns and improve our services</p>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Section 3 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">3</span>
                    Third-Party Services
                  </h2>

                  <p className="text-muted-foreground mb-4">
                    We integrate with the following third-party services to provide our platform:
                  </p>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <h4 className="font-semibold mb-1">Razorpay</h4>
                      <p className="text-sm text-muted-foreground">Secure payment processing for subscriptions</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <h4 className="font-semibold mb-1">Cloud Infrastructure</h4>
                      <p className="text-sm text-muted-foreground">Secure database and file storage</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <h4 className="font-semibold mb-1">Google (OAuth)</h4>
                      <p className="text-sm text-muted-foreground">Optional sign-in with Google account</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <h4 className="font-semibold mb-1">AI Services</h4>
                      <p className="text-sm text-muted-foreground">Powering Xrozen AI Mini features</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mt-4">
                    These services have their own privacy policies. We only share necessary data for functionality.
                  </p>
                </section>

                <Separator />

                {/* Section 4 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">4</span>
                    Data Security
                  </h2>

                  <div className="p-4 rounded-lg bg-success/10 border border-success/20 mb-4">
                    <p className="text-sm font-medium text-success">
                      🔒 Your data is encrypted in transit and at rest using industry-standard encryption.
                    </p>
                  </div>

                  <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                    <li>SSL/TLS encryption for all data transfers</li>
                    <li>Secure authentication with optional 2FA</li>
                    <li>Regular security audits and updates</li>
                    <li>Access controls and permission management</li>
                    <li>Secure cloud infrastructure</li>
                  </ul>
                </section>

                <Separator />

                {/* Section 5 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">5</span>
                    Data Retention
                  </h2>

                  <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                    <li>Account data is retained while your account is active</li>
                    <li>Project data is stored until you delete it or close your account</li>
                    <li>Payment records are kept for 7 years for legal compliance</li>
                    <li>You can request data deletion at any time</li>
                    <li>Deleted data may persist in backups for up to 30 days</li>
                  </ul>
                </section>

                <Separator />

                {/* Section 6 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">6</span>
                    Your Rights
                  </h2>

                  <p className="text-muted-foreground mb-4">You have the following rights regarding your data:</p>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <span className="text-success">✓</span>
                      <span className="text-sm">Access your personal data</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <span className="text-success">✓</span>
                      <span className="text-sm">Correct inaccurate data</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <span className="text-success">✓</span>
                      <span className="text-sm">Delete your account and data</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <span className="text-success">✓</span>
                      <span className="text-sm">Export your data</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <span className="text-success">✓</span>
                      <span className="text-sm">Opt-out of marketing emails</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <span className="text-success">✓</span>
                      <span className="text-sm">Disable 2FA anytime</span>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Section 7 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">7</span>
                    Cookies & Tracking
                  </h2>

                  <p className="text-muted-foreground mb-4">
                    We use cookies and similar technologies for:
                  </p>

                  <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                    <li><strong>Essential cookies:</strong> Authentication and session management</li>
                    <li><strong>Preference cookies:</strong> Remembering your settings (theme, language)</li>
                    <li><strong>Analytics:</strong> Understanding how you use our platform</li>
                  </ul>

                  <p className="text-sm text-muted-foreground mt-4">
                    You can manage cookie preferences in your browser settings.
                  </p>
                </section>

                <Separator />

                {/* Section 8 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">8</span>
                    Contact Us
                  </h2>

                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-muted-foreground mb-3">
                      For privacy-related questions or to exercise your rights:
                    </p>
                    <div className="space-y-2">
                      <p>
                        <strong>Email:</strong>{" "}
                        <a href="mailto:support@xrozen.com" className="text-primary hover:underline">
                          support@xrozen.com
                        </a>
                      </p>
                      <p>
                        <strong>Website:</strong>{" "}
                        <a href="https://xrozen.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          xrozen.com
                        </a>
                      </p>
                    </div>
                  </div>
                </section>

                {/* Updates Notice */}
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                  <p className="text-sm text-muted-foreground">
                    <strong>Policy Updates:</strong> We may update this Privacy Policy periodically.
                    Significant changes will be notified via email or in-app notification.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
