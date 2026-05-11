import { Router, type IRouter } from "express";
import { eq, and, desc, ne } from "drizzle-orm";
import {
  db, messagesTable, messageDeliveriesTable, teamMembersTable, usersTable, notificationsTable,
} from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { assertTeamAccess } from "../helpers/teamAccess";

const router: IRouter = Router();

function waUrl(phone: string, text: string): string {
  const cleaned = phone.replace(/\D/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`;
}

/* ─── GET /teams/:teamId/announcements ─────────────────── */
router.get("/teams/:teamId/announcements", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }
  if (!(await assertTeamAccess(teamId, req, res))) return;

  const msgs = await db.select({
    id: messagesTable.id,
    title: messagesTable.title,
    messageType: messagesTable.messageType,
    senderName: messagesTable.senderName,
    targetAudience: messagesTable.targetAudience,
    channels: messagesTable.channels,
    content: messagesTable.content,
    pinned: messagesTable.pinned,
    createdAt: messagesTable.createdAt,
    senderUserId: messagesTable.senderUserId,
  })
    .from(messagesTable)
    .where(and(
      eq(messagesTable.teamId, teamId),
    ))
    .orderBy(desc(messagesTable.createdAt));

  res.json(msgs);
});

/* ─── POST /teams/:teamId/announcements ────────────────── */
router.post("/teams/:teamId/announcements", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }
  if (!(await assertTeamAccess(teamId, req, res))) return;

  const {
    title, content, messageType = "general", targetAudience = "all",
    channels = { in_app: true, email: false, whatsapp: false },
    pinned = false,
  } = req.body as {
    title?: string; content?: string; messageType?: string; targetAudience?: string;
    channels?: { in_app: boolean; email: boolean; whatsapp: boolean };
    pinned?: boolean;
  };

  if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }
  if (!title?.trim()) { res.status(400).json({ error: "title required" }); return; }

  const senderUser = await db.select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable).where(eq(usersTable.id, req.userId!)).then(r => r[0]);

  const validType = ["announcement", "reminder", "urgent", "general"].includes(messageType)
    ? messageType as "announcement" | "reminder" | "urgent" | "general"
    : "general";
  const validAudience = ["all", "players_only", "specific_players"].includes(targetAudience)
    ? targetAudience as "all" | "players_only" | "specific_players"
    : "all";

  const [msg] = await db.insert(messagesTable).values({
    teamId,
    senderName: senderUser?.name ?? "Coach",
    senderRole: "coach",
    senderUserId: req.userId!,
    title: title.trim(),
    content: content.trim(),
    messageType: validType,
    targetAudience: validAudience,
    channels,
    pinned,
  }).returning();

  let recipientQuery = db.select({
    userId: teamMembersTable.userId,
    email: usersTable.email,
    phone: teamMembersTable.placeholderPhone,
    name: usersTable.name,
  })
    .from(teamMembersTable)
    .leftJoin(usersTable, eq(teamMembersTable.userId, usersTable.id))
    .where(and(
      eq(teamMembersTable.teamId, teamId),
      ne(teamMembersTable.status, "inactive"),
    ));

  const allMembers = await recipientQuery;
  const recipients = allMembers.filter(m => m.userId !== null && m.userId !== req.userId);

  const deliverySummary = { in_app: { sent: 0, failed: 0 }, email: { sent: 0, failed: 0 }, whatsapp_urls: [] as string[] };

  for (const recipient of recipients) {
    if (!recipient.userId) continue;

    if (channels.in_app) {
      try {
        await db.insert(notificationsTable).values({
          userId: recipient.userId,
          type: "message",
          title: title.trim(),
          body: content.trim().slice(0, 200),
          relatedId: msg.id,
          relatedType: "message",
        });
        await db.insert(messageDeliveriesTable).values({
          messageId: msg.id, userId: recipient.userId, channel: "in_app", status: "sent", sentAt: new Date(),
        }).onConflictDoNothing();
        deliverySummary.in_app.sent++;
      } catch {
        deliverySummary.in_app.failed++;
      }
    }

    if (channels.email && recipient.email) {
      const key = process.env.RESEND_API_KEY;
      let emailOk = false;
      if (key) {
        try {
          const from = process.env.RESEND_FROM_EMAIL ?? "Huddle <onboarding@resend.dev>";
          const typeLabel: Record<string, string> = { announcement: "📢", reminder: "📅", urgent: "🔥", general: "💬" };
          const html = `
            <div style="font-family:sans-serif;max-width:500px;margin:auto;padding:28px;background:#0e1529;border-radius:12px;color:#fff;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#FF6B35;margin-bottom:8px;">${typeLabel[validType] ?? "📢"} ${validType.toUpperCase()}</div>
              <h2 style="margin:0 0 16px;color:#fff;font-size:20px;">${title.trim()}</h2>
              <p style="color:rgba(255,255,255,0.75);line-height:1.6;white-space:pre-wrap;">${content.trim()}</p>
              <p style="margin-top:24px;font-size:11px;color:rgba(255,255,255,0.35);">Sent by ${senderUser?.name ?? "Coach"} via Huddle Pro</p>
            </div>
          `;
          const r = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from, to: recipient.email, subject: title.trim(), html }),
          });
          emailOk = r.ok;
        } catch { emailOk = false; }
      }
      await db.insert(messageDeliveriesTable).values({
        messageId: msg.id, userId: recipient.userId, channel: "email",
        status: emailOk ? "sent" : "failed", sentAt: emailOk ? new Date() : undefined,
        errorDetail: emailOk ? null : "Send failed",
      }).onConflictDoNothing();
      if (emailOk) deliverySummary.email.sent++; else deliverySummary.email.failed++;
    }

    if (channels.whatsapp && recipient.phone) {
      const text = `${typeEmoji(validType)} *${title.trim()}*\n\n${content.trim()}\n\n— ${senderUser?.name ?? "Coach"}`;
      deliverySummary.whatsapp_urls.push(waUrl(recipient.phone, text));
      await db.insert(messageDeliveriesTable).values({
        messageId: msg.id, userId: recipient.userId, channel: "whatsapp", status: "pending",
      }).onConflictDoNothing();
    }
  }

  res.status(201).json({ message: msg, deliverySummary });
});

function typeEmoji(type: string): string {
  const m: Record<string, string> = { announcement: "📢", reminder: "📅", urgent: "🔥", general: "💬" };
  return m[type] ?? "📢";
}

/* ─── PATCH /messages/:msgId ─────────────────────────────── */
router.patch("/messages/:msgId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const msgId = parseInt(req.params.msgId as string);
  if (isNaN(msgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const existing = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId)).then(r => r[0]);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const isSender = existing.senderUserId === req.userId;
  const teamMember = await db.select({ role: teamMembersTable.role })
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, existing.teamId), eq(teamMembersTable.userId, req.userId!)))
    .then(r => r[0]);
  const isCoach = teamMember?.role === "coach" || teamMember?.role === "assistant";

  if (!isSender && !isCoach) { res.status(403).json({ error: "Forbidden" }); return; }

  const { title, content, pinned } = req.body as { title?: string; content?: string; pinned?: boolean };
  const updates: Partial<typeof messagesTable.$inferInsert> = {};
  if (title !== undefined) updates.title = title.trim();
  if (content !== undefined) updates.content = content.trim();
  if (pinned !== undefined) updates.pinned = pinned;

  const [updated] = await db.update(messagesTable).set(updates).where(eq(messagesTable.id, msgId)).returning();
  res.json(updated);
});

/* ─── DELETE /messages/:msgId ────────────────────────────── */
router.delete("/messages/:msgId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const msgId = parseInt(req.params.msgId as string);
  if (isNaN(msgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const existing = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId)).then(r => r[0]);
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const isSender = existing.senderUserId === req.userId;
  const teamMember = await db.select({ role: teamMembersTable.role })
    .from(teamMembersTable)
    .where(and(eq(teamMembersTable.teamId, existing.teamId), eq(teamMembersTable.userId, req.userId!)))
    .then(r => r[0]);
  const isCoach = teamMember?.role === "coach" || teamMember?.role === "assistant";

  if (!isSender && !isCoach) { res.status(403).json({ error: "Forbidden" }); return; }

  await db.delete(messagesTable).where(eq(messagesTable.id, msgId));
  res.json({ ok: true });
});

/* ─── GET /teams/:teamId/announcements/:msgId/deliveries ── */
router.get("/teams/:teamId/announcements/:msgId/deliveries", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const teamId = parseInt(req.params.teamId as string);
  const msgId = parseInt(req.params.msgId as string);
  if (isNaN(teamId) || isNaN(msgId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await assertTeamAccess(teamId, req, res))) return;

  const deliveries = await db.select({
    id: messageDeliveriesTable.id,
    userId: messageDeliveriesTable.userId,
    channel: messageDeliveriesTable.channel,
    status: messageDeliveriesTable.status,
    sentAt: messageDeliveriesTable.sentAt,
    readAt: messageDeliveriesTable.readAt,
    name: usersTable.name,
    email: usersTable.email,
  })
    .from(messageDeliveriesTable)
    .leftJoin(usersTable, eq(messageDeliveriesTable.userId, usersTable.id))
    .where(eq(messageDeliveriesTable.messageId, msgId));

  res.json(deliveries);
});

/* ─── POST /teams/:teamId/announcements/:msgId/mark-read ── */
router.post("/teams/:teamId/announcements/:msgId/mark-read", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const msgId = parseInt(req.params.msgId as string);
  if (isNaN(msgId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  await db.update(messageDeliveriesTable)
    .set({ status: "read", readAt: new Date() })
    .where(and(
      eq(messageDeliveriesTable.messageId, msgId),
      eq(messageDeliveriesTable.userId, req.userId!),
      eq(messageDeliveriesTable.channel, "in_app"),
    ));

  res.json({ ok: true });
});

export default router;
