import { Router, type IRouter } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, usersTable, teamsTable, teamMembersTable, teamInvitationsTable } from "@workspace/db";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function isTeamOwner(userId: number, teamId: number): Promise<boolean> {
  const [team] = await db.select({ createdBy: teamsTable.createdBy }).from(teamsTable).where(eq(teamsTable.id, teamId));
  return team?.createdBy === userId;
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

/* ─── GET /teams/:teamId/coaches  ───────────────────────── */

router.get("/teams/:teamId/coaches", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [team] = await db.select({ createdBy: teamsTable.createdBy, name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const members = await db.select({
    id: teamMembersTable.id,
    userId: teamMembersTable.userId,
    role: teamMembersTable.role,
    coachTitle: teamMembersTable.coachTitle,
    createdAt: teamMembersTable.createdAt,
    name: usersTable.name,
    email: usersTable.email,
  })
  .from(teamMembersTable)
  .leftJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
  .where(and(
    eq(teamMembersTable.teamId, teamId),
    ne(teamMembersTable.role, "player")
  ));

  const coaches = members.map(m => ({
    ...m,
    isOwner: m.userId === team.createdBy,
  }));

  const pendingInvites = await db.select({
    id: teamInvitationsTable.id,
    token: teamInvitationsTable.token,
    email: teamInvitationsTable.email,
    phone: teamInvitationsTable.phone,
    invitedRole: teamInvitationsTable.invitedRole,
    status: teamInvitationsTable.status,
    expiresAt: teamInvitationsTable.expiresAt,
    createdAt: teamInvitationsTable.createdAt,
  })
  .from(teamInvitationsTable)
  .where(and(
    eq(teamInvitationsTable.teamId, teamId),
    eq(teamInvitationsTable.status, "pending"),
    ne(teamInvitationsTable.invitedRole, "player")
  ));

  const pendingWithUrls = pendingInvites.map(inv => ({ ...inv, url: inviteUrl(inv.token) }));

  res.json({ coaches, pendingInvites: pendingWithUrls, ownerId: team.createdBy });
});

/* ─── POST /teams/:teamId/coaches/invite  ───────────────── */

router.post("/teams/:teamId/coaches/invite", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await isTeamOwner(userId, teamId))) {
    res.status(403).json({ error: "Only the team owner can invite coaches" }); return;
  }

  const [team] = await db.select({ name: teamsTable.name, sport: teamsTable.sport }).from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const { type = "link", email, phone, invitedRole = "coach" } = req.body as {
    type?: "email" | "link"; email?: string; phone?: string; invitedRole?: string;
  };

  const validRole = ["coach", "assistant"].includes(invitedRole) ? invitedRole : "coach";

  if (type === "email" && (!email || !email.includes("@"))) {
    res.status(400).json({ error: "Valid email required for email invitations" }); return;
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const [inv] = await db.insert(teamInvitationsTable).values({
    token, teamId, invitedByUserId: userId,
    inviteType: type, invitedRole: validRole as "coach" | "assistant",
    email: type === "email" ? (email ?? null) : null,
    phone: phone ?? null,
    expiresAt,
  }).returning();

  const url = inviteUrl(token);
  let emailSent = false;

  if (type === "email" && email) {
    const key = process.env.RESEND_API_KEY;
    if (key) {
      const from = process.env.RESEND_FROM_EMAIL ?? "Huddle <onboarding@resend.dev>";
      const link = url;
      const subject = `You've been invited as a coach for ${team.name} on Huddle`;
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
          <h2 style="color:#FF6B35;">You're invited to coach!</h2>
          <p>You've been invited to join <strong>${team.name}</strong> as a ${validRole === "assistant" ? "assistant coach" : "coach"} on Huddle.</p>
          <a href="${link}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#FF6B35;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">
            Accept Invitation
          </a>
        </div>
      `;
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: email, subject, html }),
        });
        if (emailRes.ok) {
          await db.update(teamInvitationsTable).set({ emailSentAt: new Date() }).where(eq(teamInvitationsTable.id, inv.id));
          emailSent = true;
        }
      } catch {}
    }
  }

  res.json({ id: inv.id, token, url, type, email, phone, invitedRole: validRole, expiresAt, emailSent });
});

/* ─── PATCH /teams/:teamId/coaches/:coachUserId/title ──────── */

router.patch("/teams/:teamId/coaches/:coachUserId/title", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const requesterId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const targetUserId = parseInt(req.params.coachUserId as string);
  if (isNaN(teamId) || isNaN(targetUserId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeam(requesterId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const { title } = req.body as { title?: string | null };

  const [updated] = await db.update(teamMembersTable)
    .set({ coachTitle: title ?? null })
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, targetUserId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Coach not found on this team" }); return; }
  res.json({ success: true, coachTitle: updated.coachTitle });
});

/* ─── PATCH /teams/:teamId/coaches/:userId/role  ────────── */

router.patch("/teams/:teamId/coaches/:coachUserId/role", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const requesterId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const targetUserId = parseInt(req.params.coachUserId as string);
  if (isNaN(teamId) || isNaN(targetUserId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await isTeamOwner(requesterId, teamId))) {
    res.status(403).json({ error: "Only the team owner can change coach roles" }); return;
  }

  const { role } = req.body as { role?: string };
  if (!["coach", "assistant"].includes(role ?? "")) {
    res.status(400).json({ error: "Role must be coach or assistant" }); return;
  }

  const [updated] = await db.update(teamMembersTable)
    .set({ role: role as "coach" | "assistant" })
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, targetUserId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Coach not found on this team" }); return; }
  res.json({ success: true, role });
});

/* ─── DELETE /teams/:teamId/coaches/:userId  ────────────── */

router.delete("/teams/:teamId/coaches/:coachUserId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const requesterId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const targetUserId = parseInt(req.params.coachUserId as string);
  if (isNaN(teamId) || isNaN(targetUserId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await isTeamOwner(requesterId, teamId))) {
    res.status(403).json({ error: "Only the team owner can remove coaches" }); return;
  }

  if (targetUserId === requesterId) {
    res.status(400).json({ error: "Cannot remove yourself as owner" }); return;
  }

  const [removed] = await db.delete(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, targetUserId)))
    .returning();

  if (!removed) { res.status(404).json({ error: "Coach not found on this team" }); return; }
  res.json({ success: true });
});

/* ─── POST /teams/:teamId/transfer-ownership  ───────────── */

router.post("/teams/:teamId/transfer-ownership", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const requesterId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await isTeamOwner(requesterId, teamId))) {
    res.status(403).json({ error: "Only the current owner can transfer ownership" }); return;
  }

  const { newOwnerId, confirm } = req.body as { newOwnerId?: number; confirm?: boolean };
  if (!newOwnerId || !confirm) {
    res.status(400).json({ error: "newOwnerId and confirm:true required" }); return;
  }

  const [member] = await db.select({ role: teamMembersTable.role }).from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, newOwnerId)));
  if (!member) { res.status(400).json({ error: "New owner must already be a team member" }); return; }

  await db.update(teamsTable).set({ createdBy: newOwnerId }).where(eq(teamsTable.id, teamId));

  await db.update(teamMembersTable).set({ role: "coach" })
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, requesterId)));

  await db.update(teamMembersTable).set({ role: "coach" })
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, newOwnerId)));

  res.json({ success: true });
});

/* ─── POST /teams/:teamId/archive  ─────────────────────── */

router.post("/teams/:teamId/archive", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await isTeamOwner(userId, teamId))) {
    res.status(403).json({ error: "Only the team owner can archive the team" }); return;
  }

  const [team] = await db.update(teamsTable)
    .set({ archivedAt: new Date(), archivedBy: userId })
    .where(eq(teamsTable.id, teamId))
    .returning();

  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  res.json({ success: true });
});

/* ─── POST /teams/:teamId/unarchive  ───────────────────── */

router.post("/teams/:teamId/unarchive", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await isTeamOwner(userId, teamId))) {
    res.status(403).json({ error: "Only the team owner can restore the team" }); return;
  }

  const [team] = await db.update(teamsTable)
    .set({ archivedAt: null, archivedBy: null })
    .where(eq(teamsTable.id, teamId))
    .returning();

  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  res.json({ success: true });
});

/* ─── DELETE /teams/:teamId/destroy  ────────────────────── */

router.delete("/teams/:teamId/destroy", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await isTeamOwner(userId, teamId))) {
    res.status(403).json({ error: "Only the team owner can delete the team" }); return;
  }

  const { confirmPhrase } = req.body as { confirmPhrase?: string };
  if (confirmPhrase !== "DELETE PERMANENTLY") {
    res.status(400).json({ error: "Must send confirmPhrase: 'DELETE PERMANENTLY'" }); return;
  }

  const [team] = await db.delete(teamsTable).where(eq(teamsTable.id, teamId)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  res.json({ success: true });
});

export default router;
