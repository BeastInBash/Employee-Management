import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, MailX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";

type State = { status: "checking" } | { status: "done"; email: string } | { status: "failed"; message: string };

/**
 * Landing page for the link in confirmation emails. Public: the link may be
 * opened on a device where the person isn't signed in. `?next=login` comes
 * from a new member's welcome email and points them at sign-in afterwards.
 */
const VerifyEmail = () => {
  const [params] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState<State>({ status: "checking" });
  // StrictMode runs effects twice in dev; a token can only be used once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = params.get("token") ?? "";
    api<{ email: string }>("/auth/verify-email", { method: "POST", body: { token } })
      .then(async (d) => {
        setState({ status: "done", email: d.email });
        // Clear the reminder banner for a signed-in session on this device.
        if (localStorage.getItem("authToken")) await refreshUser();
      })
      .catch((e) => setState({ status: "failed", message: errorMessage(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const home = user ? (user.role === "admin" ? "/dashboard" : `/todos/${user.id}`) : "/login";
  const goLabel = user ? "Continue" : "Sign in";

  if (state.status === "checking") {
    return (
      <AuthLayout title="Confirming your email" description="One moment…">
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AuthLayout>
    );
  }

  if (state.status === "failed") {
    return (
      <AuthLayout
        title="That link didn't work"
        description={state.message}
        footer={!user && <span>Signed in somewhere else? Use “Resend email” in the banner at the top of the app.</span>}
      >
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
          <MailX className="h-5 w-5 shrink-0" />
          Links work once and expire after 24 hours.
        </div>
        <Button asChild className="w-full">
          <Link to={home}>{goLabel}</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Email confirmed" description={`Thanks. ${state.email} is confirmed for your account.`}>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-sage" />
        {params.get("next") === "login" && !user
          ? "Now sign in with the password from your welcome email, and choose a new one."
          : "You're all set."}
      </div>
      <Button asChild className="w-full">
        <Link to={home}>{goLabel}</Link>
      </Button>
    </AuthLayout>
  );
};

export default VerifyEmail;
