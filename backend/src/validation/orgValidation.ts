import z from "zod"
export const getOrgQueryschema = z.object({
    orgId: z.string().uuid(),
    membership: z.enum(["true", "false"]).optional().transform((val) => val == "true"),
    workspace: z.enum(["true", "false"]).optional().transform((val) => val == "true")
})

export const getMyOrgQuerySchema = z.object({
    membership: z.enum(["true", "false"]).optional().transform((val) => val == "true"),
    workspace: z.enum(["true", "false"]).optional().transform((val) => val == "true")
})
