import { z } from "zod";

export const createMemberSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  role: z.string().min(2, "Role must be at least 2 characters"),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;