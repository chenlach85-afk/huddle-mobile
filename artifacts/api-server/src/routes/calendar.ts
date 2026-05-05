import { Router, type IRouter } from "express";
import { db, eventsTable, teamsTable, teamMembersTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/calendar", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const userRole = req.userRole!;

  let teamIds: number[];

  if (userRole === "admin") {
    const allTeams = await db.select({ id: teamsTable.id }).from(teamsTable);
    teamIds = allTeams.map((t) => t.id);
  } else {
    const [ownedRows, memberRows] = await Promise.all([
      db.select({ teamId: teamsTable.id }).from(teamsTable).where(eq(teamsTable.createdBy, userId)),
      db.select({ teamId: teamMembersTable.teamId }).from(teamMembersTable).where(eq(teamMembersTable.userId, userId)),
    ]);
    const idSet = new Set([
      ...ownedRows.map((r) => r.teamId),
      ...memberRows.map((r) => r.teamId),
    ]);
    teamIds = [...idSet];
  }

  if (teamIds.length === 0) {
    res.json([]);
    return;
  }

  const events = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      type: eventsTable.type,
      location: eventsTable.location,
      startsAt: eventsTable.startsAt,
      endsAt: eventsTable.endsAt,
      notes: eventsTable.notes,
      teamId: eventsTable.teamId,
      teamName: teamsTable.name,
      teamColor: teamsTable.avatarColor,
    })
    .from(eventsTable)
    .innerJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
    .where(inArray(eventsTable.teamId, teamIds))
    .orderBy(eventsTable.startsAt);

  res.json(events);
});

export default router;
