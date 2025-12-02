import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function CookiePolicy() {
  const navigate = useNavigate();
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const sections = [
    {
      title: "What Are Cookies?",
      paragraphs: [
        "Cookies are small text files stored on your device by websites you visit. They help websites remember information about your visit, such as preferences, login status, and analytics usage.",
      ],
    },
    {
      title: "Types of Cookies We Use",
      paragraphs: [
        "Necessary\nRequired for core functionality, such as authentication and security. These cannot be disabled.",
        "Analytics\nHelp us understand how the application is used so we can improve performance and reliability.",
        "Functional\nRemember preferences (like theme) and provide enhanced features for a better experience.",
        "Marketing\nUsed to deliver relevant content. We currently do not use third-party marketing cookies.",
      ],
    },
    {
      title: "How We Use Cookies",
      paragraphs: [
        "Maintain user sessions and secure access",
        "Track audit events and system activity",
        "Measure usage to improve features and performance",
        "Remember interface preferences (such as theme)",
      ],
    },
    {
      title: "Managing Cookie Preferences",
      paragraphs: [
        "You can update your cookie preferences at any time by using the Manage Cookie Preferences link in the footer of the landing page. You can also control cookies via your browser settings.",
      ],
    },
    {
      title: "Contact",
      paragraphs: [
        "For questions about this cookie policy, contact us at support@example.com.",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">Cookie Policy</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-6">Last updated: {lastUpdated}</p>

        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.title} className="shadow-sm">
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
                <CardDescription></CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {section.paragraphs.map((p, idx) => (
                  <p key={idx} className="text-muted-foreground leading-relaxed whitespace-pre-line">{p}</p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        <Button
          variant="secondary"
          className="fixed bottom-6 right-6"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          Top
        </Button>
      </div>
    </div>
  );
}

