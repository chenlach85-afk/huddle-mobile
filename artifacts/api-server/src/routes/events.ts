import { Router, type IRouter } from "express";
import { eq, count } from "drizzle-orm";
import { db, eventsTable, attendanceTable, playersTable, teamsTable } from "@workspace/db";
import {
  ListEventsParams,
  CreateEventParams,
  CreateEventBody,
  GetEventParams,
  UpdateEventParams,
  UpdateEventBody,
  DeleteEventParams,
  UpsertAttendanceParams,
  UpsertAttendanceBody,
  ListAttendanceParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { assertTeamAccess } from "../helpers/teamAccess";

const router: IRouter = Router();

async function getEventWithCounts(eventId: number) {
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId));
  if (!event) return null;

  const [{ total }] = await db
    .select({ total: count() })
    .from(playersTable)
    .where(eq(playersTable.teamId, event.teamId));

  const [{ attending }] = await db
    .select({ attending: count() })
    .from(attendanceTable)
    .where(eq(attendanceTable.eventId, eventId));

  return { ...event, attendingCount: Number(attending), totalCount: Number(total) };
}

router.get("/teams/:teamId/events", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = ListEventsParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const events = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.teamId, teamId))
    .orderBy(eventsTable.startsAt);

  const [{ total }] = await db
    .select({ total: count() })
    .from(playersTable)
    .where(eq(playersTable.teamId, teamId));

  const eventsWithCounts = await Promise.all(
    events.map(async (event) => {
      const [{ attending }] = await db
        .select({ attending: count() })
        .from(attendanceTable)
        .where(eq(attendanceTable.eventId, event.id));
      return { ...event, attendingCount: Number(attending), totalCount: Number(total) };
    })
  );

  res.json(eventsWithCounts);
});

router.post("/teams/:teamId/events", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = CreateEventParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const d = parsed.data;
  const [event] = await db
    .insert(eventsTable)
    .values({
      teamId,
      title: d.title,
      type: d.type ?? "practice",
      location: d.location ?? null,
      startsAt: new Date(d.startsAt as unknown as string),
      endsAt: d.endsAt ? new Date(d.endsAt as unknown as string) : null,
      notes: d.notes ?? null,
    })
    .returning();

  res.status(201).json({ ...event, attendingCount: 0, totalCount: 0 });
});

router.get("/events/:eventId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = GetEventParams.safeParse({ eventId: req.params.eventId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const event = await getEventWithCounts(params.data.eventId);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  if (!(await assertTeamAccess(event.teamId, req, res))) return;

  res.json(event);
});

router.patch("/events/:eventId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = UpdateEventParams.safeParse({ eventId: req.params.eventId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select({ teamId: eventsTable.teamId }).from(eventsTable).where(eq(eventsTable.id, params.data.eventId));
  if (!existing) { res.status(404).json({ error: "Event not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.type !== undefined) updates.type = d.type;
  if ("location" in d) updates.location = d.location;
  if (d.startsAt !== undefined) updates.startsAt = d.startsAt;
  if ("endsAt" in d) updates.endsAt = d.endsAt;
  if ("notes" in d) updates.notes = d.notes;

  const [event] = await db
    .update(eventsTable)
    .set(updates)
    .where(eq(eventsTable.id, params.data.eventId))
    .returning();
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const result = await getEventWithCounts(event.id);
  res.json(result);
});

router.delete("/events/:eventId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = DeleteEventParams.safeParse({ eventId: req.params.eventId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select({ teamId: eventsTable.teamId }).from(eventsTable).where(eq(eventsTable.id, params.data.eventId));
  if (!existing) { res.status(404).json({ error: "Event not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const [event] = await db.delete(eventsTable).where(eq(eventsTable.id, params.data.eventId)).returning();
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  res.sendStatus(204);
});

router.get("/events/:eventId/attendance", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = ListAttendanceParams.safeParse({ eventId: req.params.eventId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select({ teamId: eventsTable.teamId }).from(eventsTable).where(eq(eventsTable.id, params.data.eventId));
  if (!existing) { res.status(404).json({ error: "Event not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const records = await db
    .select({
      id: attendanceTable.id,
      eventId: attendanceTable.eventId,
      playerId: attendanceTable.playerId,
      playerName: playersTable.name,
      status: attendanceTable.status,
      notes: attendanceTable.notes,
      updatedAt: attendanceTable.updatedAt,
    })
    .from(attendanceTable)
    .innerJoin(playersTable, eq(attendanceTable.playerId, playersTable.id))
    .where(eq(attendanceTable.eventId, params.data.eventId));

  res.json(records);
});

router.post("/events/:eventId/attendance", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = UpsertAttendanceParams.safeParse({ eventId: req.params.eventId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpsertAttendanceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select({ teamId: eventsTable.teamId }).from(eventsTable).where(eq(eventsTable.id, params.data.eventId));
  if (!existing) { res.status(404).json({ error: "Event not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const [record] = await db
    .insert(attendanceTable)
    .values({
      eventId: params.data.eventId,
      playerId: parsed.data.playerId,
      status: parsed.data.status,
      notes: parsed.data.notes ?? null,
    })
    .onConflictDoUpdate({
      target: [attendanceTable.eventId, attendanceTable.playerId],
      set: {
        status: parsed.data.status,
        notes: parsed.data.notes ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  const [player] = await db.select({ name: playersTable.name }).from(playersTable).where(eq(playersTable.id, record.playerId));
  res.json({ ...record, playerName: player?.name ?? "" });
});

export default router;
