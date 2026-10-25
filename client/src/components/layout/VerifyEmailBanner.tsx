import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MailCheck, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";

const DISMISS_KEY = "verify-banner-dismissed";

/**
 * A quiet reminder for accounts whose email isn't confirmed yet. Verification
 * is soft: nothing is blocked, the banner just offers to resend the link.
 * Dismissing hides it for the rest of the browser session.
 */
export const VerifyEmailBanner = () => {
  const { user, refreshUser } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Pick up a confirmation made on another device (or older stored sessions
  // that predate the emailVerified field).
  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const show = !!user && user.emailVerified === false && !dismissed;

  const resend = async () => {
    setIsSending(true);
    try {
      const res = await api<{ message: string; alreadyVerified?: boolean }>("/auth/resend-verification", { method: "POST" });
      if (res.alreadyVerified) {
        await refreshUser();
        toast.success("Your email is already confirmed");
      } else {
        setSentTo(user?.email ?? null);
        toast.success(res.message);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setIsSending(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode: dismissal just won't persist */
    }
  };

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="overflow-hidden"
        >
          <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-honey-soft px-4 py-3 text-sm ring-1 ring-honey/15">
            <MailCheck className="h-4 w-4 shrink-0 text-honey" />
            <p className="min-w-0 flex-1 text-foreground">
              {sentTo ? (
                <>A new link is on its way to <span className="font-medium">{sentTo}</span>. It works for 24 hours.</>
              ) : (
                <>
                  Confirm your email address. We sent a link to <span className="font-medium">{user?.email}</span>.
                </>
              )}
            </p>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={resend} disabled={isSending} className="text-honey hover:text-honey">
                {isSending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Resend email
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={dismiss} aria-label="Hide for now" title="Hide for now">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
