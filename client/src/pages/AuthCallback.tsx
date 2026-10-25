import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";

/**
 * Landing page after Google sign-in. The API redirects here with the app JWT
 * in the URL fragment (`#token=…&new=1&notice=password_disabled`); we adopt it,
 * wipe the fragment from history, and route the user like a normal login.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  // StrictMode runs effects twice in dev; only consume the token once.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");
    window.history.replaceState(null, "", window.location.pathname);

    if (!token) {
      navigate("/login?error=google_failed", { replace: true });
      return;
    }

    loginWithToken(token).then((user) => {
      if (!user) {
        navigate("/login?error=google_failed", { replace: true });
        return;
      }
      if (params.get("new")) {
        toast.success(`Welcome to Crewly, ${user.name.split(" ")[0]}! Start by creating your organization.`);
      } else {
        toast.success("Signed in with Google");
      }
      if (params.get("notice") === "password_disabled") {
        toast.info("Your account now signs in with Google, so your old password was turned off. Use “Forgot password” if you want one too.", {
          duration: 10000,
        });
      }
      navigate(user.role === "admin" ? "/dashboard" : `/todos/${user.id}`, { replace: true });
    });
  }, [loginWithToken, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-muted/40">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
};

export default AuthCallback;
