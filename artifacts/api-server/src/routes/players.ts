import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, playersTable, teamsTable } from "@workspace/db";
import {
  ListPlayersParams,
  CreatePlayerParams,
  CreatePlayerBody,
  GetPlayerParams,
  UpdatePlayerParams,
  UpdatePlayerBody,
  DeletePlayerParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { assertTeamAccess } from "../helpers/teamAccess";

const router: IRouter = Router();

router.get("/teams/:teamId/players", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = ListPlayersParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.teamId, teamId))
    .orderBy(playersTable.name);
  res.json(players);
});

router.post("/teams/:teamId/players", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = CreatePlayerParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const d = parsed.data;
  const [player] = await db
    .insert(playersTable)
    .values({
      teamId,
      name: d.name,
      number: d.number ?? null,
      position: d.position ?? null,
      email: d.email ?? null,
      phone: d.phone ?? null,
      dateOfBirth: d.dateOfBirth ?? null,
      notes: d.notes ?? null,
      status: d.status ?? "active",
    })
    .returning();

  await db
    .update(teamsTable)
    .set({ playerCount: sql`${teamsTable.playerCount} + 1` })
    .where(eq(teamsTable.id, teamId));

  res.status(201).json(player);
});

router.get("/players/:playerId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = GetPlayerParams.safeParse({ playerId: req.params.playerId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, params.data.playerId));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  if (!(await assertTeamAccess(player.teamId, req, res))) return;

  res.json(player);
});

router.patch("/players/:playerId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = UpdatePlayerParams.safeParse({ playerId: req.params.playerId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select({ teamId: playersTable.teamId }).from(playersTable).where(eq(playersTable.id, params.data.playerId));
  if (!existing) { res.status(404).json({ error: "Player not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if ("number" in d) updates.number = d.number;
  if ("position" in d) updates.position = d.position;
  if ("email" in d) updates.email = d.email;
  if ("phone" in d) updates.phone = d.phone;
  if ("dateOfBirth" in d) updates.dateOfBirth = d.dateOfBirth;
  if ("notes" in d) updates.notes = d.notes;
  if (d.status !== undefined) updates.status = d.status;

  if (Object.keys(updates).length === 0) {
    const [p] = await db.select().from(playersTable).where(eq(playersTable.id, params.data.playerId));
    if (!p) { res.status(404).json({ error: "Player not found" }); return; }
    res.json(p);
    return;
  }

  const [player] = await db.update(playersTable).set(updates).where(eq(playersTable.id, params.data.playerId)).returning();
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(player);
});

router.delete("/players/:playerId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = DeletePlayerParams.safeParse({ playerId: req.params.playerId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select({ teamId: playersTable.teamId }).from(playersTable).where(eq(playersTable.id, params.data.playerId));
  if (!existing) { res.status(404).json({ error: "Player not found" }); return; }
  if (!(await assertTeamAccess(existing.teamId, req, res))) return;

  const [player] = await db.delete(playersTable).where(eq(playersTable.id, params.data.playerId)).returning();
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  await db
    .update(teamsTable)
    .set({ playerCount: sql`greatest(${teamsTable.playerCount} - 1, 0)` })
    .where(eq(teamsTable.id, player.teamId));

  res.sendStatus(204);
});

export default router;
