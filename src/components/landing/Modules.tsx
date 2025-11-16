import { Card } from "@/components/ui/card";
import { UserCog, Clock, FileText, LayoutDashboard, Bot, Plug } from "lucide-react";

const modules = [
  {
    icon: UserCog,
    title: "HR Module",
    description: "Complete employee lifecycle management",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Clock,
    title: "Attendance",
    description: "Real-time attendance tracking",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: FileText,
    title: "Timesheets",
    description: "Accurate time logging and reporting",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: LayoutDashboard,
    title: "Project Board",
    description: "Visual project management",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: Bot,
    title: "AI Assistant",
    description: "Intelligent task automation",
    color: "from-indigo-500 to-blue-500",
  },
  {
    icon: Plug,
    title: "Integrations",
    description: "Connect your favorite tools",
    color: "from-teal-500 to-cyan-500",
  },
];

const Modules = () => {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Comprehensive{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Module Suite
            </span>
          </h2>
          <p className="text-xl text-muted-foreground">
            All the tools you need in one unified platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module, index) => {
            const Icon = module.icon;
            return (
              <Card
                key={index}
                className="relative overflow-hidden p-8 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 hover:border-primary/50 bg-card group"
              >
                <div
                  className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br ${module.color}`}
                />
                <div className="relative">
                  <div
                    className={`w-16 h-16 rounded-xl bg-gradient-to-br ${module.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{module.title}</h3>
                  <p className="text-muted-foreground">{module.description}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Modules;
