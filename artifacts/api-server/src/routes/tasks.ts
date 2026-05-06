import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable, playersTable, teamsTable, teamMembersTable } from "@workspace/db";
import {
  ListTasksParams,
  CreateTaskParams,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { assertTeamAccess } from "../helpers/teamAccess";
import { createNotification } from "./notifications";

const router: IRouter = Router();

async function enrichTask(task: typeof tasksTable.$inferSelect) {
  if (!task.assignedToPlayerId) return { ...task, assignedToPlayerName: null };
  const [player] = await db
    .select({ name: playersTable.name })
    .from(playersTable)
    .where(eq(playersTable.id, task.assignedToPlayerId));
  return { ...task, assignedToPlayerName: player?.name ?? null };
}

async function notifyTeamMembers(teamId: number, title: string, body: string, relatedId: number) {
  try {
    const members = await db.select({ userId: teamMembersTable.userId })
      .from(teamMembersTable)
      .where(eq(teamMembersTable.teamId, teamId));
    await Promise.all(members.map(m =>
      createNotification({ userId: m.userId, type: "task", title, body, relatedId, relatedType: "task" })
        .catch(() => {})
    ));
  } catch {}
}

router.get("/teams/:teamId/tasks", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = ListTasksParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.teamId, teamId))
    .orderBy(tasksTable.createdAt);

  const enriched = await Promise.all(tasks.map(enrichTask));
  res.json(enriched);
});

router.post("/teams/:teamId/tasks", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = CreateTaskParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const d = parsed.data;
  const [task] = await db
    .insert(tasksTable)
    .values({
      teamId,
      title: d.title,
      description: d.description ?? null,
      assignedToPlayerId: d.assignedToPlayerId ?? null,
      dueDate: d.dueDate ?? null,
      status: d.status ?? "pending",
      priority: d.priority ?? "medium",
    })
    .returning();

  const [team] = await db.select({ name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.id, teamId));
  notifyTeamMembers(teamId, `New task: ${d.title}`, `${team?.name ?? "Your team"} — ${d.title}`, task.id);

  const enriched = await enrichTask(task);
  res.status(201).json(enriched);
});

router.patch("/tasks/:taskId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse({ taskId: req.params.taskId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select({ teamId: tasksTable.teamId }).from(tasksTable).where(eq(tasksTable.id, params.data.taskId));
  if (!existing) { res.status(404).json({ error: "Task not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.title !== undefined) updates.title = d.title;
  if (d.description !== undefined) updates.description = d.description;
  if (d.assignedToPlayerId !== undefined) updates.assignedToPlayerId = d.assignedToPlayerId;
  if (d.dueDate !== undefined) updates.dueDate = d.dueDate;
  if (d.status !== undefined) updates.status = d.status;
  if (d.priority !== undefined) updates.priority = d.priority;

  const [task] = await db
    .update(tasksTable)
    .set(updates)
    .where(eq(tasksTable.id, params.data.taskId))
    .returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const enriched = await enrichTask(task);
  res.json(enriched);
});

router.delete("/tasks/:taskId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse({ taskId: req.params.taskId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select({ teamId: tasksTable.teamId }).from(tasksTable).where(eq(tasksTable.id, params.data.taskId));
  if (!existing) { res.status(404).json({ error: "Task not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const [task] = await db.delete(tasksTable).where(eq(tasksTable.id, params.data.taskId)).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  res.sendStatus(204);
});

export default router;
