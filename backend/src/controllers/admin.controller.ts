import { Request, Response } from "express";
import { client } from "../config";

export async function setUserRole(req: Request, res: Response) {
  try {
    const actingUserRole = req.user?.role;
    if (actingUserRole !== "admin") return res.status(403).json({ error: "Forbidden" });

    const { userId } = req.params;
    const { role } = req.body;
    if (typeof userId !== "string" || !role) return res.status(400).json({ error: "userId and role required" });

    const user = await client.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const updated = await client.user.update({ where: { id: userId }, data: { role } });
    return res.json({ user: { id: updated.id, email: updated.email, role: updated.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
