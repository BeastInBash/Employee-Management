import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  // Invite links (?welcome=1) are a new member's first password, not a reset.
  const welcome = searchParams.get("welcome") === "1";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Use at least 6 characters.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => navigate("/login"), 2000);
      } else if (data.message === "Invalid or expired reset token") {
        setError(
          welcome
            ? 'This invite link has expired or was already used. Use "Forgot password" on the sign-in page to get a new one.'
            : "This link has expired or was already used. Ask for a new one and use the newest email.",
        );
      } else {
        setError(data.message || "The password couldn't be saved. The link may have expired.");
      }
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="This link doesn't work"
        description="It's missing its reset code. Ask for a new link and use the newest email."
        footer={
          <Link to="/forgot-password" className="text-primary hover:underline">
            Send a new link
          </Link>
        }
      >
        <Button asChild className="w-full">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={
        success
          ? welcome
            ? "Password set"
            : "Password updated"
          : welcome
            ? "Choose your password"
            : "Choose a new password"
      }
      description={
        success
          ? "Taking you to sign in…"
          : welcome
            ? "Pick a password for your Workzen account, at least 6 characters. You'll sign in with it and your email."
            : "At least 6 characters. You'll use it the next time you sign in."
      }
    >
      {success ? (
        <div className="flex items-center gap-3 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-sage" />
          {welcome
            ? "You're all set. Sign in with your email and new password."
            : "All set. Sign in with your new password."}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="newPassword">{welcome ? "Password" : "New password"}</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{welcome ? "Confirm password" : "Confirm new password"}</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {welcome ? "Set password" : "Update password"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
};

export default ResetPassword;
