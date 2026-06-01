import { Router } from "express";
import { login, signup, changePassword, forgotPassword, resetPassword } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/signup", signup);
router.post("/change-password", authenticate, changePassword);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
