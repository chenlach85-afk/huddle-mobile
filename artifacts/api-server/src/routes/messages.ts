import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, messagesTable } from "@workspace/db";
import {
  ListMessagesParams,
  CreateMessageParams,
  CreateMessageBody,
  DeleteMessageParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { assertTeamAccess } from "../helpers/teamAccess";

const router: IRouter = Router();

router.get("/teams/:teamId/messages", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = ListMessagesParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.teamId, teamId))
    .orderBy(messagesTable.createdAt);

  res.json(messages);
});

router.post("/teams/:teamId/messages", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = CreateMessageParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreateMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const d = parsed.data;
  const [message] = await db
    .insert(messagesTable)
    .values({
      teamId,
      senderName: d.senderName,
      senderRole: d.senderRole,
      content: d.content,
      pinned: d.pinned ?? false,
    })
    .returning();

  res.status(201).json(message);
});

router.delete("/messages/:messageId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = DeleteMessageParams.safeParse({ messageId: req.params.messageId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select({ teamId: messagesTable.teamId }).from(messagesTable).where(eq(messagesTable.id, params.data.messageId));
  if (!existing) { res.status(404).json({ error: "Message not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const [msg] = await db.delete(messagesTable).where(eq(messagesTable.id, params.data.messageId)).returning();
  if (!msg) { res.status(404).json({ error: "Message not found" }); return; }
  res.sendStatus(204);
});

export default router;
