import { Router, type IRouter } from "express";
import { eq, count, gt, inArray } from "drizzle-orm";
import { db, teamsTable, playersTable, eventsTable, tasksTable, messagesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [{ totalTeams }] = await db.select({ totalTeams: count() }).from(teamsTable);
  const [{ totalPlayers }] = await db.select({ totalPlayers: count() }).from(playersTable);

  const now = new Date();
  const [{ upcomingEventsCount }] = await db
    .select({ upcomingEventsCount: count() })
    .from(eventsTable)
    .where(gt(eventsTable.startsAt, now));

  const [{ pendingTasksCount }] = await db
    .select({ pendingTasksCount: count() })
    .from(tasksTable)
    .where(eq(tasksTable.status, "pending"));

  const [{ recentMessages }] = await db.select({ recentMessages: count() }).from(messagesTable);

  const teams = await db.select().from(teamsTable).orderBy(teamsTable.name);

  const teamBreakdown = await Promise.all(
    teams.map(async (team) => {
      const [{ upcomingEvents }] = await db
        .select({ upcomingEvents: count() })
        .from(eventsTable)
        .where(eq(eventsTable.teamId, team.id));

      const [{ pendingTasks }] = await db
        .select({ pendingTasks: count() })
        .from(tasksTable)
        .where(eq(tasksTable.teamId, team.id));

      return {
        teamId: team.id,
        teamName: team.name,
        sport: team.sport,
        playerCount: team.playerCount,
        upcomingEvents: Number(upcomingEvents),
        pendingTasks: Number(pendingTasks),
      };
    })
  );

  res.json({
    totalTeams: Number(totalTeams),
    totalPlayers: Number(totalPlayers),
    upcomingEventsCount: Number(upcomingEventsCount),
    pendingTasksCount: Number(pendingTasksCount),
    recentMessages: Number(recentMessages),
    teamBreakdown,
  });
});

router.get("/teams/:teamId/activity", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;
  const teamId = parseInt(rawId, 10);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  const activity: Array<{
    id: string;
    type: string;
    description: string;
    occurredAt: Date;
    entityId: number | null;
  }> = [];

  const recentEvents = await db
    .select()
    .from(eventsTable)
    .where(eq(eventsTable.teamId, teamId))
    .orderBy(eventsTable.createdAt)
    .limit(5);

  for (const e of recentEvents) {
    activity.push({
      id: `event-${e.id}`,
      type: "event_created",
      description: `Event "${e.title}" scheduled`,
      occurredAt: e.createdAt,
      entityId: e.id,
    });
  }

  const recentPlayers = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.teamId, teamId))
    .orderBy(playersTable.createdAt)
    .limit(5);

  for (const p of recentPlayers) {
    activity.push({
      id: `player-${p.id}`,
      type: "player_added",
      description: `${p.name} joined the roster`,
      occurredAt: p.createdAt,
      entityId: p.id,
    });
  }

  const recentTasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.teamId, teamId))
    .orderBy(tasksTable.createdAt)
    .limit(5);

  for (const t of recentTasks) {
    activity.push({
      id: `task-${t.id}`,
      type: t.status === "done" ? "task_completed" : "task_created",
      description: t.status === "done" ? `Task "${t.title}" completed` : `Task "${t.title}" created`,
      occurredAt: t.updatedAt,
      entityId: t.id,
    });
  }

  const recentMessages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.teamId, teamId))
    .orderBy(messagesTable.createdAt)
    .limit(5);

  for (const m of recentMessages) {
    activity.push({
      id: `message-${m.id}`,
      type: "message_sent",
      description: `${m.senderName} sent a message`,
      occurredAt: m.createdAt,
      entityId: m.id,
    });
  }

  activity.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  res.json(activity.slice(0, 20));
});

export default router;
