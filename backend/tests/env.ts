// Runs before any module is imported (jest `setupFiles`). The real jwt util
// throws on startup when JWT_SECRET is missing, so it must be set here. We also
// pin email/client env so nothing tries to reach real services.
process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_EXPIRES_IN = "7d";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.SENDER_EMAIL = "noreply@example.com";
process.env.SMTP_HOST = "smtp.example.com";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "smtp-user";
process.env.SMTP_PASS = "smtp-pass";
process.env.DATABASE_URL =
  "postgresql://user:pass@localhost:5432/test?schema=public";
