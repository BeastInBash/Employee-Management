import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
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
  const [tab, setTab] = useState<"login" | "signup">(searchParams.get("tab") === "signup" ? "signup" : "login");

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

  const switchTab = (next: "login" | "signup") => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "signup") params.set("tab", "signup");
    else params.delete("tab");
    setSearchParams(params, { replace: true });
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
      {/* Segmented switch; the highlight slides between the two options. */}
      <div role="tablist" aria-label="Sign in or sign up" className="mb-6 grid grid-cols-2 rounded-full bg-muted p-1">
        {(
          [
            ["login", "Sign in"],
            ["signup", "Sign up"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => switchTab(value)}
            className={cn(
              "relative h-9 rounded-full text-sm font-medium transition-colors active:scale-100",
              tab === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === value && (
              <motion.span
                layoutId="auth-tab"
                className="absolute inset-0 rounded-full bg-card shadow-[0_1px_3px_rgb(46_38_20/0.12)]"
                transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
              />
            )}
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          role="tabpanel"
          initial={{ opacity: 0, transform: `translateX(${tab === "signup" ? 12 : -12}px)` }}
          animate={{ opacity: 1, transform: "translateX(0px)" }}
          exit={{ opacity: 0, transform: `translateX(${tab === "signup" ? -8 : 8}px)`, transition: { duration: 0.12 } }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="space-y-5"
        >
          {tab === "login" ? (
            <>
              <GoogleSignInButton label="Sign in with Google" dividerLabel="or sign in with email" />
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
                <Button type="submit" className="h-11 w-full text-[15px]" disabled={isLoginLoading}>
                  {isLoginLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground">
                New to Crewly?{" "}
                <button type="button" onClick={() => switchTab("signup")} className="font-medium text-primary hover:underline active:scale-100">
                  Create a workspace
                </button>
              </p>
            </>
          ) : (
            <>
              <GoogleSignInButton label="Sign up with Google" dividerLabel="or sign up with email" />
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
                <Button type="submit" className="h-11 w-full text-[15px]" disabled={isSignupLoading}>
                  {isSignupLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create account
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button type="button" onClick={() => switchTab("login")} className="font-medium text-primary hover:underline active:scale-100">
                  Sign in
                </button>
              </p>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </AuthLayout>
  );
};

export default Login;
