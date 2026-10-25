import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/sonner";

// Reasons the API sends back to /login?error=… after a Google attempt.
const GOOGLE_ERRORS: Record<string, string> = {
  google_failed: "Google sign-in didn't finish. Try again.",
  google_unavailable: "Google sign-in isn't set up on this server yet.",
  email_unverified: "That Google account's email isn't verified, so it can't be used to sign in.",
};

const Login = () => {
  const navigate = useNavigate();
  const { login, signup, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") === "signup" ? "signup" : "login");

  // Already signed in: go straight to the right place.
  useEffect(() => {
    if (!user) return;
    navigate(user.role === "admin" ? "/dashboard" : `/todos/${user.id}`, { replace: true });
  }, [user, navigate]);

  // Surface a failed Google attempt once, then drop the param so a refresh is clean.
  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) return;
    toast.error(GOOGLE_ERRORS[error] ?? GOOGLE_ERRORS.google_failed);
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [isSignupLoading, setIsSignupLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoginLoading(true);
    try {
      if (await login(loginEmail, loginPassword)) {
        const stored = localStorage.getItem("user");
        const parsed = stored ? JSON.parse(stored) : null;
        navigate(parsed?.role === "admin" || !parsed?.id ? "/dashboard" : `/todos/${parsed.id}`);
      }
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSignupLoading(true);
    try {
      if (await signup(signupEmail, signupPassword, signupName)) navigate("/dashboard");
    } finally {
      setIsSignupLoading(false);
    }
  };

  return (
    <AuthLayout
      title={tab === "signup" ? "Create your workspace" : "Welcome back"}
      description={
        tab === "signup"
          ? "You'll be the admin. Add your team once you're in."
          : "Sign in to see today's work and attendance."
      }
      footer="By continuing you agree to the Terms of Service and Privacy Policy."
    >
      <div className="space-y-5">
        <GoogleSignInButton />
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-5 grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoginLoading}>
                {isLoginLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Your name</Label>
                <Input
                  id="signup-name"
                  autoComplete="name"
                  placeholder="Sam Rivera"
                  required
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Work email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isSignupLoading}>
                {isSignupLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </AuthLayout>
  );
};

export default Login;
