import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Crown, Users, Video, Zap } from "lucide-react";

const Pricing = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("editor");

  const categories = [
    {
      id: "editor",
      name: "Editor",
      icon: Video,
      description: "For individual video editors"
    },
    {
      id: "client",
      name: "Client",
      icon: Users,
      description: "For clients managing projects"
    },
    {
      id: "agency",
      name: "Agency",
      icon: Zap,
      description: "For teams and agencies"
    }
  ];

  const plans = {
    editor: [
      {
        name: "Basic",
        price: "₹999",
        description: "Perfect for freelance editors starting out",
        features: [
          "5 Active Projects",
          "Basic Project Management",
          "Video Version Control",
          "Client Collaboration Tools",
          "Basic Analytics Dashboard",
          "Email Support",
          "1GB Storage",
          "Invoice Generation"
        ],
        popular: false
      },
      {
        name: "Pro",
        price: "₹2,499",
        description: "Ideal for professional editors",
        features: [
          "25 Active Projects",
          "Advanced Project Management",
          "Unlimited Video Versions",
          "Real-time Chat & Collaboration",
          "Advanced Analytics & Reports",
          "Priority Support",
          "10GB Storage",
          "Automated Invoicing",
          "XrozenAI Assistant Access",
          "Sub-project Management"
        ],
        popular: true
      },
      {
        name: "Premium",
        price: "₹4,999",
        description: "For power users and professionals",
        features: [
          "Unlimited Projects",
          "Complete Project Suite",
          "Unlimited Storage (100GB)",
          "Team Collaboration Tools",
          "Full Analytics Suite",
          "24/7 Priority Support",
          "Advanced XrozenAI Features",
          "White-label Reports",
          "API Access",
          "Custom Integrations",
          "Dedicated Account Manager"
        ],
        popular: false
      }
    ],
    client: [
      {
        name: "Basic",
        price: "₹999",
        description: "For clients with occasional projects",
        features: [
          "5 Active Projects",
          "Video Review & Approval",
          "Feedback & Corrections",
          "Basic Communication Tools",
          "Payment Tracking",
          "Email Support",
          "1GB Storage",
          "Invoice Management"
        ],
        popular: false
      },
      {
        name: "Pro",
        price: "₹2,499",
        description: "Best for regular collaboration",
        features: [
          "25 Active Projects",
          "Advanced Review System",
          "Multi-editor Management",
          "Real-time Chat",
          "Project Analytics",
          "Priority Support",
          "10GB Storage",
          "Payment Automation",
          "XrozenAI Query Access",
          "Bulk Approvals"
        ],
        popular: true
      },
      {
        name: "Premium",
        price: "₹4,999",
        description: "Enterprise-grade client management",
        features: [
          "Unlimited Projects",
          "Complete Review Workflow",
          "Team Management",
          "Unlimited Storage (100GB)",
          "Full Analytics Dashboard",
          "24/7 Support",
          "Advanced XrozenAI",
          "Custom Workflows",
          "API Integration",
          "Multi-brand Management",
          "Dedicated Support"
        ],
        popular: false
      }
    ],
    agency: [
      {
        name: "Basic",
        price: "₹2,499",
        description: "Small teams starting out",
        features: [
          "10 Active Projects",
          "3 Team Members",
          "All Editor Features",
          "All Client Features",
          "Team Management",
          "Centralized Billing",
          "Email Support",
          "5GB Storage",
          "Basic Team Analytics"
        ],
        popular: false
      },
      {
        name: "Pro",
        price: "₹5,999",
        description: "Growing agencies and teams",
        features: [
          "50 Active Projects",
          "10 Team Members",
          "All Editor Pro Features",
          "All Client Pro Features",
          "Advanced Team Tools",
          "Project Assignment",
          "Priority Support",
          "25GB Storage",
          "Team Performance Analytics",
          "XrozenAI for All Members",
          "Custom Branding"
        ],
        popular: true
      },
      {
        name: "Premium",
        price: "₹12,999",
        description: "Enterprise agencies and large teams",
        features: [
          "Unlimited Projects",
          "Unlimited Team Members",
          "All Premium Features",
          "White-label Platform",
          "Unlimited Storage (500GB)",
          "Dedicated Account Manager",
          "24/7 Premium Support",
          "Custom Workflows",
          "API & Webhooks",
          "Advanced Security",
          "Custom Integrations",
          "SLA Guarantee"
        ],
        popular: false
      }
    ]
  };

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="bg-gradient-to-br from-background via-primary/5 to-success/5">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 lg:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <Crown className="w-16 h-16 text-primary mx-auto mb-6 animate-pulse" />
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
              Choose your category and pick the plan that fits your workflow. 
              All plans include a 1-month free trial with just ₹2 activation fee.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Badge variant="outline" className="text-base py-2 px-4">
                <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                1-month free trial
              </Badge>
              <Badge variant="outline" className="text-base py-2 px-4">
                <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                ₹2 activation fee
              </Badge>
              <Badge variant="outline" className="text-base py-2 px-4">
                <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                Cancel anytime
              </Badge>
            </div>
          </div>
        </section>

        {/* Category Selector */}
        <section className="container mx-auto px-4 pb-12">
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="max-w-7xl mx-auto">
            <TabsList className="grid w-full grid-cols-3 h-auto p-2 bg-card shadow-elegant">
              {categories.map((category) => {
                const Icon = category.icon;
                return (
                  <TabsTrigger 
                    key={category.id} 
                    value={category.id}
                    className="flex flex-col items-center gap-2 py-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Icon className="w-6 h-6" />
                    <div>
                      <div className="font-bold text-base">{category.name}</div>
                      <div className="text-xs opacity-80 hidden md:block">{category.description}</div>
                    </div>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {categories.map((category) => (
              <TabsContent key={category.id} value={category.id} className="mt-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {plans[category.id as keyof typeof plans].map((plan, index) => (
                    <Card 
                      key={index}
                      className={`relative shadow-elegant hover:shadow-glow transition-smooth border-2 ${
                        plan.popular ? 'border-primary scale-105' : 'border-border'
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                          <Badge className="bg-success shadow-glow px-4 py-1">
                            ⭐ Most Popular
                          </Badge>
                        </div>
                      )}
                      
                      <CardHeader className="text-center pb-4">
                        <CardTitle className="text-3xl mb-2">{plan.name}</CardTitle>
                        <CardDescription className="text-sm mb-4">
                          {plan.description}
                        </CardDescription>
                        <div className="mt-4">
                          <span className="text-5xl font-bold text-primary">{plan.price}</span>
                          <span className="text-muted-foreground text-lg">/month</span>
                        </div>
                      </CardHeader>

                      <CardContent>
                        <ul className="space-y-3 mb-8">
                          {plan.features.map((feature, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <Button 
                          className={`w-full ${plan.popular ? 'gradient-primary shadow-glow' : 'gradient-success'}`}
                          size="lg"
                          onClick={() => navigate("/auth")}
                        >
                          Start Free Trial
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </section>

        {/* FAQ Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
              Frequently Asked Questions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="text-lg">Can I switch plans anytime?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Yes! You can upgrade or downgrade your plan at any time. 
                    Changes are prorated and reflected in your next billing cycle.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="text-lg">What happens after the free trial?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    After your 1-month trial ends, you'll be automatically charged for your 
                    selected plan. You can cancel anytime during the trial with no charges.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="text-lg">Can I use multiple categories?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Agency plans include both Editor and Client features. For individual 
                    accounts, you can only select one category at a time.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="text-lg">Are there any hidden fees?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    No hidden fees! You only pay the monthly subscription price. 
                    The ₹2 activation fee is one-time and non-refundable.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="text-lg">Do you offer refunds?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    We offer full refunds within 7 days of your first payment. 
                    No refunds for partial billing periods after that.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="text-lg">Need a custom plan?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    For enterprises or special requirements, contact our sales team 
                    for custom pricing and features tailored to your needs.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="bg-card rounded-3xl shadow-elegant p-12 text-center max-w-4xl mx-auto border-2 border-primary/20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Start your free trial today. No credit card required.
            </p>
            <Button 
              size="lg" 
              className="gradient-primary shadow-glow text-lg px-12 py-6 h-auto"
              onClick={() => navigate("/auth")}
            >
              Start Free Trial Now
            </Button>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default Pricing;
