import { z } from "zod";

// "HH:mm" in 24-hour IST — the value an <input type="time"> submits.
const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be in HH:mm (24-hour) format");

export const updateTaskWindowSchema = z
  .object({
    enabled: z.boolean(),
    startTime: timeString.optional(),
    endTime: timeString.optional(),
  })
  .refine((data) => !data.enabled || (!!data.startTime && !!data.endTime), {
    message: "startTime and endTime are required when the window is enabled",
    path: ["startTime"],
  })
  .refine((data) => !data.enabled || data.startTime !== data.endTime, {
    message: "startTime and endTime must differ",
    path: ["endTime"],
  });

export type UpdateTaskWindowInput = z.infer<typeof updateTaskWindowSchema>;
