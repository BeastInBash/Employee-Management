import { Router, type Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { API_URL, CLIENT_URL, auth, googleEnabled } from "../utils/betterAuth";
import { resolveGoogleUser } from "../utils/googleAuth";
import { generateToken } from "../utils/jwt";
import { setAuthCookie } from "../controllers/auth.controller";

// Google sign-in, start to finish, as top-level navigations on this API's
// origin (so Better Auth's state/session cookies are first-party even though
// the client lives on another domain):
//
//   client  → GET  /api/auth/google                    (302 to Google)
//   Google  → GET  /api/better-auth/callback/google    (Better Auth handler)
//   BA      → GET  /api/auth/google/complete            (issue the app JWT)
//   API     → 302  CLIENT_URL/auth/callback#token=…    (client stores it)

const googleRouter = Router();

const toClient = (res: Response, path: string) => res.redirect(302, `${CLIENT_URL}${path}`);

/** Copy Better Auth's Set-Cookie headers (state, session, clears) onto our response. */
function forwardCookies(from: globalThis.Response, to: Response) {
    const cookies = from.headers.getSetCookie();
    if (cookies.length) to.append("Set-Cookie", cookies);
}

/** GET /api/auth/providers — lets the login page decide whether to show the Google button. */
googleRouter.get("/providers", (_req, res) => {
    res.json({ google: googleEnabled });
});

/** GET /api/auth/google — start the OAuth flow. */
googleRouter.get("/google", async (req, res) => {
    if (!googleEnabled) return toClient(res, "/login?error=google_unavailable");
    try {
        const response = await auth.api.signInSocial({
            body: {
                provider: "google",
                callbackURL: `${API_URL}/api/auth/google/complete`,
                errorCallbackURL: `${CLIENT_URL}/login?error=google_failed`,
            },
            headers: fromNodeHeaders(req.headers),
            asResponse: true,
        });
        const data = (await response.json()) as { url?: string };
        if (!response.ok || !data.url) throw new Error(`signInSocial failed (${response.status})`);
        forwardCookies(response, res);
        res.redirect(302, data.url);
    } catch (error) {
        console.error("Google sign-in start error:", error);
        toClient(res, "/login?error=google_failed");
    }
});

/** GET /api/auth/google/complete — Better Auth is done; swap its session for the app's JWT. */
googleRouter.get("/google/complete", async (req, res) => {
    const headers = fromNodeHeaders(req.headers);
    try {
        const session = await auth.api.getSession({ headers });
        if (!session) return toClient(res, "/login?error=google_failed");

        const result = await resolveGoogleUser({
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
            emailVerified: session.user.emailVerified,
        });

        // The Better Auth session was only the handshake; end it either way.
        const signOut = await auth.api.signOut({ headers, asResponse: true });
        forwardCookies(signOut, res);

        if (!result.ok) return toClient(res, `/login?error=${result.reason}`);

        const token = generateToken({ userId: result.user.id, email: result.user.email, role: result.user.role });
        setAuthCookie(res, token);

        // The token travels in the fragment, which browsers never send to servers.
        const params = new URLSearchParams({ token });
        if (result.created) params.set("new", "1");
        if (result.passwordDisabled) params.set("notice", "password_disabled");
        toClient(res, `/auth/callback#${params.toString()}`);
    } catch (error) {
        console.error("Google sign-in completion error:", error);
        toClient(res, "/login?error=google_failed");
    }
});

export default googleRouter;
