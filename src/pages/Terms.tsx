import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { FileText } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 bg-gradient-to-br from-background via-primary/5 to-success/5">
        <div className="container mx-auto px-4 py-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <FileText className="w-16 h-16 text-primary mx-auto mb-6" />
              <h1 className="text-5xl font-bold mb-4">Terms & Conditions</h1>
              <p className="text-muted-foreground">Last updated: January 2025</p>
            </div>

            <div className="prose prose-lg max-w-none space-y-8">
              <section>
                <h2 className="text-2xl font-bold mb-4">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing and using Xrozen Workflow, you accept and agree to be bound by these Terms 
                  and Conditions. If you do not agree to these terms, please do not use our service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">2. Service Description</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Xrozen Workflow is a video editing project management platform that provides tools for 
                  project management, client collaboration, version control, invoicing, and AI-powered 
                  features. We reserve the right to modify or discontinue features at any time.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">3. User Accounts</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  To use our service, you must:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Create an account with accurate information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Be at least 18 years old</li>
                  <li>Not share your account with others</li>
                  <li>Notify us immediately of any unauthorized access</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">4. Subscription and Payment</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Our subscription terms include:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>1-month free trial with ₹2 activation fee</li>
                  <li>Automatic billing after trial period</li>
                  <li>Monthly or annual payment options</li>
                  <li>Ability to cancel anytime</li>
                  <li>No refunds for partial billing periods</li>
                  <li>Price changes will be notified 30 days in advance</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-bold mb-4">5. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  For questions about these Terms & Conditions, contact us at: 
                  <a href="mailto:legal@xrozen.com" className="text-primary hover:underline ml-1">
                    legal@xrozen.com
                  </a>
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Terms;
