import { Router, type IRouter } from "express";
import { db, usersTable, teamsTable, eventsTable, tasksTable, messagesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const requireAdmin = async (req: AuthedRequest, res: any, next: any): Promise<void> => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
};

router.get("/admin/kpis", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const [[{ total: totalUsers }], [{ total: totalTeams }], [{ total: totalEvents }], [{ total: totalTasks }], [{ total: totalMessages }]] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(usersTable),
    db.select({ total: sql<number>`count(*)::int` }).from(teamsTable),
    db.select({ total: sql<number>`count(*)::int` }).from(eventsTable),
    db.select({ total: sql<number>`count(*)::int` }).from(tasksTable),
    db.select({ total: sql<number>`count(*)::int` }).from(messagesTable),
  ]);

  const recentUsers = await db
    .select({
      id: usersTable.id,
      clerkId: usersTable.clerkId,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(sql`${usersTable.createdAt} desc`)
    .limit(10);

  res.json({
    totalUsers,
    totalTeams,
    totalEvents,
    totalTasks,
    totalMessages,
    recentUsers,
  });
});

router.get("/admin/users", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      clerkId: usersTable.clerkId,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json(users);
});

router.patch("/admin/users/:userId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId as string);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }
  const { role } = req.body as { role?: string };
  if (!role || !["coach", "player", "admin"].includes(role)) {
    res.status(400).json({ error: "Valid role required: coach, player, admin" });
    return;
  }
  const [user] = await db
    .update(usersTable)
    .set({ role: role as "coach" | "player" | "admin" })
    .where(eq(usersTable.id, userId))
    .returning({
      id: usersTable.id,
      clerkId: usersTable.clerkId,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
      createdAt: usersTable.createdAt,
    });
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

router.delete("/admin/users/:userId", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId as string);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  res.sendStatus(204);
});

export default router;
