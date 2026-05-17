import { Router } from "express";
import { db, filesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import type { Response } from "express";
import crypto from "crypto";
import path from "path";

const router = Router();

router.post("/files/upload", requireAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  const { filename, mimeType, size, data, teamId, relatedType, relatedId } = req.body as {
    filename: string;
    mimeType: string;
    size: number;
    data: string;
    teamId?: number;
    relatedType?: string;
    relatedId?: number;
  };

  if (!filename || !mimeType || !data) {
    res.status(400).json({ error: "filename, mimeType, and data are required" });
    return;
  }

  const ext = path.extname(filename);
  const uniqueName = `${crypto.randomUUID()}${ext}`;
  const url = `data:${mimeType};base64,${data}`;

  const [file] = await db
    .insert(filesTable)
    .values({
      uploaderId: req.userId!,
      teamId: teamId ?? null,
      filename: uniqueName,
      originalName: filename,
      mimeType,
      size,
      url,
      relatedType: relatedType ?? null,
      relatedId: relatedId ?? null,
    })
    .returning();

  res.status(201).json({ id: file.id, filename: file.originalName, url: file.url, mimeType: file.mimeType });
});

router.get("/files", requireAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  const { teamId, relatedType, relatedId } = req.query as {
    teamId?: string;
    relatedType?: string;
    relatedId?: string;
  };

  const conditions = [];
  if (teamId) conditions.push(eq(filesTable.teamId, parseInt(teamId)));
  if (relatedType) conditions.push(eq(filesTable.relatedType, relatedType));
  if (relatedId) conditions.push(eq(filesTable.relatedId, parseInt(relatedId)));

  const files = await db
    .select()
    .from(filesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(filesTable.createdAt);

  res.json(files);
});

router.delete("/files/:id", requireAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [file] = await db.select().from(filesTable).where(eq(filesTable.id, id)).limit(1);
  if (!file) { res.status(404).json({ error: "File not found" }); return; }

  if (file.uploaderId !== req.userId && req.userRole !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  await db.delete(filesTable).where(eq(filesTable.id, id));
  res.sendStatus(204);
});

router.patch("/files/:id", requireAuth, async (req: AuthedRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params["id"] as string);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [file] = await db.select().from(filesTable).where(eq(filesTable.id, id)).limit(1);
  if (!file) { res.status(404).json({ error: "File not found" }); return; }

  if (file.uploaderId !== req.userId && req.userRole !== "admin") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { originalName, relatedType, relatedId } = req.body as {
    originalName?: string;
    relatedType?: string | null;
    relatedId?: number | null;
  };

  const updates: Record<string, unknown> = {};
  if (originalName !== undefined) updates.originalName = originalName;
  if ("relatedType" in req.body) updates.relatedType = relatedType ?? null;
  if ("relatedId" in req.body) updates.relatedId = relatedId ?? null;

  const [updated] = await db.update(filesTable).set(updates).where(eq(filesTable.id, id)).returning();
  res.json(updated);
});

export default router;
