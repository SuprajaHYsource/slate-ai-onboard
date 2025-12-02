import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TermsAndConditions() {
  const navigate = useNavigate();
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const sections = [
    {
      title: "User Responsibilities",
      paragraphs: [
        "By using this platform, you agree to provide accurate information, maintain the confidentiality of your account credentials, and comply with all applicable laws and regulations. You are responsible for any activity conducted through your account and for adhering to community standards of respectful and lawful behavior.",
      ],
    },
    {
      title: "Acceptable Use of the Platform",
      paragraphs: [
        "You may not misuse the platform or attempt to interfere with its proper operation. Prohibited activities include unauthorized access, data scraping, distribution of malware, harassing or abusive conduct, and any actions that violate privacy or intellectual property rights.",
        "We reserve the right to monitor usage for security and compliance purposes and to take appropriate action if suspicious or harmful behavior is detected.",
      ],
    },
    {
      title: "Intellectual Property Rules",
      paragraphs: [
        "All content, trademarks, and intellectual property associated with this platform are owned by us or our licensors. You may use the platform for its intended purpose and within the scope of granted permissions. You may not reproduce, modify, distribute, or create derivative works without explicit written consent.",
      ],
    },
    {
      title: "Service Availability Disclaimer",
      paragraphs: [
        "While we strive for high availability and reliability, the service may experience occasional downtime due to maintenance, updates, or unforeseen incidents. We will take reasonable steps to minimize disruptions and communicate material service interruptions when possible.",
      ],
    },
    {
      title: "Limitation of Liability",
      paragraphs: [
        "To the fullest extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from your use of the platform. Our total liability for any claim will not exceed the amount you paid (if any) to access the service during the preceding 12 months.",
      ],
    },
    {
      title: "Termination of Access",
      paragraphs: [
        "We may suspend or terminate your access if you violate these Terms & Conditions, engage in unlawful activity, or pose a risk to the security or integrity of the platform. You may also terminate your use at any time by discontinuing access and, where applicable, closing your account.",
      ],
    },
    {
      title: "Governing Law",
      paragraphs: [
        "These Terms & Conditions are governed by the laws of the jurisdiction in which our company is established, without regard to its conflict of law provisions. Any disputes will be resolved in the competent courts of that jurisdiction.",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">Terms & Conditions</h1>
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
                  <p key={idx} className="text-muted-foreground leading-relaxed">{p}</p>
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

