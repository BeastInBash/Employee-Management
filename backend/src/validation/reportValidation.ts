import { z } from "zod";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must be YYYY-MM-DD");

export const reportQuerySchema = z.object({
  scope: z.enum(["workspace", "project", "team", "me"]),
  id: z.string().uuid().optional(),
  from: dateKey,
  to: dateKey,
  // Query strings are text; anything but "false" keeps weekends out of attendance.
  excludeWeekends: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;
