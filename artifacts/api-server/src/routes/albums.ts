import { Router, type IRouter } from "express";
import { eq, and, count } from "drizzle-orm";
import { db, albumsTable, filesTable } from "@workspace/db";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { assertTeamAccess } from "../helpers/teamAccess";

const router: IRouter = Router();

router.get("/teams/:teamId/albums", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const albums = await db
    .select({
      id: albumsTable.id,
      teamId: albumsTable.teamId,
      name: albumsTable.name,
      description: albumsTable.description,
      coverUrl: albumsTable.coverUrl,
      createdAt: albumsTable.createdAt,
      updatedAt: albumsTable.updatedAt,
    })
    .from(albumsTable)
    .where(eq(albumsTable.teamId, teamId))
    .orderBy(albumsTable.createdAt);

  const result = await Promise.all(
    albums.map(async (album) => {
      const [{ value }] = await db
        .select({ value: count() })
        .from(filesTable)
        .where(and(eq(filesTable.relatedType, "album"), eq(filesTable.relatedId, album.id)));
      return { ...album, fileCount: Number(value) };
    })
  );

  res.json(result);
});

router.post("/teams/:teamId/albums", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const { name, description, coverUrl } = req.body as { name?: string; description?: string; coverUrl?: string };
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  const [album] = await db
    .insert(albumsTable)
    .values({ teamId, name, description: description ?? null, coverUrl: coverUrl ?? null })
    .returning();
  res.status(201).json({ ...album, fileCount: 0 });
});

router.get("/albums/:albumId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const albumId = parseInt(req.params.albumId as string);
  if (isNaN(albumId)) { res.status(400).json({ error: "Invalid albumId" }); return; }

  const [album] = await db.select().from(albumsTable).where(eq(albumsTable.id, albumId));
  if (!album) { res.status(404).json({ error: "Album not found" }); return; }

  if (!(await assertTeamAccess(album.teamId, req, res))) return;

  const [{ value }] = await db
    .select({ value: count() })
    .from(filesTable)
    .where(and(eq(filesTable.relatedType, "album"), eq(filesTable.relatedId, albumId)));
  res.json({ ...album, fileCount: Number(value) });
});

router.patch("/albums/:albumId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const albumId = parseInt(req.params.albumId as string);
  if (isNaN(albumId)) { res.status(400).json({ error: "Invalid albumId" }); return; }

  const [existing] = await db.select({ teamId: albumsTable.teamId }).from(albumsTable).where(eq(albumsTable.id, albumId));
  if (!existing) { res.status(404).json({ error: "Album not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const { name, description, coverUrl } = req.body as { name?: string; description?: string; coverUrl?: string };
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if ("description" in req.body) updates.description = description ?? null;
  if ("coverUrl" in req.body) updates.coverUrl = coverUrl ?? null;
  const [album] = await db.update(albumsTable).set(updates).where(eq(albumsTable.id, albumId)).returning();
  if (!album) { res.status(404).json({ error: "Album not found" }); return; }
  const [{ value }] = await db
    .select({ value: count() })
    .from(filesTable)
    .where(and(eq(filesTable.relatedType, "album"), eq(filesTable.relatedId, albumId)));
  res.json({ ...album, fileCount: Number(value) });
});

router.delete("/albums/:albumId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const albumId = parseInt(req.params.albumId as string);
  if (isNaN(albumId)) { res.status(400).json({ error: "Invalid albumId" }); return; }

  const [existing] = await db.select({ teamId: albumsTable.teamId }).from(albumsTable).where(eq(albumsTable.id, albumId));
  if (!existing) { res.status(404).json({ error: "Album not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  await db.delete(albumsTable).where(eq(albumsTable.id, albumId));
  res.sendStatus(204);
});

router.get("/albums/:albumId/files", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const albumId = parseInt(req.params.albumId as string);
  if (isNaN(albumId)) { res.status(400).json({ error: "Invalid albumId" }); return; }

  const [album] = await db.select({ teamId: albumsTable.teamId }).from(albumsTable).where(eq(albumsTable.id, albumId));
  if (!album) { res.status(404).json({ error: "Album not found" }); return; }
  if (!(await assertTeamAccess(album.teamId, req, res))) return;

  const files = await db
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.relatedType, "album"), eq(filesTable.relatedId, albumId)))
    .orderBy(filesTable.createdAt);
  res.json(files);
});

router.get("/teams/:teamId/docs", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const teamId = parseInt(req.params.teamId as string);
  if (isNaN(teamId)) { res.status(400).json({ error: "Invalid teamId" }); return; }

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const docs = await db
    .select()
    .from(filesTable)
    .where(and(eq(filesTable.teamId, teamId), eq(filesTable.relatedType, "team_doc")))
    .orderBy(filesTable.createdAt);
  res.json(docs);
});

export default router;
