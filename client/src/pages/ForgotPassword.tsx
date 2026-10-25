import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        // The API responds the same way whether or not the account exists, so
        // we always show the confirmation rather than revealing membership.
        setSubmitted(true);
      } else {
        setError(data.message || "The reset link couldn't be sent. Try again.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title={submitted ? "Check your inbox" : "Reset your password"}
      description={
        submitted
          ? `If ${email} has a Crewly account, a reset link is on its way. It works for one hour.`
          : "Enter the email you sign in with and we'll send you a link to set a new password."
      }
      footer={
        <Link to="/login" className="text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {submitted ? (
        <div className="flex items-center gap-3 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
          <MailCheck className="h-5 w-5 shrink-0 text-primary" />
          Didn't get it? Check spam, or try again in a minute.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
