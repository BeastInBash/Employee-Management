import { Router } from "express";
import {
    login,
    signup,
    changePassword,
    forgotPassword,
    resetPassword,
    getMe,
    verifyEmail,
    resendVerification,
} from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";
import {
    forgotByEmail,
    forgotByIp,
    loginByEmail,
    loginByIp,
    resendVerificationByIp,
    signupByIp,
    tokenByIp,
} from "../middleware/rateLimit";

const router = Router();

router.post("/login", loginByIp, loginByEmail, login);
router.post("/signup", signupByIp, signup);
// Needs the current password, so it's a guessing target too (counted per signed-in address).
router.post("/change-password", authenticate, loginByIp, changePassword);
router.post("/forgot-password", forgotByIp, forgotByEmail, forgotPassword);
router.post("/reset-password", tokenByIp, resetPassword);
router.get("/me", authenticate, getMe);
router.post("/verify-email", tokenByIp, verifyEmail);
router.post("/resend-verification", authenticate, resendVerificationByIp, resendVerification);

export default router;
