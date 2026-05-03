import { Router, type IRouter } from "express";
import { eq, gt } from "drizzle-orm";
import { db, teamsTable, eventsTable, messagesTable, tasksTable, playersTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/member/:joinCode", async (req, res): Promise<void> => {
  const { joinCode } = req.params;

  const [team] = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      sport: teamsTable.sport,
      season: teamsTable.season,
      coachName: teamsTable.coachName,
      avatarColor: teamsTable.avatarColor,
      description: teamsTable.description,
    })
    .from(teamsTable)
    .where(eq(teamsTable.joinCode, joinCode));

  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const now = new Date();

  const [events, messages, tasks, players] = await Promise.all([
    db
      .select({
        id: eventsTable.id,
        title: eventsTable.title,
        type: eventsTable.type,
        location: eventsTable.location,
        startsAt: eventsTable.startsAt,
        endsAt: eventsTable.endsAt,
        notes: eventsTable.notes,
      })
      .from(eventsTable)
      .where(eq(eventsTable.teamId, team.id))
      .orderBy(eventsTable.startsAt),

    db
      .select({
        id: messagesTable.id,
        senderName: messagesTable.senderName,
        senderRole: messagesTable.senderRole,
        content: messagesTable.content,
        pinned: messagesTable.pinned,
        createdAt: messagesTable.createdAt,
      })
      .from(messagesTable)
      .where(eq(messagesTable.teamId, team.id))
      .orderBy(messagesTable.createdAt),

    db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        description: tasksTable.description,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        assignedToPlayerId: tasksTable.assignedToPlayerId,
      })
      .from(tasksTable)
      .where(eq(tasksTable.teamId, team.id))
      .orderBy(tasksTable.createdAt),

    db
      .select({
        id: playersTable.id,
        name: playersTable.name,
        number: playersTable.number,
        position: playersTable.position,
        status: playersTable.status,
      })
      .from(playersTable)
      .where(eq(playersTable.teamId, team.id))
      .orderBy(playersTable.name),
  ]);

  const tasksWithNames = await Promise.all(
    tasks.map(async (task) => {
      if (!task.assignedToPlayerId) return { ...task, assignedToPlayerName: null };
      const player = players.find(p => p.id === task.assignedToPlayerId);
      return { ...task, assignedToPlayerName: player?.name ?? null };
    })
  );

  res.json({
    team,
    events,
    messages,
    tasks: tasksWithNames,
    players,
  });
});

export default router;
