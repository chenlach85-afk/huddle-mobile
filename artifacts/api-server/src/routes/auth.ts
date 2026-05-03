import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

router.post("/auth/sync", async (req: Request, res: Response): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { email, name, role = "coach" } = req.body as {
    email: string;
    name: string;
    role?: string;
  };

  if (!email || !name) {
    res.status(400).json({ error: "email and name are required" });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (existing[0]) {
    res.json(existing[0]);
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      clerkId,
      email,
      name,
      role: role as "coach" | "player" | "admin",
    })
    .returning();

  res.status(201).json(user);
});

router.get("/auth/me", async (req: Request, res: Response): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.patch("/auth/me", async (req: Request, res: Response): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { language, notificationsEnabled, emailNotifications, pushNotifications, calendarReminderMinutes } = req.body as {
    language?: "en" | "he" | "es";
    notificationsEnabled?: boolean;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    calendarReminderMinutes?: string;
  };

  const updateData: Record<string, unknown> = {};
  if (language !== undefined) updateData.language = language;
  if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;
  if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
  if (pushNotifications !== undefined) updateData.pushNotifications = pushNotifications;
  if (calendarReminderMinutes !== undefined) updateData.calendarReminderMinutes = calendarReminderMinutes;

  const [user] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.clerkId, clerkId))
    .returning();

  res.json(user);
});

export default router;
