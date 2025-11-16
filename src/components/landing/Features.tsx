import { Users, Clock, Calendar, Briefcase, Brain, Shield } from "lucide-react";
import { Card } from "@/components/ui/card";

const features = [
  {
    icon: Users,
    title: "HR Lifecycle Automation",
    description: "Streamline employee onboarding, management, and offboarding with intelligent automation.",
  },
  {
    icon: Clock,
    title: "Attendance & Timesheet",
    description: "Track work hours accurately with automated attendance and comprehensive timesheet management.",
  },
  {
    icon: Calendar,
    title: "Leave Management",
    description: "Seamless leave requests with Google/Microsoft Calendar synchronization for perfect planning.",
  },
  {
    icon: Briefcase,
    title: "Agile Projects & Sprints",
    description: "Manage projects with agile methodologies, sprint planning, and real-time collaboration.",
  },
  {
    icon: Brain,
    title: "AI Predictions & Task Breakdown",
    description: "Leverage AI to predict project timelines and automatically break down complex tasks.",
  },
  {
    icon: Shield,
    title: "Secure RBAC",
    description: "Enterprise-grade security with role-based access control to protect sensitive data.",
  },
];

const Features = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Powerful Features for{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Modern Teams
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Everything you need to manage your workforce and projects efficiently
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card
                key={index}
                className="p-6 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50 bg-card group"
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
