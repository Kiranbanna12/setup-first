import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Video, BarChart3, MessageSquare, Zap, Users, CheckCircle2, ArrowRight, Brain, DollarSign, Clock, GitBranch, Eye } from "lucide-react";
import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Video,
      title: "Advanced Project Management",
      description: "Create unlimited projects with sub-projects, assign multiple editors and clients, and track every detail in one centralized dashboard."
    },
    {
      icon: GitBranch,
      title: "Version Control System",
      description: "Upload multiple video versions per project with preview links and final links. Track all revisions with complete version history and timestamps."
    },
    {
      icon: Eye,
      title: "Client Preview & Approval",
      description: "Clients can preview videos directly in-platform, approve final versions with one click, or request corrections with detailed feedback boxes."
    },
    {
      icon: MessageSquare,
      title: "Real-time Collaboration",
      description: "WhatsApp-style individual and project-wise group chats. File sharing, read receipts, typing indicators, and complete message history."
    },
    {
      icon: Brain,
      title: "XrozenAI Assistant",
      description: "Context-aware AI that queries your database, creates projects, formats client feedback into spreadsheets, and automates workflow tasks."
    },
    {
      icon: DollarSign,
      title: "Invoice & Payment System",
      description: "Auto-generate invoices with project details, track payments (pending/paid/overdue), send invoices via email, and export as PDF. Freelance or full-time modes."
    },
    {
      icon: BarChart3,
      title: "Comprehensive Analytics",
      description: "Beautiful Chart.js visualizations for project status, payment breakdowns, editor productivity, revenue forecasting, and client satisfaction ratings."
    },
    {
      icon: Users,
      title: "Team Management",
      description: "Agency plans with multi-user support. Add editors and clients to your team, assign project access, set permissions, and manage centralized billing."
    },
    {
      icon: Clock,
      title: "Deadline Tracking",
      description: "Set project deadlines, receive automated reminders, track upcoming milestones, and view detailed worksheets for editors and clients."
    }
  ];

  const plans = [
    {
      name: "Editor Basic",
      price: "₹999",
      category: "Editor",
      features: ["5 Active Projects", "Basic Project Management", "Video Version Control", "1GB Storage"]
    },
    {
      name: "Editor Pro",
      price: "₹2,499",
      category: "Editor",
      features: ["25 Active Projects", "Advanced Analytics", "XrozenAI Assistant", "10GB Storage", "Priority Support"],
      popular: true
    },
    {
      name: "Agency Premium",
      price: "₹12,999",
      category: "Agency",
      features: ["Unlimited Projects", "Unlimited Team Members", "White-label Platform", "500GB Storage", "24/7 Support", "API Access"]
    }
  ];

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="bg-gradient-to-br from-background via-primary/5 to-success/5">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 lg:py-28">
          <div className="text-center max-w-5xl mx-auto">
            <Video className="w-20 h-20 text-primary mx-auto mb-8 animate-pulse" />
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 text-foreground leading-tight">
              Xrozen Workflow
            </h1>
            <p className="text-2xl md:text-3xl font-semibold mb-6 text-foreground">
              Professional Video Editing Project Management
            </p>
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
              Complete platform for video editors, clients, and agencies. Manage projects with version control, 
              collaborate in real-time, automate invoicing, and leverage AI-powered workflow automation—all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="gradient-primary shadow-elegant hover:shadow-glow transition-smooth text-lg px-8"
                onClick={() => navigate("/auth")}
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="text-lg px-8"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-8 flex items-center justify-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-success" />
                1-month free trial
              </span>
              <span className="text-muted-foreground/50">•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-success" />
                ₹2 activation fee
              </span>
              <span className="text-muted-foreground/50">•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Cancel anytime
              </span>
            </p>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="container mx-auto px-4 py-20 lg:py-28">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Complete Feature Suite</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Everything you need to manage video editing projects professionally—from version control 
              to AI automation, payments to team collaboration
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={index}
                  className="group bg-card p-8 rounded-2xl shadow-elegant hover:shadow-glow transition-smooth border border-border hover:border-primary/30"
                >
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pricing Preview Section */}
        <section id="pricing" className="container mx-auto px-4 py-20 lg:py-28">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Choose from 3 categories (Editor, Client, Agency) with 3 plans each (Basic, Pro, Premium).
              All plans include full features during your 1-month free trial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <div 
                key={index}
                className={`bg-card p-8 rounded-2xl shadow-elegant border-2 transition-smooth hover:shadow-glow hover:scale-105 ${
                  plan.popular ? 'border-primary' : 'border-border'
                }`}
              >
                {plan.popular && (
                  <div className="bg-success text-success-foreground text-sm font-semibold px-4 py-2 rounded-full inline-block mb-4">
                    ⭐ Most Popular
                  </div>
                )}
                <div className="text-xs font-semibold text-primary mb-2">{plan.category}</div>
                <h3 className="text-3xl font-bold mb-3 text-foreground">{plan.name}</h3>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-primary">{plan.price}</span>
                  <span className="text-muted-foreground text-lg">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button 
                  className={`w-full ${plan.popular ? 'gradient-success shadow-glow' : 'gradient-primary'}`}
                  size="lg"
                  onClick={() => navigate("/auth")}
                >
                  Start Free Trial
                </Button>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button 
              size="lg" 
              variant="outline"
              className="text-lg px-8"
              onClick={() => navigate("/pricing")}
            >
              View All Plans & Categories
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>

          <p className="text-center text-muted-foreground mt-12 max-w-3xl mx-auto text-lg leading-relaxed">
            All plans include a <strong className="text-foreground">1-month free trial</strong> with full access to every feature. 
            Only a one-time <strong className="text-foreground">₹2 activation fee</strong> to get started. 
            Cancel anytime before trial ends with no charges.
          </p>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20 lg:py-28">
          <div className="bg-card rounded-3xl shadow-elegant p-12 lg:p-16 text-center max-w-5xl mx-auto border-2 border-primary/20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">Ready to Transform Your Workflow?</h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Join thousands of video editors and agencies using Xrozen Workflow to streamline their projects, 
              collaborate with clients, and grow their business
            </p>
            <Button 
              size="lg" 
              className="gradient-primary shadow-glow text-lg px-12 py-6 h-auto"
              onClick={() => navigate("/auth")}
            >
              Get Started Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <p className="text-sm text-muted-foreground mt-6">
              No credit card required • Start your free trial in seconds
            </p>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
