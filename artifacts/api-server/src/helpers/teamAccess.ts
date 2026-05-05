import { db, teamsTable, teamMembersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { Response } from "express";
import type { AuthedRequest } from "../middlewares/requireAuth";

export async function canAccessTeam(teamId: number, userId: number, userRole: string): Promise<boolean> {
  if (userRole === "admin") return true;

  const [owned] = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.createdBy, userId)));

  if (owned) return true;

  const [member] = await db
    .select({ id: teamMembersTable.id })
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)));

  return !!member;
}

export async function assertTeamAccess(
  teamId: number,
  req: AuthedRequest,
  res: Response,
): Promise<boolean> {
  const allowed = await canAccessTeam(teamId, req.userId!, req.userRole!);
  if (!allowed) {
    res.status(403).json({ error: "Access denied" });
    return false;
  }
  return true;
}
