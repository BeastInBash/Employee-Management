import { Request, Response } from "express";
import { PrismaClient, UserRole } from "@prisma/client";
import {
  loginSchema,
  signupSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../validation/authValidation";
import { hashPassword, comparePassword } from "../utils/password";
import { generateToken } from "../utils/jwt";
import { sendPasswordResetEmail } from "../utils/email";
import crypto from "crypto";

const prisma = new PrismaClient();
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const isPasswordValid = await comparePassword(
      validatedData.password,
      user.password
    );

    if (!isPasswordValid) {
      res.status(401).json({ message: "Invalid email or password" });
      return;
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { password, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword,
      requiresPasswordChange: user.isPasswordReset,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    if (error.name === "ZodError") {
      res.status(400).json({ message: "Invalid input", errors: error.errors });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function signup(req: Request, res: Response): Promise<void> {
  try {
    const validatedData = signupSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      res.status(400).json({ message: "User already exists with this email" });
      return;
    }

    const hashedPassword = await hashPassword(validatedData.password);

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        role: UserRole.admin, 
      },
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const { password, ...userWithoutPassword } = user;

    res.status(201).json({
      token,
      user: userWithoutPassword,
    });
  } catch (error:any) {
    console.error("Signup error:", error);
    if (error.name === "ZodError") {
      res.status(400).json({ message: "Invalid input", errors: error.errors });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function changePassword(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const validatedData = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const isOldPasswordValid = await comparePassword(
      validatedData.oldPassword,
      user.password
    );

    if (!isOldPasswordValid) {
      res.status(400).json({ message: "Current password is incorrect" });
      return;
    }

    const hashedNewPassword = await hashPassword(validatedData.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedNewPassword,
        isPasswordReset: false, // Mark that password has been changed
      },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error:any) {
    console.error("Change password error:", error);
    if (error.name === "ZodError") {
      res.status(400).json({ message: "Invalid input", errors: error.errors });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function forgotPassword(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const hashedPassword = await hashPassword(validatedData.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        isPasswordReset: false,
      },
    });

    res.json({ message: "Password reset successfully" });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    if (error.name === "ZodError") {
      res.status(400).json({ message: "Invalid input", errors: error.errors });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function resetPassword(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const validatedData = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        resetToken: validatedData.token,
        resetTokenExpiry: { gte: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ message: "Invalid or expired reset token" });
      return;
    }

    const hashedPassword = await hashPassword(validatedData.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
        isPasswordReset: false,
      },
    });

    res.json({ message: "Password reset successfully" });
  } catch (error: any) {
    console.error("Reset password error:", error);
    if (error.name === "ZodError") {
      res.status(400).json({ message: "Invalid input", errors: error.errors });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
  }
}