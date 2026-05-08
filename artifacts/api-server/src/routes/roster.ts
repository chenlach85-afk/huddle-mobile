import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import {
  db, usersTable, teamsTable, teamMembersTable, teamInvitationsTable,
} from "@workspace/db";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function inviteUrl(token: string): string {
  const basePath = process.env.BASE_PATH ?? "";
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? "localhost";
  return `https://${domain}${basePath}/team-invite/${token}`;
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

async function sendInviteEmail(
  to: string,
  inviterName: string,
  teamName: string,
  token: string,
  personalMessage?: string,
): Promise<{ success: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { success: false, error: "RESEND_API_KEY not configured" };

  const from = process.env.RESEND_FROM_EMAIL ?? "Huddle <onboarding@resend.dev>";
  const link = inviteUrl(token);
  const subject = `${inviterName} invited you to join ${teamName} on Huddle`;
  const msgBlock = personalMessage
    ? `<p style="color:#555;font-style:italic;margin:12px 0;padding:12px;border-left:3px solid #FF6B35;">${personalMessage}</p>`
    : "";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
      <h2 style="color:#FF6B35;margin-bottom:8px;">You're invited to join a team!</h2>
      <p style="color:#333;"><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on Huddle.</p>
      ${msgBlock}
      <a href="${link}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#FF6B35;color:white;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        Accept Invitation
      </a>
      <p style="margin-top:28px;color:#888;font-size:12px;">This invitation expires in 14 days.</p>
      <p style="color:#aaa;font-size:11px;word-break:break-all;">Or copy: ${link}</p>
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
    let errorMsg = body.message ?? body.name ?? `HTTP ${res.status}`;
    if (errorMsg.includes("domain_not_verified")) errorMsg = "Email service domain not configured. Use the link option instead.";
    else if (errorMsg.includes("rate_limit")) errorMsg = "Too many emails sent recently. Try again in a few minutes.";
    else if (errorMsg.includes("invalid_email")) errorMsg = "The email address looks invalid.";
    return { success: false, error: errorMsg };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}

/* ─── GET /api/teams/:teamId/roster ─────────────────────── */

router.get("/teams/:teamId/roster", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const members = await db.select({
    id: teamMembersTable.id,
    teamId: teamMembersTable.teamId,
    userId: teamMembersTable.userId,
    role: teamMembersTable.role,
    status: teamMembersTable.status,
    placeholderFullName: teamMembersTable.placeholderFullName,
    placeholderEmail: teamMembersTable.placeholderEmail,
    placeholderPhone: teamMembersTable.placeholderPhone,
    invitationId: teamMembersTable.invitationId,
    jerseyNumber: teamMembersTable.jerseyNumber,
    position: teamMembersTable.position,
    memberNotes: teamMembersTable.memberNotes,
    coachTitle: teamMembersTable.coachTitle,
    createdAt: teamMembersTable.createdAt,
    userName: usersTable.name,
    userEmail: usersTable.email,
    invitationToken: teamInvitationsTable.token,
    invitationStatus: teamInvitationsTable.status,
    invitationEmailSentAt: teamInvitationsTable.emailSentAt,
    invitationExpiresAt: teamInvitationsTable.expiresAt,
    invitationSendCount: teamInvitationsTable.emailSendCount,
    invitationEmail: teamInvitationsTable.email,
    invitationPhone: teamInvitationsTable.phone,
  })
  .from(teamMembersTable)
  .leftJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
  .leftJoin(teamInvitationsTable, eq(teamMembersTable.invitationId, teamInvitationsTable.id))
  .where(eq(teamMembersTable.teamId, teamId))
  .orderBy(teamMembersTable.createdAt);

  const withUrls = members.map(m => ({
    ...m,
    displayName: m.userName ?? m.placeholderFullName ?? "Unknown",
    displayEmail: m.userEmail ?? m.placeholderEmail ?? null,
    displayPhone: m.placeholderPhone ?? null,
    invitationUrl: m.invitationToken ? inviteUrl(m.invitationToken) : null,
  }));

  res.json(withUrls);
});

/* ─── POST /api/teams/:teamId/roster ────────────────────── */

router.post("/teams/:teamId/roster", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const {
    fullName, jerseyNumber, position, notes, email, phone,
    invitationAction = "none", personalMessage,
  } = req.body as {
    fullName?: string;
    jerseyNumber?: number;
    position?: string;
    notes?: string;
    email?: string;
    phone?: string;
    invitationAction?: "none" | "send_email" | "generate_link";
    personalMessage?: string;
  };

  if (!fullName?.trim()) { res.status(400).json({ error: "fullName is required" }); return; }
  if (invitationAction !== "none" && !email && !phone) {
    res.status(400).json({ error: "email or phone required when sending an invitation" }); return;
  }
  if (invitationAction === "send_email" && (!email || !email.includes("@"))) {
    res.status(400).json({ error: "Valid email required for email invitation" }); return;
  }

  const memberStatus = invitationAction === "none" ? "pending_invitation" : "invited";

  const [member] = await db.insert(teamMembersTable).values({
    teamId,
    userId: null,
    role: "player",
    placeholderFullName: fullName.trim(),
    placeholderEmail: email?.trim() || null,
    placeholderPhone: phone?.trim() || null,
    jerseyNumber: jerseyNumber ?? null,
    position: position?.trim() || null,
    memberNotes: notes?.trim() || null,
    status: memberStatus as "pending_invitation" | "invited",
  }).returning();

  let invitation = null;
  let inviteUrl_ = null;
  let emailSent = false;
  let emailError: string | null = null;

  if (invitationAction !== "none") {
    const [team] = await db.select({ name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.id, teamId));
    const [inviter] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [inv] = await db.insert(teamInvitationsTable).values({
      token, teamId, invitedByUserId: userId,
      inviteType: invitationAction === "send_email" ? "email" : "link",
      invitedRole: "player",
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      expiresAt,
    }).returning();

    await db.update(teamMembersTable).set({ invitationId: inv.id }).where(eq(teamMembersTable.id, member.id));

    inviteUrl_ = inviteUrl(token);
    invitation = { id: inv.id, token, url: inviteUrl_ };

    if (invitationAction === "send_email" && email) {
      const emailResult = await sendInviteEmail(email, inviter?.name ?? "Your coach", team?.name ?? "the team", token, personalMessage);
      if (emailResult.success) {
        await db.update(teamInvitationsTable).set({ emailSentAt: new Date(), emailSendCount: 1 }).where(eq(teamInvitationsTable.id, inv.id));
        emailSent = true;
      } else {
        emailError = emailResult.error ?? "Unknown error";
      }
    }
  }

  res.status(201).json({
    member: { ...member, invitationId: invitation?.id ?? null },
    invitation,
    inviteUrl: inviteUrl_,
    emailSent,
    emailError,
  });
});

/* ─── PATCH /api/teams/:teamId/roster/:memberId ──────────── */

router.patch("/teams/:teamId/roster/:memberId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [existing] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)));
  if (!existing) { res.status(404).json({ error: "Member not found" }); return; }

  const { fullName, jerseyNumber, position, notes, email, phone } = req.body as {
    fullName?: string; jerseyNumber?: number | null; position?: string | null;
    notes?: string | null; email?: string | null; phone?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (fullName !== undefined && existing.userId === null) updates.placeholderFullName = fullName.trim();
  if (jerseyNumber !== undefined) updates.jerseyNumber = jerseyNumber;
  if (position !== undefined) updates.position = position;
  if (notes !== undefined) updates.memberNotes = notes;
  if (email !== undefined && existing.userId === null) {
    updates.placeholderEmail = email;
    if (existing.invitationId && email) {
      await db.update(teamInvitationsTable).set({ email }).where(eq(teamInvitationsTable.id, existing.invitationId));
    }
  }
  if (phone !== undefined && existing.userId === null) updates.placeholderPhone = phone;

  const [updated] = await db.update(teamMembersTable).set(updates).where(eq(teamMembersTable.id, memberId)).returning();
  res.json(updated);
});

/* ─── POST /api/teams/:teamId/roster/:memberId/send-invite ─ */

router.post("/teams/:teamId/roster/:memberId/send-invite", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)));
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }
  if (member.userId !== null) { res.status(400).json({ error: "Member is already registered" }); return; }

  const { method = "link", personalMessage } = req.body as { method?: "email" | "link"; personalMessage?: string };
  const email = member.placeholderEmail;
  const phone = member.placeholderPhone;

  if (method === "email" && (!email || !email.includes("@"))) {
    res.status(400).json({ error: "Valid email required. Update the member's email first." }); return;
  }

  const [team] = await db.select({ name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.id, teamId));
  const [inviter] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId));

  if (member.invitationId) {
    const [existingInv] = await db.select().from(teamInvitationsTable).where(eq(teamInvitationsTable.id, member.invitationId));
    if (existingInv && existingInv.status === "pending") {
      const newExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const newCount = (existingInv.emailSendCount ?? 0) + 1;
      await db.update(teamInvitationsTable).set({ expiresAt: newExpiry, emailSendCount: newCount }).where(eq(teamInvitationsTable.id, existingInv.id));

      let emailSent = false;
      let emailError: string | null = null;
      if (method === "email" && email) {
        const result = await sendInviteEmail(email, inviter?.name ?? "Your coach", team?.name ?? "the team", existingInv.token, personalMessage);
        if (result.success) {
          await db.update(teamInvitationsTable).set({ emailSentAt: new Date() }).where(eq(teamInvitationsTable.id, existingInv.id));
          emailSent = true;
        } else emailError = result.error ?? null;
      }
      await db.update(teamMembersTable).set({ status: "invited" }).where(eq(teamMembersTable.id, memberId));
      res.json({ success: true, inviteUrl: inviteUrl(existingInv.token), emailSent, emailError, sendCount: newCount }); return;
    }
  }

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const [inv] = await db.insert(teamInvitationsTable).values({
    token, teamId, invitedByUserId: userId,
    inviteType: method === "email" ? "email" : "link",
    invitedRole: "player",
    email: email || null,
    phone: phone || null,
    expiresAt,
  }).returning();

  await db.update(teamMembersTable).set({ invitationId: inv.id, status: "invited" }).where(eq(teamMembersTable.id, memberId));

  let emailSent = false;
  let emailError: string | null = null;
  if (method === "email" && email) {
    const result = await sendInviteEmail(email, inviter?.name ?? "Your coach", team?.name ?? "the team", token, personalMessage);
    if (result.success) {
      await db.update(teamInvitationsTable).set({ emailSentAt: new Date(), emailSendCount: 1 }).where(eq(teamInvitationsTable.id, inv.id));
      emailSent = true;
    } else emailError = result.error ?? null;
  }

  res.json({ success: true, inviteUrl: inviteUrl(token), emailSent, emailError, sendCount: emailSent ? 1 : 0 });
});

/* ─── POST /api/teams/:teamId/roster/:memberId/cancel-invite */

router.post("/teams/:teamId/roster/:memberId/cancel-invite", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)));
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  if (member.invitationId) {
    await db.update(teamInvitationsTable).set({ status: "revoked" }).where(eq(teamInvitationsTable.id, member.invitationId));
  }
  await db.update(teamMembersTable).set({ status: "pending_invitation", invitationId: null }).where(eq(teamMembersTable.id, memberId));

  res.json({ success: true });
});

/* ─── POST /api/teams/:teamId/roster/:memberId/deactivate ── */

router.post("/teams/:teamId/roster/:memberId/deactivate", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [updated] = await db.update(teamMembersTable).set({ status: "inactive" })
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Member not found" }); return; }
  res.json({ success: true });
});

/* ─── POST /api/teams/:teamId/roster/:memberId/reactivate ── */

router.post("/teams/:teamId/roster/:memberId/reactivate", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [updated] = await db.update(teamMembersTable).set({ status: "active" })
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Member not found" }); return; }
  res.json({ success: true });
});

/* ─── DELETE /api/teams/:teamId/roster/:memberId ─────────── */

router.delete("/teams/:teamId/roster/:memberId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeam(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)));
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  if (member.invitationId) {
    await db.update(teamInvitationsTable).set({ status: "revoked" }).where(eq(teamInvitationsTable.id, member.invitationId));
  }

  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, memberId));
  res.json({ success: true });
});

/* ─── GET /api/teams/:teamId/next-game ───────────────────── */

router.get("/teams/:teamId/next-game", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  const { eventsTable, attendanceTable, playersTable } = await import("@workspace/db");
  const { lt, gte, asc } = await import("drizzle-orm");

  const [member] = await db.select({ role: teamMembersTable.role }).from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)));
  if (!member) { res.status(403).json({ error: "Not a team member" }); return; }

  const GAME_TYPES = ["league_game", "friendly_game", "tournament"];

  const events = await db.select()
    .from(eventsTable)
    .where(and(
      eq(eventsTable.teamId, teamId),
      gte(eventsTable.startsAt, new Date()),
    ))
    .orderBy(asc(eventsTable.startsAt));

  const nextGame = events.find(e => GAME_TYPES.includes(e.type));

  if (!nextGame) {
    res.json({ event: null, attendance: [], myStatus: null });
    return;
  }

  const attendance = await db.select({
    id: attendanceTable.id,
    playerId: attendanceTable.playerId,
    status: attendanceTable.status,
    playerName: playersTable.name,
    playerNumber: playersTable.number,
    playerPosition: playersTable.position,
  })
  .from(attendanceTable)
  .leftJoin(playersTable, eq(attendanceTable.playerId, playersTable.id))
  .where(eq(attendanceTable.eventId, nextGame.id));

  res.json({ event: nextGame, attendance });
});

export default router;
