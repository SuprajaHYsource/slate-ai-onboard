import { Shield, Zap, TrendingUp, Lock } from "lucide-react";

const reasons = [
  {
    icon: Shield,
    title: "Secure",
    description: "Enterprise-grade security with end-to-end encryption and compliance standards.",
  },
  {
    icon: Zap,
    title: "Scalable",
    description: "Built to grow with your business, from startups to enterprise organizations.",
  },
  {
    icon: TrendingUp,
    title: "AI-First Platform",
    description: "Leverage cutting-edge AI to automate workflows and boost productivity.",
  },
  {
    icon: Lock,
    title: "Enterprise-Grade Architecture",
    description: "Robust infrastructure designed for reliability, performance, and security.",
  },
];

const WhyHinfinity = () => {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container px-4 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Why Choose{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Hinfinity
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            Built by experts, trusted by enterprises
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
          {reasons.map((reason, index) => {
            const Icon = reason.icon;
            return (
              <div
                key={index}
                className="text-center group hover:scale-105 transition-transform duration-300"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center glow-primary group-hover:glow-accent transition-all">
                  <Icon className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">{reason.title}</h3>
                <p className="text-muted-foreground">{reason.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyHinfinity;
