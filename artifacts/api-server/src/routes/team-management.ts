import { Router, type IRouter } from "express";
import { eq, and, ne, isNull } from "drizzle-orm";
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

async function canManageTeamSettings(userId: number, teamId: number): Promise<boolean> {
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (user?.role === "admin") return true;
  const [team] = await db.select({ createdBy: teamsTable.createdBy }).from(teamsTable).where(eq(teamsTable.id, teamId));
  if (team?.createdBy === userId) return true;
  const [member] = await db
    .select({ role: teamMembersTable.role, canManageTeamSettings: teamMembersTable.canManageTeamSettings })
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, teamId), eq(teamMembersTable.userId, userId)));
  return member?.role === "coach" && member?.canManageTeamSettings === true;
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
    status: teamMembersTable.status,
    canManageTeamSettings: teamMembersTable.canManageTeamSettings,
    placeholderFullName: teamMembersTable.placeholderFullName,
    placeholderEmail: teamMembersTable.placeholderEmail,
    placeholderPhone: teamMembersTable.placeholderPhone,
    memberNotes: teamMembersTable.memberNotes,
    invitationId: teamMembersTable.invitationId,
    createdAt: teamMembersTable.createdAt,
    userName: usersTable.name,
    userEmail: usersTable.email,
    userClerkId: usersTable.clerkId,
  })
  .from(teamMembersTable)
  .leftJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
  .where(and(
    eq(teamMembersTable.teamId, teamId),
    ne(teamMembersTable.role, "player")
  ));

  const invitations = members
    .filter(m => m.invitationId !== null)
    .map(m => m.invitationId!);

  let inviteMap: Record<number, { token: string; status: string; emailSendCount: number; expiresAt: Date }> = {};
  if (invitations.length > 0) {
    const invRows = await db.select({
      id: teamInvitationsTable.id,
      token: teamInvitationsTable.token,
      status: teamInvitationsTable.status,
      emailSendCount: teamInvitationsTable.emailSendCount,
      expiresAt: teamInvitationsTable.expiresAt,
    }).from(teamInvitationsTable)
      .where(eq(teamInvitationsTable.teamId, teamId));
    for (const inv of invRows) {
      inviteMap[inv.id] = inv;
    }
  }

  const coaches = members.map(m => {
    const inv = m.invitationId ? inviteMap[m.invitationId] : null;
    return {
      id: m.id,
      userId: m.userId,
      clerkId: m.userClerkId,
      name: m.userName ?? m.placeholderFullName ?? "Unknown",
      email: m.userEmail ?? m.placeholderEmail ?? null,
      phone: m.placeholderPhone ?? null,
      role: m.role,
      coachTitle: m.coachTitle,
      status: m.userId ? "active" : (m.status ?? "pending_invitation"),
      canManageTeamSettings: m.canManageTeamSettings ?? false,
      isOwner: m.userId === team.createdBy,
      isPlaceholder: m.userId === null,
      memberNotes: m.memberNotes,
      createdAt: m.createdAt,
      invitationId: m.invitationId,
      inviteToken: inv?.token,
      inviteUrl: inv ? inviteUrl(inv.token) : undefined,
      inviteStatus: inv?.status,
      emailSendCount: inv?.emailSendCount ?? 0,
      inviteExpiresAt: inv?.expiresAt,
    };
  });

  res.json({ coaches, ownerId: team.createdBy });
});

/* ─── POST /teams/:teamId/managers  ─────────────────────── */

router.post("/teams/:teamId/managers", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await canManageTeamSettings(userId, teamId))) {
    res.status(403).json({ error: "Not authorized — only owner or manager with settings access can add staff" }); return;
  }

  const [team] = await db.select({ name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.id, teamId));
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }

  const {
    first_name, family_name, coach_title, notes, email, phone,
    role = "coach", can_manage_team_settings = false,
    invitation_action = "none", personal_message,
  } = req.body as {
    first_name?: string; family_name?: string; coach_title?: string; notes?: string;
    email?: string; phone?: string; role?: string; can_manage_team_settings?: boolean;
    invitation_action?: "none" | "send_email" | "generate_link"; personal_message?: string;
  };

  if (!first_name?.trim() || !family_name?.trim()) {
    res.status(400).json({ error: "first_name and family_name required" }); return;
  }
  if (invitation_action !== "none" && !email?.includes("@") && !phone) {
    res.status(400).json({ error: "email or phone required when sending invitation" }); return;
  }

  const validRole = ["coach", "assistant"].includes(role) ? role as "coach" | "assistant" : "coach";
  const canManage = validRole === "assistant" ? false : !!can_manage_team_settings;
  const fullName = `${first_name.trim()} ${family_name.trim()}`;
  const invStatus = invitation_action === "none" ? "pending_invitation" : "invited";

  let invitationId: number | null = null;
  let inviteToken: string | null = null;
  let inviteUrlStr: string | null = null;
  let emailSent = false;

  if (invitation_action !== "none") {
    inviteToken = randomUUID();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const invType = invitation_action === "send_email" ? "email" : "link";

    const [inv] = await db.insert(teamInvitationsTable).values({
      token: inviteToken,
      teamId,
      invitedByUserId: userId,
      inviteType: invType,
      invitedRole: validRole,
      email: invType === "email" ? (email ?? null) : null,
      phone: phone ?? null,
      expiresAt,
    }).returning();

    invitationId = inv.id;
    inviteUrlStr = inviteUrl(inviteToken);

    if (invitation_action === "send_email" && email) {
      const key = process.env.RESEND_API_KEY;
      if (key) {
        const from = process.env.RESEND_FROM_EMAIL ?? "Huddle <onboarding@resend.dev>";
        const subject = `You've been invited to join ${team.name} coaching staff`;
        const msgText = personal_message ? `<p style="color:rgba(255,255,255,0.6);font-style:italic;">"${personal_message}"</p>` : "";
        const html = `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0e1529;border-radius:12px;color:#fff;">
            <h2 style="color:#FF6B35;">You're invited to coach!</h2>
            <p>You've been invited to join <strong>${team.name}</strong> as a ${validRole === "assistant" ? "assistant coach" : "coach"}.</p>
            ${msgText}
            <a href="${inviteUrlStr}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#FF6B35;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">
              Accept Invitation
            </a>
          </div>
        `;
        try {
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: email, subject, html }),
          });
          if (r.ok) {
            await db.update(teamInvitationsTable)
              .set({ emailSentAt: new Date(), emailSendCount: 1 })
              .where(eq(teamInvitationsTable.id, inv.id));
            emailSent = true;
          }
        } catch {}
      }
    }
  }

  const [member] = await db.insert(teamMembersTable).values({
    teamId,
    userId: null,
    role: validRole,
    placeholderFullName: fullName,
    placeholderEmail: email ?? null,
    placeholderPhone: phone ?? null,
    coachTitle: coach_title?.trim() || null,
    memberNotes: notes?.trim() || null,
    canManageTeamSettings: canManage,
    status: invStatus,
    invitationId: invitationId ?? null,
  } as any).returning();

  res.status(201).json({
    member: {
      id: member.id,
      name: fullName,
      email: email ?? null,
      phone: phone ?? null,
      role: member.role,
      coachTitle: member.coachTitle,
      status: member.status,
      canManageTeamSettings: member.canManageTeamSettings,
      isOwner: false,
      isPlaceholder: true,
      memberNotes: member.memberNotes,
      createdAt: member.createdAt,
      invitationId,
      inviteToken,
      inviteUrl: inviteUrlStr,
      emailSent,
    }
  });
});

/* ─── PATCH /teams/:teamId/managers/:memberId  ──────────── */

router.patch("/teams/:teamId/managers/:memberId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeamSettings(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [existing] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)));
  if (!existing) { res.status(404).json({ error: "Member not found" }); return; }

  const { first_name, family_name, coach_title, notes, email, phone, role, can_manage_team_settings } = req.body as {
    first_name?: string; family_name?: string; coach_title?: string; notes?: string;
    email?: string; phone?: string; role?: string; can_manage_team_settings?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (first_name !== undefined && family_name !== undefined) {
    updates.placeholderFullName = `${first_name.trim()} ${family_name.trim()}`;
  } else if (first_name !== undefined) {
    const parts = (existing.placeholderFullName ?? "").split(" ");
    updates.placeholderFullName = `${first_name.trim()} ${parts.slice(1).join(" ")}`.trim();
  }
  if (email !== undefined) updates.placeholderEmail = email || null;
  if (phone !== undefined) updates.placeholderPhone = phone || null;
  if ("coach_title" in req.body) updates.coachTitle = coach_title?.trim() || null;
  if ("notes" in req.body) updates.memberNotes = notes?.trim() || null;
  if (role !== undefined && ["coach", "assistant"].includes(role)) {
    updates.role = role;
    if (role === "assistant") updates.canManageTeamSettings = false;
  }
  if (can_manage_team_settings !== undefined && existing.role !== "assistant") {
    updates.canManageTeamSettings = !!can_manage_team_settings;
  }

  const [updated] = await db.update(teamMembersTable).set(updates)
    .where(eq(teamMembersTable.id, memberId)).returning();

  res.json({ success: true, member: updated });
});

/* ─── DELETE /teams/:teamId/managers/:memberId  ─────────── */

router.delete("/teams/:teamId/managers/:memberId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeamSettings(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [existing] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)));
  if (!existing) { res.status(404).json({ error: "Member not found" }); return; }

  const [team] = await db.select({ createdBy: teamsTable.createdBy }).from(teamsTable).where(eq(teamsTable.id, teamId));
  if (existing.userId === team?.createdBy) {
    res.status(400).json({ error: "Cannot remove the team owner" }); return;
  }
  if (existing.userId === userId) {
    res.status(400).json({ error: "Cannot remove yourself" }); return;
  }

  if (existing.invitationId) {
    await db.update(teamInvitationsTable)
      .set({ status: "cancelled" } as any)
      .where(eq(teamInvitationsTable.id, existing.invitationId));
  }

  await db.delete(teamMembersTable).where(eq(teamMembersTable.id, memberId));
  res.json({ success: true });
});

/* ─── POST /teams/:teamId/managers/:memberId/send-invite ── */

router.post("/teams/:teamId/managers/:memberId/send-invite", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeamSettings(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)));
  if (!member || member.userId !== null) { res.status(404).json({ error: "Placeholder not found" }); return; }

  const [team] = await db.select({ name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.id, teamId));
  const { type = "link", personal_message } = req.body as { type?: "email" | "link"; personal_message?: string };

  let token: string;
  let url: string;

  if (member.invitationId) {
    const [existing] = await db.select().from(teamInvitationsTable).where(eq(teamInvitationsTable.id, member.invitationId));
    if (existing && existing.emailSendCount < 5) {
      token = existing.token;
      url = inviteUrl(token);

      if (type === "email" && member.placeholderEmail) {
        const key = process.env.RESEND_API_KEY;
        if (key) {
          const from = process.env.RESEND_FROM_EMAIL ?? "Huddle <onboarding@resend.dev>";
          const msgText = personal_message ? `<p style="color:rgba(255,255,255,0.6);font-style:italic;">"${personal_message}"</p>` : "";
          const html = `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0e1529;border-radius:12px;color:#fff;"><h2 style="color:#FF6B35;">Coaching invitation for ${team?.name ?? "your team"}</h2>${msgText}<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#FF6B35;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">Accept Invitation</a></div>`;
          try {
            const r = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
              body: JSON.stringify({ from, to: member.placeholderEmail, subject: `Coaching invitation — ${team?.name ?? "Huddle"}`, html }),
            });
            if (r.ok) {
              await db.update(teamInvitationsTable)
                .set({ emailSentAt: new Date(), emailSendCount: (existing.emailSendCount ?? 0) + 1 } as any)
                .where(eq(teamInvitationsTable.id, member.invitationId));
            }
          } catch {}
        }
      }
      await db.update(teamMembersTable).set({ status: "invited" }).where(eq(teamMembersTable.id, memberId));
      res.json({ url, token }); return;
    }
  }

  token = randomUUID();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  url = inviteUrl(token);

  const [inv] = await db.insert(teamInvitationsTable).values({
    token, teamId, invitedByUserId: userId,
    inviteType: type, invitedRole: member.role as "coach" | "assistant",
    email: member.placeholderEmail ?? null,
    phone: member.placeholderPhone ?? null, expiresAt,
  }).returning();

  await db.update(teamMembersTable)
    .set({ invitationId: inv.id, status: "invited" })
    .where(eq(teamMembersTable.id, memberId));

  res.json({ url, token, invitationId: inv.id });
});

/* ─── POST /teams/:teamId/managers/:memberId/cancel-invite  */

router.post("/teams/:teamId/managers/:memberId/cancel-invite", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeamSettings(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)));
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }

  if (member.invitationId) {
    await db.update(teamInvitationsTable)
      .set({ status: "cancelled" } as any)
      .where(eq(teamInvitationsTable.id, member.invitationId));
  }

  await db.update(teamMembersTable)
    .set({ status: "pending_invitation", invitationId: null } as any)
    .where(eq(teamMembersTable.id, memberId));

  res.json({ success: true });
});

/* ─── PATCH /teams/:teamId/managers/:memberId/toggle-settings */

router.patch("/teams/:teamId/managers/:memberId/toggle-settings", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  const memberId = parseInt(req.params.memberId as string);
  if (isNaN(teamId) || isNaN(memberId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (!(await canManageTeamSettings(userId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const [member] = await db.select().from(teamMembersTable)
    .where(and(eq(teamMembersTable.id, memberId), eq(teamMembersTable.teamId, teamId)));
  if (!member) { res.status(404).json({ error: "Member not found" }); return; }
  if (member.role === "assistant") { res.status(400).json({ error: "Assistant coaches cannot have settings access" }); return; }

  const newValue = !member.canManageTeamSettings;
  await db.update(teamMembersTable).set({ canManageTeamSettings: newValue }).where(eq(teamMembersTable.id, memberId));
  res.json({ success: true, canManageTeamSettings: newValue });
});

/* ─── POST /teams/:teamId/coaches/invite  ───────────────── */

router.post("/teams/:teamId/coaches/invite", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await canManageTeamSettings(userId, teamId))) {
    res.status(403).json({ error: "Only team owners or managers can invite coaches" }); return;
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
      const html = `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#0e1529;border-radius:12px;color:#fff;"><h2 style="color:#FF6B35;">You're invited to coach!</h2><p>Join <strong>${team.name}</strong> as a ${validRole === "assistant" ? "assistant coach" : "coach"} on Huddle.</p><a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 28px;background:#FF6B35;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">Accept Invitation</a></div>`;
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from, to: email, subject: `You've been invited as a coach for ${team.name}`, html }),
        });
        if (r.ok) {
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

  if (!(await canManageTeamSettings(requesterId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
  }

  const { role } = req.body as { role?: string };
  if (!["coach", "assistant"].includes(role ?? "")) {
    res.status(400).json({ error: "Role must be coach or assistant" }); return;
  }

  const updates: Record<string, unknown> = { role };
  if (role === "assistant") updates.canManageTeamSettings = false;

  const [updated] = await db.update(teamMembersTable)
    .set(updates)
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

  if (!(await canManageTeamSettings(requesterId, teamId))) {
    res.status(403).json({ error: "Not authorized" }); return;
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
