import { Router, type IRouter } from "express";
import { eq, count, gt, inArray, and } from "drizzle-orm";
import { db, teamsTable, teamMembersTable, playersTable, eventsTable, tasksTable, messagesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function getUserTeamIds(userId: number, userRole: string): Promise<number[]> {
  if (userRole === "admin") {
    const all = await db.select({ id: teamsTable.id }).from(teamsTable);
    return all.map((t) => t.id);
  }
  const [ownedRows, memberRows] = await Promise.all([
    db.select({ teamId: teamsTable.id }).from(teamsTable).where(eq(teamsTable.createdBy, userId)),
    db.select({ teamId: teamMembersTable.teamId }).from(teamMembersTable).where(eq(teamMembersTable.userId, userId)),
  ]);
  const idSet = new Set([
    ...ownedRows.map((r) => r.teamId),
    ...memberRows.map((r) => r.teamId),
  ]);
  return [...idSet];
}

router.get("/dashboard/summary", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const userRole = req.userRole!;

  const teamIds = await getUserTeamIds(userId, userRole);

  if (teamIds.length === 0) {
    res.json({
      totalTeams: 0,
      totalPlayers: 0,
      upcomingEventsCount: 0,
      pendingTasksCount: 0,
      recentMessages: 0,
      teamBreakdown: [],
    });
    return;
  }

  const now = new Date();

  const [[{ totalTeams }], [{ totalPlayers }], [{ upcomingEventsCount }], [{ pendingTasksCount }], [{ recentMessages }], teams] =
    await Promise.all([
      db.select({ totalTeams: count() }).from(teamsTable).where(inArray(teamsTable.id, teamIds)),
      db.select({ totalPlayers: count() }).from(playersTable).where(inArray(playersTable.teamId, teamIds)),
      db.select({ upcomingEventsCount: count() }).from(eventsTable).where(and(gt(eventsTable.startsAt, now), inArray(eventsTable.teamId, teamIds))),
      db.select({ pendingTasksCount: count() }).from(tasksTable).where(and(eq(tasksTable.status, "pending"), inArray(tasksTable.teamId, teamIds))),
      db.select({ recentMessages: count() }).from(messagesTable).where(inArray(messagesTable.teamId, teamIds)),
      db.select().from(teamsTable).where(inArray(teamsTable.id, teamIds)).orderBy(teamsTable.name),
    ]);

  const teamBreakdown = await Promise.all(
    teams.map(async (team) => {
      const [[{ upcomingEvents }], [{ pendingTasks }]] = await Promise.all([
        db.select({ upcomingEvents: count() }).from(eventsTable).where(eq(eventsTable.teamId, team.id)),
        db.select({ pendingTasks: count() }).from(tasksTable).where(eq(tasksTable.teamId, team.id)),
      ]);
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

router.get("/teams/:teamId/activity", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const rawId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;
  const teamId = parseInt(rawId, 10);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  const userTeamIds = await getUserTeamIds(req.userId!, req.userRole!);
  if (!userTeamIds.includes(teamId)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  const activity: Array<{
    id: string;
    type: string;
    description: string;
    occurredAt: Date;
    entityId: number | null;
  }> = [];

  const [recentEvents, recentPlayers, recentTasks, recentMessages] = await Promise.all([
    db.select().from(eventsTable).where(eq(eventsTable.teamId, teamId)).orderBy(eventsTable.createdAt).limit(5),
    db.select().from(playersTable).where(eq(playersTable.teamId, teamId)).orderBy(playersTable.createdAt).limit(5),
    db.select().from(tasksTable).where(eq(tasksTable.teamId, teamId)).orderBy(tasksTable.createdAt).limit(5),
    db.select().from(messagesTable).where(eq(messagesTable.teamId, teamId)).orderBy(messagesTable.createdAt).limit(5),
  ]);

  for (const e of recentEvents) {
    activity.push({ id: `event-${e.id}`, type: "event_created", description: `Event "${e.title}" scheduled`, occurredAt: e.createdAt, entityId: e.id });
  }
  for (const p of recentPlayers) {
    activity.push({ id: `player-${p.id}`, type: "player_added", description: `${p.name} joined the roster`, occurredAt: p.createdAt, entityId: p.id });
  }
  for (const t of recentTasks) {
    activity.push({ id: `task-${t.id}`, type: t.status === "done" ? "task_completed" : "task_created", description: t.status === "done" ? `Task "${t.title}" completed` : `Task "${t.title}" created`, occurredAt: t.updatedAt, entityId: t.id });
  }
  for (const m of recentMessages) {
    activity.push({ id: `message-${m.id}`, type: "message_sent", description: `${m.senderName} sent a message`, occurredAt: m.createdAt, entityId: m.id });
  }

  activity.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  res.json(activity.slice(0, 20));
});

export default router;
