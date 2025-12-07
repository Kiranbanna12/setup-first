import { Header } from "@/components/shared/Header";
import { Footer } from "@/components/shared/Footer";
import { Video, Users, Target, Zap, Award, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";

const About = () => {
  const values = [
    {
      icon: Target,
      title: "Mission Driven",
      description: "Simplifying video editing workflows for professionals worldwide"
    },
    {
      icon: Users,
      title: "Customer First",
      description: "Building tools that editors and clients actually want to use"
    },
    {
      icon: Zap,
      title: "Innovation",
      description: "Leveraging cutting-edge AI to automate and enhance productivity"
    },
    {
      icon: Award,
      title: "Quality",
      description: "Delivering enterprise-grade reliability and performance"
    },
    {
      icon: Heart,
      title: "Community",
      description: "Supporting the creative community with accessible tools"
    }
  ];

  const team = [
    {
      name: "Video Editors",
      count: "10,000+",
      description: "Professional editors managing their projects"
    },
    {
      name: "Clients",
      count: "5,000+",
      description: "Businesses trusting our platform"
    },
    {
      name: "Projects",
      count: "50,000+",
      description: "Video projects delivered successfully"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 text-center">
          <Video className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-5xl md:text-6xl font-bold mb-6">About Xrozen Workflow</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            We're on a mission to revolutionize how video editors collaborate with clients, 
            manage projects, and grow their business. Built by editors, for editors.
          </p>
        </section>

        {/* Story Section */}
        <section className="bg-muted/50 py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-3xl font-bold mb-6 text-center">Our Story</h2>
              <div className="prose prose-lg mx-auto text-muted-foreground">
                <p className="text-lg leading-relaxed mb-4">
                  Xrozen Workflow was born from a simple frustration: managing video editing 
                  projects was unnecessarily complicated. Multiple tools, scattered feedback, 
                  endless email chains, and payment tracking chaos.
                </p>
                <p className="text-lg leading-relaxed mb-4">
                  As professional video editors ourselves, we knew there had to be a better way. 
                  So we built Xrozen Workflow - a single platform that brings together project 
                  management, client collaboration, version control, invoicing, and AI-powered 
                  automation.
                </p>
                <p className="text-lg leading-relaxed">
                  Today, thousands of editors and agencies trust Xrozen Workflow to streamline 
                  their operations, deliver better results, and scale their business.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="container mx-auto px-4 py-20">
          <h2 className="text-4xl font-bold mb-12 text-center">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card key={index} className="p-6 shadow-elegant hover:shadow-glow transition-smooth border border-border">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">{value.title}</h3>
                  <p className="text-muted-foreground">{value.description}</p>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Stats Section */}
        <section className="bg-gradient-to-br from-primary/10 via-background to-success/10 py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold mb-12 text-center">Join Our Community</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {team.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-5xl font-bold text-primary mb-2">
                    {stat.count}
                  </div>
                  <div className="text-xl font-semibold mb-2 text-foreground">{stat.name}</div>
                  <p className="text-muted-foreground">{stat.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default About;
