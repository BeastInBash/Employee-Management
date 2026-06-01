import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendMemberCredentials(
  email: string,
  name: string,
  password: string
): Promise<void> {
   const htmlContent = `
  <div style="background-color:#f4f4f7;padding:40px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.05);overflow:hidden;">
      
      <div style="background-color:#3b82f6;padding:20px 30px;color:#ffffff;text-align:center;">
        <h1 style="margin:0;font-size:24px;">Task Manager</h1>
      </div>

      <div style="padding:30px;">
        <h2 style="color:#111827;">Welcome to Task Manager!</h2>
        <p style="color:#374151;">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151;">Your account has been created successfully. Here are your login credentials:</p>

        <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:15px;margin:20px 0;">
          <p style="margin:0;font-size:15px;"><strong>Email:</strong> ${email}</p>
          <p style="margin:5px 0 0;font-size:15px;"><strong>Password:</strong> ${password}</p>
        </div>

        <p style="color:#ef4444;font-weight:bold;">Important:</p>
        <p style="color:#374151;">Please change your password after your first login for security purposes.</p>

        <a href="http://localhost:5173/"
          style="display:inline-block;margin-top:20px;background-color:#3b82f6;color:#ffffff;
                 text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">
          Login to Task Manager
        </a>

        <p style="margin-top:30px;color:#9ca3af;font-size:13px;text-align:center;">
          © ${new Date().getFullYear()} Task Manager. All rights reserved.
        </p>
      </div>
    </div>
  </div>
  `;
  try {
    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Welcome to Task Manager - Your Login Credentials",
      html: htmlContent,
    });
  } catch (error) {
    console.error("Failed to send email:", error);
    // Don't throw error - member creation should succeed even if email fails
  }
}

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetToken: string
): Promise<void> {
  const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
  const htmlContent = `
  <div style="background-color:#f4f4f7;padding:40px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.05);overflow:hidden;">
      
      <div style="background-color:#3b82f6;padding:20px 30px;color:#ffffff;text-align:center;">
        <h1 style="margin:0;font-size:24px;">Task Manager</h1>
      </div>

      <div style="padding:30px;">
        <h2 style="color:#111827;">Password Reset Request</h2>
        <p style="color:#374151;">Hi <strong>${name}</strong>,</p>
        <p style="color:#374151;">We received a request to reset your password. Click the button below to reset it:</p>

        <a href="${resetUrl}"
          style="display:inline-block;margin-top:20px;background-color:#3b82f6;color:#ffffff;
                 text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">
          Reset Password
        </a>

        <p style="color:#374151;margin-top:20px;">This link will expire in 1 hour.</p>
        <p style="color:#9ca3af;font-size:13px;">If you didn't request this, please ignore this email.</p>

        <p style="margin-top:30px;color:#9ca3af;font-size:13px;text-align:center;">
          © ${new Date().getFullYear()} Task Manager. All rights reserved.
        </p>
      </div>
    </div>
  </div>
  `;
  try {
    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: email,
      subject: "Reset Your Password - Task Manager",
      html: htmlContent,
    });
  } catch (error) {
    console.error("Failed to send reset email:", error);
    throw new Error("Failed to send reset email");
  }
}