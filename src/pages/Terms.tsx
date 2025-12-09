import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { FileText, AlertTriangle, CreditCard, Users, Shield, Scale, XCircle, RefreshCcw, Bot, FileVideo, MessageSquare, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white dark">
      <Header />

      <main className="flex-1 bg-zinc-950">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
                <FileText className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
              <p className="text-muted-foreground">Last updated: December 2024</p>
              <p className="text-sm text-muted-foreground mt-2">
                Please read these terms carefully before using Xrozen Workflow.
              </p>
            </div>

            <Card className="shadow-xl">
              <CardContent className="p-6 md:p-10 space-y-8">
                {/* Section 1 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">1</span>
                    Agreement to Terms
                  </h2>

                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 mb-4">
                    <p className="text-sm text-muted-foreground">
                      <strong>Important:</strong> By accessing or using Xrozen Workflow, you agree to be bound by these Terms.
                      If you do not agree, please do not use our services.
                    </p>
                  </div>

                  <p className="text-muted-foreground">
                    These Terms of Service ("Terms") govern your access to and use of Xrozen Workflow,
                    a video editing project management platform operated by Xrozen ("we", "us", "our").
                    These Terms apply to all users, including clients, editors, and agency accounts.
                  </p>
                </section>

                <Separator />

                {/* Section 2 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">2</span>
                    Service Description
                  </h2>

                  <p className="text-muted-foreground mb-4">
                    Xrozen Workflow is a comprehensive video editing project management platform that provides:
                  </p>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <FileVideo className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Project Management</p>
                        <p className="text-xs text-muted-foreground">Create, organize, and track video projects</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <RefreshCcw className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Version Control</p>
                        <p className="text-xs text-muted-foreground">Manage multiple video versions with previews</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <Users className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Team Collaboration</p>
                        <p className="text-xs text-muted-foreground">Manage clients and editors with permissions</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Project Chat</p>
                        <p className="text-xs text-muted-foreground">Real-time communication on projects</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <Receipt className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Invoicing & Expenses</p>
                        <p className="text-xs text-muted-foreground">Create invoices and track expenses</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <Bot className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Xrozen AI Mini</p>
                        <p className="text-xs text-muted-foreground">AI-powered project assistance</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mt-4">
                    We reserve the right to modify, suspend, or discontinue any feature at any time with reasonable notice.
                  </p>
                </section>

                <Separator />

                {/* Section 3 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">3</span>
                    User Accounts
                  </h2>

                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Account Creation</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>You must provide accurate and complete registration information</li>
                        <li>You must be at least 18 years old to create an account</li>
                        <li>One person or entity may maintain only one account</li>
                        <li>Business accounts may add team members as permitted by their plan</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Account Security</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>You are responsible for maintaining the confidentiality of your password</li>
                        <li>Enable Two-Factor Authentication (2FA) for enhanced security</li>
                        <li>Notify us immediately of any unauthorized access</li>
                        <li>You are responsible for all activities under your account</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Account Types</h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline">Editor Account</Badge>
                        <Badge variant="outline">Client Account</Badge>
                        <Badge variant="outline">Agency Account</Badge>
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Section 4 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-primary" />
                    <span>4. Subscription & Payments</span>
                  </h2>

                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Free Tier</h3>
                      <p>Limited free access is available with restricted features. Free accounts have project, client, and editor limits.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Paid Plans</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        <li><strong>Trial:</strong> ₹1 trial available for first-time users (14-30 days based on plan)</li>
                        <li><strong>Monthly Plans:</strong> Billed every month until cancelled</li>
                        <li><strong>Annual Plans:</strong> Billed yearly with discounted pricing</li>
                        <li>Plans vary by user type: Editor, Client, or Agency</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Payment Processing</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>Payments are processed securely via <strong>Razorpay</strong></li>
                        <li>Supported methods: UPI, Credit/Debit Cards, Net Banking, Wallets</li>
                        <li>All prices are in Indian Rupees (₹ INR)</li>
                        <li>You authorize recurring charges for subscription plans</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Billing Cycle</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>Subscriptions renew automatically at the end of each billing period</li>
                        <li>You will be notified before renewal</li>
                        <li>Failed payments may result in service suspension</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Section 5 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <XCircle className="w-6 h-6 text-primary" />
                    <span>5. Cancellation & Refunds</span>
                  </h2>

                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Cancellation Policy</h3>
                      <ul className="list-disc pl-6 space-y-1">
                        <li>You may cancel your subscription at any time from your account settings</li>
                        <li>Cancellation takes effect at the end of the current billing period</li>
                        <li>You will retain access to paid features until the period ends</li>
                        <li>You can resume a cancelled subscription before it expires</li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Refund Policy</h3>
                      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                        <ul className="list-disc pl-6 space-y-1 text-sm">
                          <li><strong>Trial payments (₹1):</strong> Non-refundable</li>
                          <li><strong>Monthly subscriptions:</strong> No refunds for partial months</li>
                          <li><strong>Annual subscriptions:</strong> Pro-rated refund available within first 14 days</li>
                          <li>Refunds are processed via the original payment method</li>
                        </ul>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Account Deletion</h3>
                      <p>You may request account deletion. All your data will be permanently removed within 30 days, except for records we are legally required to retain.</p>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Section 6 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">6</span>
                    Acceptable Use
                  </h2>

                  <p className="text-muted-foreground mb-4">You agree NOT to:</p>

                  <div className="grid gap-2">
                    {[
                      "Upload or share illegal, harmful, or copyrighted content without permission",
                      "Use the service for any unlawful purpose",
                      "Attempt to hack, disrupt, or compromise our systems",
                      "Share your account credentials with others",
                      "Resell or redistribute our services without authorization",
                      "Use bots or automation to abuse the platform",
                      "Harass other users or engage in abusive behavior",
                      "Upload malware, viruses, or malicious code",
                      "Circumvent any usage limits or restrictions"
                    ].map((item, index) => (
                      <div key={index} className="flex items-start gap-2 p-2 rounded bg-destructive/5">
                        <XCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-muted-foreground">{item}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-sm text-muted-foreground mt-4">
                    Violation of these terms may result in immediate account suspension or termination.
                  </p>
                </section>

                <Separator />

                {/* Section 7 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">7</span>
                    Intellectual Property
                  </h2>

                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Your Content</h3>
                      <p>You retain all rights to the content you upload (videos, projects, notes, etc.). By uploading content, you grant us a limited license to host, store, and display it as necessary to provide the service.</p>
                    </div>

                    <div>
                      <h3 className="font-semibold text-foreground mb-2">Our Property</h3>
                      <p>Xrozen Workflow, including its design, features, logo, and documentation, is owned by Xrozen. You may not copy, modify, or redistribute our intellectual property.</p>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Section 8 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-warning" />
                    <span>8. Disclaimers & Limitations</span>
                  </h2>

                  <div className="space-y-4 text-muted-foreground">
                    <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                      <p className="text-sm">
                        <strong>Service Provided "As Is":</strong> We provide Xrozen Workflow on an "as is" and "as available" basis without warranties of any kind, either express or implied.
                      </p>
                    </div>

                    <ul className="list-disc pl-6 space-y-2">
                      <li>We do not guarantee uninterrupted or error-free service</li>
                      <li>We are not responsible for data loss due to user error or third-party actions</li>
                      <li>Our liability is limited to the amount you paid us in the last 12 months</li>
                      <li>We are not liable for indirect, incidental, or consequential damages</li>
                    </ul>
                  </div>
                </section>

                <Separator />

                {/* Section 9 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Scale className="w-6 h-6 text-primary" />
                    <span>9. Governing Law & Disputes</span>
                  </h2>

                  <div className="space-y-3 text-muted-foreground">
                    <p>These Terms are governed by the laws of <strong>India</strong>.</p>
                    <p>Any disputes shall be resolved through:</p>
                    <ol className="list-decimal pl-6 space-y-1">
                      <li>Good faith negotiation between parties</li>
                      <li>Mediation if negotiation fails</li>
                      <li>Binding arbitration as a last resort</li>
                    </ol>
                    <p className="text-sm">Jurisdiction for any legal proceedings shall be the courts of India.</p>
                  </div>
                </section>

                <Separator />

                {/* Section 10 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">10</span>
                    Changes to Terms
                  </h2>

                  <p className="text-muted-foreground">
                    We may modify these Terms at any time. Material changes will be notified via email or in-app notification at least 30 days before they take effect. Continued use of the service after changes constitutes acceptance of the new Terms.
                  </p>
                </section>

                <Separator />

                {/* Section 11 */}
                <section>
                  <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary" />
                    <span>11. Contact Information</span>
                  </h2>

                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-muted-foreground mb-3">
                      For questions about these Terms:
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

                {/* Acceptance Notice */}
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-sm text-muted-foreground">
                    <strong>By using Xrozen Workflow, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.</strong>
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

export default Terms;
