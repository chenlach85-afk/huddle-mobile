import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db, usersTable, platformInvitationsTable, adminAuditLogTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Request, Response } from "express";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router = Router();

/* ─── helpers ───────────────────────────────────────────── */

const requireAdminMiddleware = async (req: AuthedRequest, res: any, next: any): Promise<void> => {
  const userId = req.userId;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user || user.role !== "admin") { res.status(403).json({ error: "Admin access required" }); return; }
  next();
};

type EmailResult = { success: boolean; error?: string };

async function sendInvitationEmail(to: string, inviterName: string, role: string, token: string): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { success: false, error: "RESEND_API_KEY not configured" };

  const from = process.env.RESEND_FROM_EMAIL ?? "Huddle <onboarding@resend.dev>";
  const basePath = process.env.BASE_PATH ?? "";
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  const link = `https://${domain}${basePath}/invite/${token}`;

  const roleLabel = role === "admin" ? "Platform Admin" : "Coach";
  const subject = `You've been invited to Huddle as a ${roleLabel}`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;">
      <h2 style="color:#FF6B35;">Welcome to Huddle</h2>
      <p><strong>${inviterName}</strong> has invited you to join Huddle as a <strong>${roleLabel}</strong>.</p>
      <a href="${link}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FF6B35;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">
        Accept Invitation
      </a>
      <p style="margin-top:24px;color:#666;font-size:12px;">
        This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.
      </p>
      <p style="color:#666;font-size:12px;">Or copy this link: ${link}</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (res.ok) return { success: true };
    const body = await res.json().catch(() => ({})) as { name?: string; message?: string; statusCode?: number };
    const msg = body.message ?? body.name ?? `HTTP ${res.status}`;
    return { success: false, error: msg };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/* ─── Public: get invitation by token ───────────────────── */

router.get("/invitations/:token", async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params as { token: string };

  const [inv] = await db
    .select({
      id: platformInvitationsTable.id,
      email: platformInvitationsTable.email,
      invitedRole: platformInvitationsTable.invitedRole,
      status: platformInvitationsTable.status,
      expiresAt: platformInvitationsTable.expiresAt,
      createdAt: platformInvitationsTable.createdAt,
      inviterName: usersTable.name,
      inviterEmail: usersTable.email,
    })
    .from(platformInvitationsTable)
    .leftJoin(usersTable, eq(platformInvitationsTable.invitedByUserId, usersTable.id))
    .where(eq(platformInvitationsTable.token, token))
    .limit(1);

  if (!inv) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  // Auto-expire
  if (inv.status === "pending" && new Date(inv.expiresAt) < new Date()) {
    await db
      .update(platformInvitationsTable)
      .set({ status: "expired" })
      .where(eq(platformInvitationsTable.token, token));
    inv.status = "expired";
  }

  res.json(inv);
});

/* ─── Accept invitation (Clerk auth required, no DB user yet) ─ */

router.post("/invitations/:token/accept", async (req: Request, res: Response): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized — please sign in first" });
    return;
  }

  const { token } = req.params as { token: string };

  const [inv] = await db
    .select()
    .from(platformInvitationsTable)
    .where(eq(platformInvitationsTable.token, token))
    .limit(1);

  if (!inv) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }
  if (inv.status !== "pending") {
    res.status(400).json({ error: `Invitation is ${inv.status}` });
    return;
  }
  if (new Date(inv.expiresAt) < new Date()) {
    await db.update(platformInvitationsTable).set({ status: "expired" }).where(eq(platformInvitationsTable.token, token));
    res.status(400).json({ error: "Invitation has expired" });
    return;
  }

  // Check if this Clerk user already has a DB record
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (existing) {
    // Already registered — if they need a role upgrade, do it
    if (inv.invitedRole === "admin" && existing.role !== "admin") {
      await db.update(usersTable).set({ role: "admin" }).where(eq(usersTable.id, existing.id));
    }
    await db.update(platformInvitationsTable).set({
      status: "accepted",
      acceptedAt: new Date(),
      acceptedByUserId: existing.id,
    }).where(eq(platformInvitationsTable.token, token));

    res.json({ user: { ...existing, role: inv.invitedRole === "admin" ? "admin" : existing.role }, alreadyRegistered: true });
    return;
  }

  // Fetch Clerk user details via Clerk API
  const clerkKey = process.env.CLERK_SECRET_KEY;
  let email = inv.email;
  let name = "";

  if (clerkKey) {
    try {
      const clerkRes = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
        headers: { "Authorization": `Bearer ${clerkKey}` },
      });
      if (clerkRes.ok) {
        const clerkUser = await clerkRes.json() as { email_addresses?: { email_address: string }[]; first_name?: string; last_name?: string };
        email = clerkUser.email_addresses?.[0]?.email_address ?? inv.email;
        const firstName = clerkUser.first_name ?? "";
        const lastName = clerkUser.last_name ?? "";
        name = [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0] || "User";
      }
    } catch {
      // fall back to invitation email
    }
  }

  // Create the DB user
  const [newUser] = await db
    .insert(usersTable)
    .values({
      clerkId,
      email,
      name,
      role: inv.invitedRole as "coach" | "admin",
      accountStatus: "active",
    })
    .returning();

  // Mark invitation accepted
  await db.update(platformInvitationsTable).set({
    status: "accepted",
    acceptedAt: new Date(),
    acceptedByUserId: newUser.id,
  }).where(eq(platformInvitationsTable.token, token));

  // Audit log
  await db.insert(adminAuditLogTable).values({
    adminId: inv.invitedByUserId,
    action: "user_registered_via_invitation",
    targetUserId: newUser.id,
    metadata: { email, role: inv.invitedRole, invitationId: inv.id },
  });

  res.status(201).json({ user: newUser, alreadyRegistered: false });
});

/* ─── Auto-accept by email (for users who bypass invite page) ─ */

router.post("/invitations/auto-accept", async (req: Request, res: Response): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Check if already in DB (e.g. race condition or double-call)
  const [existing] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);
  if (existing) {
    res.json({ user: existing, alreadyRegistered: true });
    return;
  }

  // Fetch email + name from Clerk
  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) {
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  let email = "";
  let name = "";
  try {
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      headers: { Authorization: `Bearer ${clerkKey}` },
    });
    if (!clerkRes.ok) {
      res.status(500).json({ error: "Failed to fetch user from Clerk" });
      return;
    }
    const cu = (await clerkRes.json()) as {
      email_addresses?: { email_address: string }[];
      first_name?: string;
      last_name?: string;
    };
    email = cu.email_addresses?.[0]?.email_address ?? "";
    name =
      [cu.first_name ?? "", cu.last_name ?? ""].filter(Boolean).join(" ") ||
      email.split("@")[0] ||
      "User";
  } catch {
    res.status(500).json({ error: "Failed to fetch user details from Clerk" });
    return;
  }

  if (!email) {
    res.status(400).json({ error: "No email found for this user" });
    return;
  }

  // Find a pending invitation for this email
  const [inv] = await db
    .select()
    .from(platformInvitationsTable)
    .where(
      and(
        eq(platformInvitationsTable.email, email),
        eq(platformInvitationsTable.status, "pending"),
      ),
    )
    .limit(1);

  if (!inv) {
    res.status(404).json({ error: "No pending invitation found for this email" });
    return;
  }

  if (new Date(inv.expiresAt) < new Date()) {
    await db
      .update(platformInvitationsTable)
      .set({ status: "expired" })
      .where(eq(platformInvitationsTable.id, inv.id));
    res.status(400).json({ error: "Invitation has expired" });
    return;
  }

  // Create the DB user
  const [newUser] = await db
    .insert(usersTable)
    .values({
      clerkId,
      email,
      name,
      role: inv.invitedRole as "coach" | "admin",
      accountStatus: "active",
    })
    .returning();

  // Mark invitation accepted
  await db
    .update(platformInvitationsTable)
    .set({ status: "accepted", acceptedAt: new Date(), acceptedByUserId: newUser.id })
    .where(eq(platformInvitationsTable.id, inv.id));

  // Audit log
  await db.insert(adminAuditLogTable).values({
    adminId: inv.invitedByUserId,
    action: "user_registered_via_invitation",
    targetUserId: newUser.id,
    metadata: { email, role: inv.invitedRole, invitationId: inv.id },
  });

  res.status(201).json({ user: newUser, alreadyRegistered: false });
});

/* ─── Admin: email config check ─────────────────────────── */

router.get("/admin/invitations/email-status", requireAuth, requireAdminMiddleware, async (_req, res): Promise<void> => {
  res.json({ emailConfigured: !!process.env.RESEND_API_KEY });
});

/* ─── Admin: list invitations ───────────────────────────── */

router.get("/admin/invitations", requireAuth, requireAdminMiddleware, async (req, res): Promise<void> => {
  const invitations = await db
    .select({
      id: platformInvitationsTable.id,
      token: platformInvitationsTable.token,
      email: platformInvitationsTable.email,
      invitedRole: platformInvitationsTable.invitedRole,
      status: platformInvitationsTable.status,
      expiresAt: platformInvitationsTable.expiresAt,
      acceptedAt: platformInvitationsTable.acceptedAt,
      emailSentAt: platformInvitationsTable.emailSentAt,
      createdAt: platformInvitationsTable.createdAt,
      notes: platformInvitationsTable.notes,
      inviterName: usersTable.name,
      inviterEmail: usersTable.email,
    })
    .from(platformInvitationsTable)
    .leftJoin(usersTable, eq(platformInvitationsTable.invitedByUserId, usersTable.id))
    .orderBy(sql`${platformInvitationsTable.createdAt} desc`);

  // Auto-expire stale pending ones
  const now = new Date();
  const toExpire = invitations.filter(i => i.status === "pending" && new Date(i.expiresAt) < now);
  if (toExpire.length > 0) {
    for (const inv of toExpire) {
      inv.status = "expired";
    }
    await db
      .update(platformInvitationsTable)
      .set({ status: "expired" })
      .where(
        and(
          eq(platformInvitationsTable.status, "pending"),
          sql`${platformInvitationsTable.expiresAt} < now()`
        )
      );
  }

  res.json(invitations);
});

/* ─── Admin: create invitation ──────────────────────────── */

router.post("/admin/invitations", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const adminId = req.userId!;
  const { email, role, notes } = req.body as { email: string; role: string; notes?: string };

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }
  if (!["coach", "admin"].includes(role)) {
    res.status(400).json({ error: "Role must be coach or admin" });
    return;
  }

  // Check for existing pending invitation for this email
  const [existingInv] = await db
    .select({ id: platformInvitationsTable.id })
    .from(platformInvitationsTable)
    .where(and(eq(platformInvitationsTable.email, email), eq(platformInvitationsTable.status, "pending")))
    .limit(1);

  if (existingInv) {
    res.status(409).json({ error: "A pending invitation already exists for this email" });
    return;
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const [inv] = await db
    .insert(platformInvitationsTable)
    .values({
      token,
      email,
      invitedRole: role as "coach" | "admin",
      invitedByUserId: adminId,
      status: "pending",
      notes: notes ?? null,
      expiresAt,
    })
    .returning();

  // Audit log
  await db.insert(adminAuditLogTable).values({
    adminId,
    action: "invitation_created",
    metadata: { email, role, invitationId: inv.id },
  });

  // Try to send email
  const [admin] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, adminId)).limit(1);
  const emailResult = await sendInvitationEmail(email, admin?.name ?? "Admin", role, token);

  if (emailResult.success) {
    await db.update(platformInvitationsTable).set({ emailSentAt: new Date() }).where(eq(platformInvitationsTable.id, inv.id));
    inv.emailSentAt = new Date();
  }

  const basePath = process.env.BASE_PATH ?? "";
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  const inviteLink = `https://${domain}${basePath}/invite/${token}`;

  res.status(201).json({ ...inv, inviteLink, emailSent: emailResult.success, emailError: emailResult.error });
});

/* ─── Admin: resend invitation email ───────────────────── */

router.post("/admin/invitations/:id/resend", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const adminId = req.userId!;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [inv] = await db
    .select()
    .from(platformInvitationsTable)
    .where(and(eq(platformInvitationsTable.id, id), eq(platformInvitationsTable.status, "pending")))
    .limit(1);

  if (!inv) { res.status(404).json({ error: "Pending invitation not found" }); return; }

  const [admin] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, adminId)).limit(1);
  const emailResult = await sendInvitationEmail(inv.email, admin?.name ?? "Admin", inv.invitedRole, inv.token);

  const basePath2 = process.env.BASE_PATH ?? "";
  const domain2 = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  const inviteLink = `https://${domain2}${basePath2}/invite/${inv.token}`;

  if (!emailResult.success) {
    res.status(502).json({ error: emailResult.error ?? "Failed to send email", inviteLink });
    return;
  }

  await db.update(platformInvitationsTable).set({ emailSentAt: new Date() }).where(eq(platformInvitationsTable.id, id));
  res.json({ success: true, inviteLink });
});

/* ─── Admin: revoke invitation ──────────────────────────── */

router.delete("/admin/invitations/:id", requireAuth, requireAdminMiddleware, async (req: AuthedRequest, res): Promise<void> => {
  const adminId = req.userId!;
  const id = parseInt(req.params.id as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [inv] = await db
    .update(platformInvitationsTable)
    .set({ status: "revoked" })
    .where(and(eq(platformInvitationsTable.id, id), eq(platformInvitationsTable.status, "pending")))
    .returning();

  if (!inv) {
    res.status(404).json({ error: "Pending invitation not found" });
    return;
  }

  await db.insert(adminAuditLogTable).values({
    adminId,
    action: "invitation_revoked",
    metadata: { email: inv.email, role: inv.invitedRole, invitationId: inv.id },
  });

  res.json({ success: true });
});

export default router;
