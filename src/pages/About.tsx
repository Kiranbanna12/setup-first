import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import {
  Video, Users, Target, Zap, Heart, Sparkles,
  FolderKanban, RefreshCcw, MessageSquare, Receipt,
  Bot, Share2, Bell, FileText, CheckCircle2, ArrowRight
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const About = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: FolderKanban,
      title: "Project Management",
      description: "Organize video projects with custom statuses, deadlines, fees, and notes"
    },
    {
      icon: RefreshCcw,
      title: "Version Control",
      description: "Upload and manage multiple video versions with instant preview links"
    },
    {
      icon: Users,
      title: "Client & Editor Management",
      description: "Track all your clients and editors with individual worksheets and payment records"
    },
    {
      icon: MessageSquare,
      title: "Project Chat",
      description: "Real-time chat for each project - keep all feedback and discussions in one place"
    },
    {
      icon: Receipt,
      title: "Invoicing & Expenses",
      description: "Generate professional invoices and track all project expenses"
    },
    {
      icon: Bot,
      title: "Xrozen AI Mini",
      description: "AI assistant to get instant insights about your projects and workflow"
    },
    {
      icon: Share2,
      title: "Client Sharing",
      description: "Share project previews with clients via secure shareable links"
    },
    {
      icon: Bell,
      title: "Smart Notifications",
      description: "Stay updated with project changes, deadlines, and team activities"
    }
  ];

  const values = [
    {
      icon: Target,
      title: "Built for Real Workflows",
      description: "Every feature designed from actual editor pain points and needs"
    },
    {
      icon: Zap,
      title: "Speed & Simplicity",
      description: "Fast, intuitive interface that doesn't get in your way"
    },
    {
      icon: Heart,
      title: "Editor-First Design",
      description: "We prioritize the needs of video professionals above everything"
    },
    {
      icon: Sparkles,
      title: "Continuous Improvement",
      description: "Regular updates based on user feedback and industry trends"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white dark">
      <Header />

      <main className="flex-1 bg-zinc-950">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 lg:py-28 text-center">
          <Badge className="bg-primary/10 text-primary px-4 py-2 mb-6">
            <Video className="w-4 h-4 mr-2 inline" />
            Video Editing Project Management
          </Badge>

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Made for Editors.
            <br />
            <span className="text-primary">Made by Editors.</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8">
            Xrozen Workflow is a complete project management solution designed specifically
            for video editors, agencies, and their clients. We understand your workflow
            because we've lived it.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button
              size="lg"
              className="gradient-primary shadow-glow"
              onClick={() => navigate("/auth")}
            >
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/pricing")}
            >
              View Pricing
            </Button>
          </div>
        </section>

        {/* Problem & Solution Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center">
                Why We Built Xrozen Workflow
              </h2>

              <Card className="p-8 shadow-elegant mb-8">
                <h3 className="text-xl font-semibold mb-4 text-destructive flex items-center gap-2">
                  😫 The Problem
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  Managing video editing projects is chaos. Tracking revisions in Google Drive,
                  client feedback scattered across WhatsApp and email, payment records in Excel sheets,
                  and no single place to see your project status. Sound familiar?
                </p>
              </Card>

              <Card className="p-8 shadow-elegant border-2 border-success/30">
                <h3 className="text-xl font-semibold mb-4 text-success flex items-center gap-2">
                  ✨ Our Solution
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Xrozen Workflow brings everything into one streamlined platform - projects,
                  versions, clients, chats, invoices, and AI assistance. No more switching
                  between apps. No more lost feedback. No more payment tracking nightmares.
                </p>
                <p className="text-muted-foreground leading-relaxed font-medium">
                  One platform. Complete control. Built by editors who understand your daily struggles.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container mx-auto px-4 py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need in One Place
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Powerful tools designed to streamline your video editing workflow
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="p-6 shadow-elegant hover:shadow-glow transition-smooth border border-border group">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Who It's For */}
        <section className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
              Built For Every Video Professional
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <Card className="p-8 text-center shadow-elegant">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Video className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Freelance Editors</h3>
                <p className="text-muted-foreground">
                  Manage multiple clients, track projects, and get paid on time.
                  No more spreadsheet chaos.
                </p>
              </Card>

              <Card className="p-8 text-center shadow-elegant border-2 border-primary">
                <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Agencies & Teams</h3>
                <p className="text-muted-foreground">
                  Assign projects, manage editors, collaborate with clients -
                  all from one dashboard.
                </p>
              </Card>

              <Card className="p-8 text-center shadow-elegant">
                <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-success" />
                </div>
                <h3 className="text-2xl font-bold mb-3">Content Clients</h3>
                <p className="text-muted-foreground">
                  Review versions, give feedback, approve projects -
                  all without downloading files.
                </p>
              </Card>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="container mx-auto px-4 py-20">
          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center">
            What We Stand For
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <div key={index} className="text-center p-6">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="bg-card rounded-3xl shadow-elegant p-12 text-center max-w-4xl mx-auto border-2 border-primary/20">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Streamline Your Workflow?
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join video editors who are simplifying their project management.
              Start your free trial today.
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Button
                size="lg"
                className="gradient-primary shadow-glow text-lg px-8 py-6 h-auto"
                onClick={() => navigate("/auth")}
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg px-8 py-6 h-auto"
                onClick={() => navigate("/contact")}
              >
                Contact Us
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default About;
