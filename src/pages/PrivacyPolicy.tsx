import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const lastUpdated = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const sections = [
    {
      title: "What Personal Data Is Collected",
      paragraphs: [
        "We collect information you provide during registration and use of the platform, including name, email, and optional profile details such as phone and department. Technical data (such as device type, browser, IP address) may be collected to maintain security and improve performance.",
      ],
    },
    {
      title: "How Data Is Used",
      paragraphs: [
        "We use your data to enable authentication, secure access, and permission management. Aggregated analytics help us understand usage to improve reliability and features. We may personalize the interface (for example, theme preferences) to enhance your experience.",
      ],
    },
    {
      title: "Cookies and Preferences",
      paragraphs: [
        "Cookies support session management, analytics, and functional preferences. You can manage your choices using the Cookie Policy and the Manage Cookie Preferences link in the footer. Necessary cookies are required for secure login and core functionality.",
      ],
    },
    {
      title: "Data Sharing",
      paragraphs: [
        "We do not sell personal data. Limited sharing may occur with trusted service providers to support infrastructure, security, and email delivery. These providers are bound by contractual obligations to protect your information and use it solely for the purposes we specify.",
      ],
    },
    {
      title: "Data Storage and Retention",
      paragraphs: [
        "Data is stored securely and retained only as long as necessary to provide the service, comply with legal obligations, and enforce policies. Audit logs may be retained to ensure system integrity and traceability of administrative actions.",
      ],
    },
    {
      title: "User Rights",
      paragraphs: [
        "Depending on applicable law, you may have rights to access, download, correct, or request deletion of your data. If the platform supports these features, you can submit a request through your profile or contact support for assistance.",
      ],
    },
    {
      title: "Contact Information",
      paragraphs: [
        "For privacy-related questions or requests, contact us at privacy@example.com. We aim to respond in a timely manner and address your concerns in accordance with applicable regulations.",
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
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

