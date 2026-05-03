import { Router } from "express";
import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import type { Response } from "express";

const router = Router();

router.get("/notifications", requireAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  const notifications = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);

  res.json(notifications);
});

router.patch("/notifications/:id/read", requireAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  const userId = req.userId!;
  const notifId = parseInt(req.params.id);

  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, notifId), eq(notificationsTable.userId, userId)));

  res.json({ success: true });
});

router.patch("/notifications/read-all", requireAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  const userId = req.userId!;

  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(eq(notificationsTable.userId, userId));

  res.json({ success: true });
});

export default router;

export async function createNotification(params: {
  userId: number;
  type: "task" | "event" | "message" | "general";
  title: string;
  body: string;
  relatedId?: number;
  relatedType?: string;
}) {
  await db.insert(notificationsTable).values(params);
}
