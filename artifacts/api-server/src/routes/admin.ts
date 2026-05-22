import { Router, type IRouter } from "express";
import {
  db, usersTable, teamsTable, eventsTable, tasksTable, messagesTable,
  adminAuditLogTable, playersTable, attendanceTable, teamMembersTable,
  notificationsTable, filesTable,
} from "@workspace/db";
import { eq, ilike, or, and, sql, ne, count } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

/* ─── helpers ─────────────────────────────────────────────── */

const requireAdminMiddleware = async (req: AuthedRequest, res: any, next: any): Promise<void> => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
  next();
};

async function auditLog(adminId: number, action: typeof adminAuditLogTable.$inferInsert["action"], opts: {
  targetUserId?: number;
  targetTeamId?: number;
  metadata?: object;
}) {
  await db.insert(adminAuditLogTable).values({ adminId, action, ...opts });
}

async function supabaseBan(supabaseUserId: string, banned: boolean) {
  const { supabaseAdmin } = await import("../lib/supabase");
  if (banned) {
    await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, { ban_duration: "876600h" }).catch(() => null);
  } else {
    await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, { ban_duration: "none" }).catch(() => null);
  }
}

async function supabaseDeleteUser(supabaseUserId: string) {
  const { supabaseAdmin } = await import("../lib/supabase");
  await supabaseAdmin.auth.admin.deleteUser(supabaseUserId).catch(() => null);
}

/* ─── KPIs ─────────────────────────────────────────────────── */

router.get("/admin/kpis", requireAuth, requireAdminMiddleware, async (_req, res): Promise<void> => {
  const [[{ total: totalUsers }], [{ total: totalTeams }], [{ total: totalEvents }], [{ total: totalTasks }], [{ total: totalMessages }], [{ total: activeUsers }]] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(usersTable),
    db.select({ total: sql<number>`count(*)::int` }).from(teamsTable),
    db.select({ total: sql<number>`count(*)::int` }).from(eventsTable),
    db.select({ total: sql<number>`count(*)::int` }).from(tasksTable),
    db.select({ total: sql<number>`count(*)::int` }).from(messagesTable),
    db.select({ total: sql<number>`count(*)::int` }).from(usersTable).where(eq(usersTable.accountStatus, "active")),
  ]);

  const recentUsers = await db
    .select({
      id: usersTable.id, clerkId: usersTable.clerkId, email: usersTable.email,
      name: usersTable.name, role: usersTable.role, accountStatus: usersTable.accountStatus, createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(sql`${usersTable.createdAt} desc`)
    .limit(10);

  res.json({ totalUsers, totalTeams, totalEvents, totalTasks, totalMessages, activeUsers, recentUsers });
});

/* ─── List users ────────────────────────────────────────────── */

router.get("/admin/users", requireAuth, requireAdminMiddleware, async (req, res): Promise<void> => {
  const { status = "all", search, isAdmin, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const conditions: ReturnType<typeof eq>[] = [];
  if (status === "active") conditions.push(eq(usersTable.accountStatus, "active"));
  else if (status === "suspended") conditions.push(eq(usersTable.accountStatus, "suspended"));
  else if (status === "deleted") conditions.push(eq(usersTable.accountStatus, "deleted"));
  if (isAdmin === "true") conditions.push(eq(usersTable.role, "admin"));

  const searchCondition = search
    ? or(ilike(usersTable.name, `%${search}%`), ilike(usersTable.email, `%${search}%`))
    : undefined;

  const whereClause = searchCondition
    ? (conditions.length > 0 ? and(...conditions, searchCondition) : searchCondition)
    : (conditions.length > 0 ? and(...conditions) : undefined);

  const [users, [{ total }]] = await Promise.all([
    db.select({
      id: usersTable.id, clerkId: usersTable.clerkId, email: usersTable.email,
      name: usersTable.name, role: usersTable.role, language: usersTable.language,
      accountStatus: usersTable.accountStatus,
      deletedAt: usersTable.deletedAt, suspendedAt: usersTable.suspendedAt,
      suspensionReason: usersTable.suspensionReason, deletionReason: usersTable.deletionReason,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(whereClause)
    .orderBy(sql`${usersTable.createdAt} desc`)
    .limit(limitNum)
    .offset(offset),

    db.select({ total: sql<number>`count(*)::int` }).from(usersTable).where(whereClause),
  ]);

  res.json({ users, total, page: pageNum, limit: limitNum });
});

/* ─── User detail ───────────────────────────────────────────── */

router.get("/admin/users/:userId", requireAuth, requireAdminMiddleware, async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId as string);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [teamsOwned, auditLog] = await Promise.all([
    db.select({
      id: teamsTable.id, name: teamsTable.name, sport: teamsTable.sport,
      playerCount: teamsTable.playerCount, archivedAt: teamsTable.archivedAt, avatarColor: teamsTable.avatarColor,
    }).from(teamsTable).where(eq(teamsTable.createdBy, userId)),

    db.select().from(adminAuditLogTable)
      .where(eq(adminAuditLogTable.targetUserId, userId))
      .orderBy(sql`${adminAuditLogTable.createdAt} desc`)
      .limit(50),
  ]);

  res.json({ user, teamsOwned, auditLog });
});

/* ─── Edit user ─────────────────────────────────────────────── */

router.patch("/admin/users/:userId", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const adminId = req.userId!;
  const userId = parseInt(req.params.userId as string);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const { role, name, language } = req.body as { role?: string; name?: string; language?: string };

  if (role) {
    if (!["coach", "player", "admin"].includes(role)) {
      res.status(400).json({ error: "Valid role required: coach, player, admin" }); return;
    }
    if (userId === adminId && role !== "admin") {
      res.status(400).json({ error: "cannot_self_demote" }); return;
    }
    if (role !== "admin") {
      const [{ adminCount }] = await db
        .select({ adminCount: sql<number>`count(*)::int` })
        .from(usersTable)
        .where(and(eq(usersTable.role, "admin"), eq(usersTable.accountStatus, "active")));
      const [target] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
      if (target?.role === "admin" && adminCount <= 1) {
        res.status(400).json({ error: "cannot_demote_last_admin" }); return;
      }
    }
    const prevRole = (await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)))[0]?.role;
    await auditLog(adminId, "user_role_changed", { targetUserId: userId, metadata: { from: prevRole, to: role } });
  }

  const updateData: Record<string, unknown> = {};
  if (role) updateData.role = role;
  if (name) updateData.name = name;
  if (language && ["en", "he", "es"].includes(language)) updateData.language = language;

  if (Object.keys(updateData).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }

  if (name || language) await auditLog(adminId, "user_edited", { targetUserId: userId, metadata: updateData });

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, userId)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(user);
});

/* ─── Suspend ───────────────────────────────────────────────── */

router.post("/admin/users/:userId/suspend", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const adminId = req.userId!;
  const userId = parseInt(req.params.userId as string);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }
  if (userId === adminId) { res.status(400).json({ error: "cannot_self_suspend" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.accountStatus === "suspended") { res.status(400).json({ error: "User already suspended" }); return; }

  const { reason } = req.body as { reason?: string };

  await db.update(usersTable).set({
    accountStatus: "suspended",
    suspendedAt: new Date(),
    suspendedBy: adminId,
    suspensionReason: reason ?? null,
  }).where(eq(usersTable.id, userId));

  await supabaseBan(target.clerkId, true);
  await auditLog(adminId, "user_suspended", { targetUserId: userId, metadata: { reason } });

  res.json({ success: true });
});

/* ─── Reactivate ────────────────────────────────────────────── */

router.post("/admin/users/:userId/reactivate", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const adminId = req.userId!;
  const userId = parseInt(req.params.userId as string);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }

  const [target] = await db.select({ clerkId: usersTable.clerkId, accountStatus: usersTable.accountStatus }).from(usersTable).where(eq(usersTable.id, userId));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  await db.update(usersTable).set({
    accountStatus: "active",
    suspendedAt: null,
    suspendedBy: null,
    suspensionReason: null,
  }).where(eq(usersTable.id, userId));

  await supabaseBan(target.clerkId, false);
  await auditLog(adminId, "user_reactivated", { targetUserId: userId });

  res.json({ success: true });
});

/* ─── Soft delete ───────────────────────────────────────────── */

router.post("/admin/users/:userId/soft-delete", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const adminId = req.userId!;
  const userId = parseInt(req.params.userId as string);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }
  if (userId === adminId) { res.status(400).json({ error: "cannot_self_delete" }); return; }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.accountStatus === "deleted") { res.status(400).json({ error: "User already deleted" }); return; }

  const { reason, teamAction, transferToUserId } = req.body as {
    reason?: string;
    teamAction: "archive" | "transfer" | "delete";
    transferToUserId?: number;
  };

  if (!["archive", "transfer", "delete"].includes(teamAction)) {
    res.status(400).json({ error: "Invalid teamAction. Must be: archive, transfer, delete" }); return;
  }
  if (teamAction === "transfer" && !transferToUserId) {
    res.status(400).json({ error: "transferToUserId required for transfer action" }); return;
  }

  const ownedTeams = await db.select().from(teamsTable).where(eq(teamsTable.createdBy, userId));

  for (const team of ownedTeams) {
    if (teamAction === "archive") {
      await db.update(teamsTable).set({ archivedAt: new Date(), archivedBy: adminId, archivedReason: `Owner soft-deleted` }).where(eq(teamsTable.id, team.id));
      await auditLog(adminId, "team_archived", { targetUserId: userId, targetTeamId: team.id, metadata: { teamName: team.name } });
    } else if (teamAction === "transfer" && transferToUserId) {
      const [newOwner] = await db.select({ id: usersTable.id, accountStatus: usersTable.accountStatus }).from(usersTable).where(eq(usersTable.id, transferToUserId));
      if (!newOwner || newOwner.accountStatus === "deleted") { res.status(400).json({ error: "Transfer target user not found or deleted" }); return; }
      await db.update(teamsTable).set({ createdBy: transferToUserId }).where(eq(teamsTable.id, team.id));
      await auditLog(adminId, "team_transferred", { targetUserId: userId, targetTeamId: team.id, metadata: { to: transferToUserId } });
    } else if (teamAction === "delete") {
      await db.delete(attendanceTable).where(
        sql`event_id IN (SELECT id FROM events WHERE team_id = ${team.id})`
      );
      await db.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
      await db.delete(eventsTable).where(eq(eventsTable.teamId, team.id));
      await db.delete(tasksTable).where(eq(tasksTable.teamId, team.id));
      await db.delete(messagesTable).where(eq(messagesTable.teamId, team.id));
      await db.delete(playersTable).where(eq(playersTable.teamId, team.id));
      await db.delete(teamMembersTable).where(eq(teamMembersTable.teamId, team.id));
      await db.delete(filesTable).where(eq(filesTable.teamId, team.id));
      await db.delete(teamsTable).where(eq(teamsTable.id, team.id));
      await auditLog(adminId, "team_deleted", { targetUserId: userId, targetTeamId: team.id, metadata: { teamName: team.name } });
    }
  }

  await db.update(usersTable).set({
    name: "Deleted User",
    email: `deleted-${userId}@deleted.local`,
    accountStatus: "deleted",
    deletedAt: new Date(),
    deletedBy: adminId,
    deletionReason: reason ?? null,
    suspendedAt: null,
    suspendedBy: null,
    suspensionReason: null,
  }).where(eq(usersTable.id, userId));

  await supabaseBan(target.clerkId, true);
  await auditLog(adminId, "user_soft_deleted", {
    targetUserId: userId,
    metadata: { reason, teamAction, teamsAffected: ownedTeams.length, originalName: target.name, originalEmail: target.email },
  });

  res.json({ success: true });
});

/* ─── Hard delete ───────────────────────────────────────────── */

router.post("/admin/users/:userId/hard-delete", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const adminId = req.userId!;
  const userId = parseInt(req.params.userId as string);
  if (isNaN(userId)) { res.status(400).json({ error: "Invalid userId" }); return; }
  if (userId === adminId) { res.status(400).json({ error: "cannot_self_delete" }); return; }

  const { reason, teamAction, transferToUserId, confirmationText } = req.body as {
    reason?: string;
    teamAction: "delete" | "transfer";
    transferToUserId?: number;
    confirmationText: string;
  };

  if (confirmationText !== "DELETE PERMANENTLY") {
    res.status(400).json({ error: "confirmation_mismatch" }); return;
  }
  if (!reason || reason.trim().length < 10) {
    res.status(400).json({ error: "Reason required (min 10 chars)" }); return;
  }
  if (!["delete", "transfer"].includes(teamAction)) {
    res.status(400).json({ error: "Invalid teamAction: delete or transfer" }); return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target) { res.status(404).json({ error: "User not found" }); return; }

  const [{ adminCount }] = await db.select({ adminCount: sql<number>`count(*)::int` })
    .from(usersTable).where(and(eq(usersTable.role, "admin"), eq(usersTable.accountStatus, "active")));
  if (target.role === "admin" && adminCount <= 1) {
    res.status(400).json({ error: "cannot_delete_last_admin" }); return;
  }

  await auditLog(adminId, "user_hard_deleted", {
    targetUserId: userId,
    metadata: { reason, teamAction, originalName: target.name, originalEmail: target.email, clerkId: target.clerkId },
  });

  const ownedTeams = await db.select().from(teamsTable).where(eq(teamsTable.createdBy, userId));
  for (const team of ownedTeams) {
    if (teamAction === "transfer" && transferToUserId) {
      await db.update(teamsTable).set({ createdBy: transferToUserId }).where(eq(teamsTable.id, team.id));
    } else {
      await db.delete(attendanceTable).where(sql`event_id IN (SELECT id FROM events WHERE team_id = ${team.id})`);
      await db.delete(eventsTable).where(eq(eventsTable.teamId, team.id));
      await db.delete(tasksTable).where(eq(tasksTable.teamId, team.id));
      await db.delete(messagesTable).where(eq(messagesTable.teamId, team.id));
      await db.delete(playersTable).where(eq(playersTable.teamId, team.id));
      await db.delete(teamMembersTable).where(eq(teamMembersTable.teamId, team.id));
      await db.delete(filesTable).where(eq(filesTable.teamId, team.id));
      await db.delete(teamsTable).where(eq(teamsTable.id, team.id));
    }
  }

  await db.delete(notificationsTable).where(eq(notificationsTable.userId, userId));
  await supabaseDeleteUser(target.clerkId);
  await db.delete(usersTable).where(eq(usersTable.id, userId));

  res.json({ success: true });
});

/* ─── Archive team ──────────────────────────────────────────── */

router.post("/admin/teams/:teamId/archive", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const adminId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }
  const { reason } = req.body as { reason?: string };
  const [team] = await db.update(teamsTable).set({ archivedAt: new Date(), archivedBy: adminId, archivedReason: reason ?? null }).where(eq(teamsTable.id, teamId)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  await auditLog(adminId, "team_archived", { targetTeamId: teamId, metadata: { reason } });
  res.json({ success: true });
});

/* ─── Transfer team ─────────────────────────────────────────── */

router.post("/admin/teams/:teamId/transfer", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const adminId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }
  const { newOwnerUserId, reason } = req.body as { newOwnerUserId: number; reason?: string };
  if (!newOwnerUserId) { res.status(400).json({ error: "newOwnerUserId required" }); return; }
  const [newOwner] = await db.select({ id: usersTable.id, accountStatus: usersTable.accountStatus }).from(usersTable).where(eq(usersTable.id, newOwnerUserId));
  if (!newOwner || newOwner.accountStatus === "deleted") { res.status(400).json({ error: "New owner not found or deleted" }); return; }
  await db.update(teamsTable).set({ createdBy: newOwnerUserId }).where(eq(teamsTable.id, teamId));
  await auditLog(adminId, "team_transferred", { targetTeamId: teamId, metadata: { to: newOwnerUserId, reason } });
  res.json({ success: true });
});

/* ─── Audit log ─────────────────────────────────────────────── */

router.get("/admin/audit-log", requireAuth, requireAdminMiddleware, async (req, res): Promise<void> => {
  const { action, page = "1", limit = "50" } = req.query as Record<string, string>;
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const whereClause = action ? eq(adminAuditLogTable.action, action as typeof adminAuditLogTable.$inferInsert["action"]) : undefined;

  const [logs, [{ total }]] = await Promise.all([
    db.select({
      id: adminAuditLogTable.id,
      action: adminAuditLogTable.action,
      targetUserId: adminAuditLogTable.targetUserId,
      targetTeamId: adminAuditLogTable.targetTeamId,
      metadata: adminAuditLogTable.metadata,
      createdAt: adminAuditLogTable.createdAt,
      adminId: adminAuditLogTable.adminId,
      adminName: usersTable.name,
      adminEmail: usersTable.email,
    })
    .from(adminAuditLogTable)
    .leftJoin(usersTable, eq(adminAuditLogTable.adminId, usersTable.id))
    .where(whereClause)
    .orderBy(sql`${adminAuditLogTable.createdAt} desc`)
    .limit(limitNum)
    .offset(offset),

    db.select({ total: sql<number>`count(*)::int` }).from(adminAuditLogTable).where(whereClause),
  ]);

  res.json({ logs, total, page: pageNum, limit: limitNum });
});

/* ─── GET /api/admin/email-diagnostic ─────────────────────── */
router.get("/admin/email-diagnostic", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    res.json({ ok: false, error: "RESEND_API_KEY not set", keyPresent: false });
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "Huddle <onboarding@resend.dev>";
  const to = "delivered@resend.dev";

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: "Huddle email diagnostic test",
        html: "<p>This is a diagnostic test email from Huddle Pro. If you see this, email sending is configured correctly.</p>",
      }),
    });
    const body = await r.json().catch(() => ({}));
    if (r.ok) {
      res.json({ ok: true, keyPresent: true, from, to, resendId: (body as any).id });
    } else {
      res.json({ ok: false, keyPresent: true, from, to, status: r.status, error: (body as any).message ?? JSON.stringify(body) });
    }
  } catch (err) {
    res.json({ ok: false, keyPresent: true, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
