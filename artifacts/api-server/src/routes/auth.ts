import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import type { Request, Response } from "express";
import { supabaseAdmin } from "../lib/supabase";
import type { AuthedRequest } from "../middlewares/requireAuth";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.post("/auth/sync", async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !supabaseUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const supabaseUserId = supabaseUser.id;
  const { email, name, role = "coach" } = req.body as {
    email: string;
    name: string;
    role?: string;
  };

  const resolvedEmail = email || supabaseUser.email || "";
  const resolvedName = name || resolvedEmail.split("@")[0] || "Coach";

  if (!resolvedEmail) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, supabaseUserId))
    .limit(1);

  const adminEmails = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const shouldBeAdmin = adminEmails.includes(resolvedEmail.toLowerCase());

  if (existing[0]) {
    const updateFields: { email: string; name: string; role?: "admin" | "coach" } = { email: resolvedEmail, name: resolvedName };
    if (shouldBeAdmin && existing[0].role !== "admin") {
      updateFields.role = "admin";
    }
    const [updated] = await db
      .update(usersTable)
      .set(updateFields)
      .where(eq(usersTable.clerkId, supabaseUserId))
      .returning();
    res.json(updated);
    return;
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(usersTable);

  if (Number(total) > 0 && !shouldBeAdmin) {
    res.status(403).json({ error: "Registration is by invitation only. Contact the platform administrator." });
    return;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      clerkId: supabaseUserId,
      email: resolvedEmail,
      name: resolvedName,
      role: shouldBeAdmin || Number(total) === 0 ? "admin" : (role as "coach" | "player"),
    })
    .returning();

  res.status(201).json(user);
});

router.get("/auth/me", requireAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(user);
});

router.patch("/auth/me", requireAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  const { language, notificationsEnabled, emailNotifications, pushNotifications, calendarReminderMinutes, name } = req.body as {
    language?: "en" | "he" | "es";
    notificationsEnabled?: boolean;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    calendarReminderMinutes?: string;
    name?: string;
  };

  const updateData: Record<string, unknown> = {};
  if (language !== undefined) updateData.language = language;
  if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;
  if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
  if (pushNotifications !== undefined) updateData.pushNotifications = pushNotifications;
  if (calendarReminderMinutes !== undefined) updateData.calendarReminderMinutes = calendarReminderMinutes;
  if (name !== undefined) updateData.name = name;

  const [user] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(user);
});

export default router;
