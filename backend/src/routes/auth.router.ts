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

const router = Router();

router.post("/login", login);
router.post("/signup", signup);
router.post("/change-password", authenticate, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", authenticate, getMe);
router.post("/verify-email", verifyEmail);
router.post("/resend-verification", authenticate, resendVerification);

export default router;
