import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Crown, Users, Video, Zap, Loader2 } from "lucide-react";
import { usePlans, SubscriptionPlan } from "@/hooks/usePlans";

const Pricing = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("editor");
  const [isAnnual, setIsAnnual] = useState(false);
  const { plans, loading, error } = usePlans();

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

  // Get plans for a category filtered by billing period
  const getPlansForCategory = (category: string) => {
    const billingPeriod = isAnnual ? 'annual' : 'monthly';
    return plans
      .filter(plan =>
        plan.category === category &&
        plan.billing_period === billingPeriod &&
        plan.is_active
      )
      .sort((a, b) => a.price - b.price);
  };

  // Format price with commas
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN').format(price);
  };

  // Determine if a plan is popular (pro tier)
  const isPlanPopular = (plan: SubscriptionPlan) => {
    return plan.tier === 'pro';
  };

  // Get price display
  const getPriceDisplay = (plan: SubscriptionPlan) => {
    const monthlyPlans = plans.filter(
      p => p.category === plan.category && p.tier === plan.tier && p.billing_period === 'monthly'
    );

    if (isAnnual && plan.annual_discount_percentage && plan.annual_discount_percentage > 0) {
      const monthlyPlan = monthlyPlans[0];
      if (monthlyPlan) {
        const originalYearlyPrice = monthlyPlan.price * 12;
        return {
          currentPrice: plan.price,
          originalPrice: originalYearlyPrice,
          discount: plan.annual_discount_percentage,
          perMonth: Math.round(plan.price / 12)
        };
      }
    }

    return {
      currentPrice: plan.price,
      originalPrice: null,
      discount: null,
      perMonth: isAnnual ? Math.round(plan.price / 12) : plan.price
    };
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white dark">
      <Header />

      <div className="bg-zinc-950">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 lg:py-28">
          <div className="text-center max-w-4xl mx-auto">
            <Crown className="w-16 h-16 text-primary mx-auto mb-6 animate-pulse" />
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
              Choose your category and pick the plan that fits your workflow.
              All plans include a free trial with just ₹1 activation fee.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Badge variant="outline" className="text-base py-2 px-4">
                <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                Free trial included
              </Badge>
              <Badge variant="outline" className="text-base py-2 px-4">
                <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                ₹1 activation fee
              </Badge>
              <Badge variant="outline" className="text-base py-2 px-4">
                <CheckCircle2 className="w-4 h-4 mr-2 text-success" />
                Cancel anytime
              </Badge>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mt-10">
              <Label htmlFor="billing-toggle" className={`text-lg ${!isAnnual ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                Monthly
              </Label>
              <Switch
                id="billing-toggle"
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
                className="data-[state=checked]:bg-success"
              />
              <Label htmlFor="billing-toggle" className={`text-lg ${isAnnual ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                Annual
              </Label>
              {isAnnual && (
                <Badge className="bg-success text-success-foreground ml-2">
                  Save up to 20%
                </Badge>
              )}
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

            {/* Loading State */}
            {loading && (
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="shadow-elegant">
                    <CardHeader className="text-center pb-4">
                      <Skeleton className="h-8 w-24 mx-auto mb-2" />
                      <Skeleton className="h-4 w-48 mx-auto" />
                      <Skeleton className="h-12 w-32 mx-auto mt-4" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5, 6].map((j) => (
                          <Skeleton key={j} className="h-4 w-full" />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="mt-12 text-center">
                <p className="text-destructive">Failed to load plans. Please refresh the page.</p>
              </div>
            )}

            {/* Plans Display */}
            {!loading && !error && categories.map((category) => (
              <TabsContent key={category.id} value={category.id} className="mt-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {getPlansForCategory(category.id).map((plan, index) => {
                    const priceInfo = getPriceDisplay(plan);
                    const isPopular = isPlanPopular(plan);

                    return (
                      <Card
                        key={plan.id}
                        className={`relative shadow-elegant hover:shadow-glow transition-smooth border-2 ${isPopular ? 'border-primary scale-105' : 'border-border'
                          }`}
                      >
                        {isPopular && (
                          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                            <Badge className="bg-success shadow-glow px-4 py-1">
                              ⭐ Most Popular
                            </Badge>
                          </div>
                        )}

                        <CardHeader className="text-center pb-4">
                          <CardTitle className="text-3xl mb-2">
                            {plan.name.replace(/ \(Annual\)$/, '')}
                          </CardTitle>
                          <CardDescription className="text-sm mb-4">
                            {plan.description || `Perfect for ${plan.tier} users`}
                          </CardDescription>

                          <div className="mt-4">
                            {priceInfo.discount && priceInfo.originalPrice && (
                              <div className="mb-1">
                                <span className="text-lg text-muted-foreground line-through">
                                  ₹{formatPrice(priceInfo.originalPrice)}
                                </span>
                                <Badge className="ml-2 bg-success text-xs">
                                  {priceInfo.discount}% OFF
                                </Badge>
                              </div>
                            )}
                            <span className="text-5xl font-bold text-primary">
                              ₹{formatPrice(priceInfo.currentPrice)}
                            </span>
                            <span className="text-muted-foreground text-lg">
                              /{isAnnual ? 'year' : 'month'}
                            </span>
                            {isAnnual && (
                              <p className="text-sm text-muted-foreground mt-1">
                                ≈ ₹{formatPrice(priceInfo.perMonth)}/month
                              </p>
                            )}
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
                            className={`w-full ${isPopular ? 'gradient-primary shadow-glow' : 'gradient-success'}`}
                            size="lg"
                            onClick={() => navigate("/auth")}
                          >
                            Start Free Trial
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* No plans message */}
                {getPlansForCategory(category.id).length === 0 && !loading && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      No {isAnnual ? 'annual' : 'monthly'} plans available for {category.name} category.
                    </p>
                  </div>
                )}
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
                    After your trial ends, you'll be automatically charged for your
                    selected plan. You can cancel anytime during the trial with no charges.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="text-lg">Can I switch between monthly and annual?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Yes! You can switch from monthly to annual billing anytime and
                    save up to 20%. Annual subscriptions are billed once per year.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="text-lg">Are there any hidden fees?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    No hidden fees! You only pay the subscription price.
                    The ₹1 activation fee is one-time and non-refundable.
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-elegant">
                <CardHeader>
                  <CardTitle className="text-lg">Do you offer refunds?</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    We offer refunds within 14 days of your first annual payment.
                    No refunds for monthly subscriptions or partial billing periods.
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
