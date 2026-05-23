import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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
  const resolvedEmail = supabaseUser.email ?? (req.body as { email?: string }).email ?? "";
  const resolvedName =
    (supabaseUser.user_metadata?.full_name as string | undefined) ??
    (req.body as { name?: string }).name ??
    resolvedEmail.split("@")[0] ??
    "Coach";

  if (!resolvedEmail) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  // 1. Look up by Supabase UUID (primary path)
  const byId = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, supabaseUserId))
    .limit(1);

  if (byId[0]) {
    const [updated] = await db
      .update(usersTable)
      .set({ email: resolvedEmail, name: resolvedName })
      .where(eq(usersTable.clerkId, supabaseUserId))
      .returning();
    res.json(updated);
    return;
  }

  // 2. Fallback: look up by email (handles migrated users from old auth systems)
  if (resolvedEmail) {
    const byEmail = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, resolvedEmail))
      .limit(1);

    if (byEmail[0]) {
      // Migrate the clerk_id to the new Supabase UUID
      const [updated] = await db
        .update(usersTable)
        .set({ clerkId: supabaseUserId, email: resolvedEmail, name: resolvedName })
        .where(eq(usersTable.email, resolvedEmail))
        .returning();
      res.json(updated);
      return;
    }
  }

  // 3. Auto-create new users as coach
  const [created] = await db
    .insert(usersTable)
    .values({
      clerkId: supabaseUserId,
      email: resolvedEmail,
      name: resolvedName,
      role: "coach",
      accountStatus: "active",
    })
    .returning();

  res.json(created);
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
  const { language, notificationsEnabled, emailNotifications, pushNotifications, calendarReminderMinutes, name, imageUrl } = req.body as {
    language?: "en" | "he" | "es";
    notificationsEnabled?: boolean;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    calendarReminderMinutes?: string;
    name?: string;
    imageUrl?: string;
  };

  const updateData: Record<string, unknown> = {};
  if (language !== undefined) updateData.language = language;
  if (notificationsEnabled !== undefined) updateData.notificationsEnabled = notificationsEnabled;
  if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
  if (pushNotifications !== undefined) updateData.pushNotifications = pushNotifications;
  if (calendarReminderMinutes !== undefined) updateData.calendarReminderMinutes = calendarReminderMinutes;
  if (name !== undefined) updateData.name = name;
  if (imageUrl !== undefined) updateData.imageUrl = imageUrl;

  const [user] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, req.userId!))
    .returning();

  res.json(user);
});

export default router;
