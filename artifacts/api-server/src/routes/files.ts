import { Router } from "express";
import { db, filesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

  let query = db.select().from(filesTable);
  const conditions = [];

  if (teamId) conditions.push(eq(filesTable.teamId, parseInt(teamId)));
  if (relatedType) conditions.push(eq(filesTable.relatedType, relatedType));
  if (relatedId) conditions.push(eq(filesTable.relatedId, parseInt(relatedId)));

  const files = await db
    .select()
    .from(filesTable)
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .orderBy(filesTable.createdAt);

  res.json(files);
});

export default router;
