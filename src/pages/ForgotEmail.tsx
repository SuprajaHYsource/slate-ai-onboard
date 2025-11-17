import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, User, ArrowLeft } from "lucide-react";

const ForgotEmail = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searchBy, setSearchBy] = useState<"phone" | "name">("phone");
  const [formData, setFormData] = useState({
    contactNumber: "",
    fullName: "",
  });
  const [foundEmail, setFoundEmail] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFoundEmail(null);

    try {
      const searchValue = searchBy === "phone" ? formData.contactNumber : formData.fullName;

      const { data, error } = await supabase.functions.invoke("forgot-email", {
        body: {
          searchBy,
          value: searchValue,
        },
      });

      if (error) throw error;

      if (data?.email) {
        setFoundEmail(data.email);
        toast({
          title: "Email Found",
          description: "We found your account!",
        });
      } else {
        toast({
          title: "Not Found",
          description: "No account found with the provided information",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error searching for email:", error);
      toast({
        title: "Error",
        description: "Failed to search for account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit mb-4"
            onClick={() => navigate("/signin")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign In
          </Button>
          <CardTitle className="text-2xl font-bold">Forgot Email?</CardTitle>
          <CardDescription>
            Find your account using your phone number or full name
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!foundEmail ? (
            <>
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={searchBy === "phone" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSearchBy("phone")}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Phone Number
                </Button>
                <Button
                  type="button"
                  variant={searchBy === "name" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setSearchBy("name")}
                >
                  <User className="w-4 h-4 mr-2" />
                  Full Name
                </Button>
              </div>

              <form onSubmit={handleSearch} className="space-y-4">
                {searchBy === "phone" ? (
                  <div className="space-y-2">
                    <Label htmlFor="contactNumber">Phone Number</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="contactNumber"
                        name="contactNumber"
                        type="tel"
                        placeholder="+1234567890"
                        className="pl-10"
                        value={formData.contactNumber}
                        onChange={(e) =>
                          setFormData({ ...formData, contactNumber: e.target.value })
                        }
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter the phone number associated with your account
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        name="fullName"
                        type="text"
                        placeholder="John Doe"
                        className="pl-10"
                        value={formData.fullName}
                        onChange={(e) =>
                          setFormData({ ...formData, fullName: e.target.value })
                        }
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter your full name as registered in your account
                    </p>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Searching..." : "Find My Email"}
                </Button>
              </form>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  Your email address is:
                </p>
                <p className="text-lg font-semibold">{foundEmail}</p>
              </div>

              <Button
                className="w-full"
                onClick={() => navigate("/signin")}
              >
                Go to Sign In
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setFoundEmail(null);
                  setFormData({ contactNumber: "", fullName: "" });
                }}
              >
                Search Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotEmail;
