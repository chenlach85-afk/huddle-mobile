import { Router, type IRouter } from "express";
import {
  db, usersTable, teamsTable, teamInvitationsTable, teamMembersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import type { Request, Response } from "express";

const router: IRouter = Router();

/* ─── helpers ─────────────────────────────────────────────── */

async function sendTeamInviteEmail(
  to: string, inviterName: string, teamName: string, sport: string, token: string,
): Promise<{ success: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { success: false, error: "RESEND_API_KEY not configured" };

  const from = process.env.RESEND_FROM_EMAIL ?? "Huddle <onboarding@resend.dev>";
  const basePath = process.env.BASE_PATH ?? "";
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  const link = `https://${domain}${basePath}/team-invite/${token}`;

  const subject = `${inviterName} invited you to join ${teamName} on Huddle`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
      <h2 style="color:#FF6B35;margin-bottom:8px;">You're invited to join a team!</h2>
      <p style="color:#333;"><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> (${sport}) on Huddle.</p>
      <a href="${link}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#FF6B35;color:white;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        Accept Invitation
      </a>
      <p style="margin-top:28px;color:#888;font-size:12px;">
        This invitation expires in 14 days. If you did not expect this email, you can safely ignore it.
      </p>
      <p style="color:#aaa;font-size:11px;word-break:break-all;">Or copy this link: ${link}</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (res.ok) return { success: true };
    const body = await res.json().catch(() => ({})) as { name?: string; message?: string };
    return { success: false, error: body.message ?? body.name ?? `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

async function canManageTeam(userId: number, teamId: number): Promise<boolean> {
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (user?.role === "admin") return true;
  const [team] = await db.select({ createdBy: teamsTable.createdBy }).from(teamsTable).where(eq(teamsTable.id, teamId));
  if (team?.createdBy === userId) return true;
  const [member] = await db.select({ role: teamMembersTable.role }).from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)));
  return member?.role === "coach" || member?.role === "assistant";
}

function inviteUrl(token: string): string {
  const basePath = process.env.BASE_PATH ?? "";
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  return `https://${domain}${basePath}/team-invite/${token}`;
}

/* ─── Create invitation ─────────────────────────────────── */

router.post("/teams/:teamId/invitations", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized to manage this team" }); return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const { type = "email", email } = req.body as { type?: "email" | "link"; email?: string };

  if (type === "email" && (!email || !email.includes("@"))) {
    res.status(400).json({ error: "Valid email required for email invitations" }); return;
  }

  const [inviter] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const [inv] = await db.insert(teamInvitationsTable).values({
    token, teamId, invitedByUserId: userId,
    inviteType: type, email: type === "email" ? (email ?? null) : null, expiresAt,
  }).returning();

  const url = inviteUrl(token);
  let emailSent = false;

  if (type === "email" && email) {
    const result = await sendTeamInviteEmail(email, inviter?.name ?? "Your coach", team.name, team.sport, token);
    if (result.success) {
      await db.update(teamInvitationsTable).set({ emailSentAt: new Date() }).where(eq(teamInvitationsTable.id, inv.id));
      emailSent = true;
    }
  }

  res.json({ id: inv.id, token, url, type, email, expiresAt, emailSent });
});

/* ─── List invitations ──────────────────────────────────── */

router.get("/teams/:teamId/invitations", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const invitations = await db.select({
    id: teamInvitationsTable.id,
    token: teamInvitationsTable.token,
    inviteType: teamInvitationsTable.inviteType,
    email: teamInvitationsTable.email,
    status: teamInvitationsTable.status,
    expiresAt: teamInvitationsTable.expiresAt,
    acceptedAt: teamInvitationsTable.acceptedAt,
    emailSentAt: teamInvitationsTable.emailSentAt,
    createdAt: teamInvitationsTable.createdAt,
    inviterName: usersTable.name,
  })
  .from(teamInvitationsTable)
  .leftJoin(usersTable, eq(teamInvitationsTable.invitedByUserId, usersTable.id))
  .where(eq(teamInvitationsTable.teamId, teamId))
  .orderBy(teamInvitationsTable.createdAt);

  const withUrls = invitations.map(inv => ({ ...inv, url: inviteUrl(inv.token) }));
  res.json(withUrls);
});

/* ─── Revoke invitation ─────────────────────────────────── */

router.post("/teams/:teamId/invitations/:id/revoke", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const invId = parseInt(req.params.id as string);
  if (isNaN(teamId) || isNaN(invId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [inv] = await db.update(teamInvitationsTable).set({ status: "revoked" })
    .where(and(eq(teamInvitationsTable.id, invId), eq(teamInvitationsTable.teamId, teamId)))
    .returning();

  if (!inv) { res.status(404).json({ error: "Invitation not found" }); return; }
  res.json({ success: true });
});

/* ─── Resend invitation ─────────────────────────────────── */

router.post("/teams/:teamId/invitations/:id/resend", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const invId = parseInt(req.params.id as string);
  if (isNaN(teamId) || isNaN(invId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [inv] = await db.select().from(teamInvitationsTable)
    .where(and(eq(teamInvitationsTable.id, invId), eq(teamInvitationsTable.teamId, teamId)));
  if (!inv) { res.status(404).json({ error: "Invitation not found" }); return; }
  if (!inv.email) { res.status(400).json({ error: "No email for this invitation" }); return; }

  const [team] = await db.select({ name: teamsTable.name, sport: teamsTable.sport }).from(teamsTable).where(eq(teamsTable.id, teamId));
  const [inviter] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  const newExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await db.update(teamInvitationsTable).set({ expiresAt: newExpiry, status: "pending" })
    .where(eq(teamInvitationsTable.id, invId));

  const result = await sendTeamInviteEmail(
    inv.email, inviter?.name ?? "Your coach", team?.name ?? "the team", team?.sport ?? "", inv.token,
  );
  if (result.success) {
    await db.update(teamInvitationsTable).set({ emailSentAt: new Date() }).where(eq(teamInvitationsTable.id, invId));
  }

  res.json({ success: true, emailSent: result.success, error: result.error });
});

/* ─── Get invite by token (public) ─────────────────────── */

router.get("/team-invite/:token", async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params as { token: string };

  const [inv] = await db.select({
    id: teamInvitationsTable.id,
    inviteType: teamInvitationsTable.inviteType,
    email: teamInvitationsTable.email,
    status: teamInvitationsTable.status,
    expiresAt: teamInvitationsTable.expiresAt,
    acceptedAt: teamInvitationsTable.acceptedAt,
    teamId: teamInvitationsTable.teamId,
    teamName: teamsTable.name,
    teamSport: teamsTable.sport,
    teamColor: teamsTable.avatarColor,
    teamJoinCode: teamsTable.joinCode,
    coachName: teamsTable.coachName,
    inviterName: usersTable.name,
    inviterEmail: usersTable.email,
  })
  .from(teamInvitationsTable)
  .leftJoin(teamsTable, eq(teamInvitationsTable.teamId, teamsTable.id))
  .leftJoin(usersTable, eq(teamInvitationsTable.invitedByUserId, usersTable.id))
  .where(eq(teamInvitationsTable.token, token));

  if (!inv) { res.status(404).json({ error: "Invitation not found" }); return; }

  if (inv.status === "pending" && inv.expiresAt && new Date() > new Date(inv.expiresAt)) {
    await db.update(teamInvitationsTable).set({ status: "expired" }).where(eq(teamInvitationsTable.id, inv.id));
    res.json({ ...inv, status: "expired" }); return;
  }

  res.json(inv);
});

/* ─── Accept invitation (authenticated) ─────────────────── */

router.post("/team-invite/:token/accept", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const { token } = req.params as { token: string };

  const [inv] = await db.select().from(teamInvitationsTable).where(eq(teamInvitationsTable.token, token));
  if (!inv) { res.status(404).json({ error: "Invitation not found" }); return; }
  if (inv.status === "revoked") { res.status(400).json({ error: "invitation_revoked" }); return; }
  if (inv.status === "accepted") {
    const [team] = await db.select({ joinCode: teamsTable.joinCode }).from(teamsTable).where(eq(teamsTable.id, inv.teamId));
    res.json({ success: true, joinCode: team?.joinCode, alreadyAccepted: true }); return;
  }
  if (inv.expiresAt && new Date() > new Date(inv.expiresAt)) {
    await db.update(teamInvitationsTable).set({ status: "expired" }).where(eq(teamInvitationsTable.id, inv.id));
    res.status(400).json({ error: "invitation_expired" }); return;
  }

  const [team] = await db.select({ joinCode: teamsTable.joinCode }).from(teamsTable).where(eq(teamsTable.id, inv.teamId));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  await db.insert(teamMembersTable).values({ teamId: inv.teamId, userId, role: "player" })
    .onConflictDoNothing();

  await db.update(teamInvitationsTable).set({
    status: "accepted", acceptedAt: new Date(), acceptedByUserId: userId,
  }).where(eq(teamInvitationsTable.id, inv.id));

  res.json({ success: true, joinCode: team.joinCode });
});

export default router;
