import { Router, type IRouter } from "express";
import { db, eventsTable, teamsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/calendar", async (_req, res): Promise<void> => {
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
    .orderBy(eventsTable.startsAt);

  res.json(events);
});

export default router;
