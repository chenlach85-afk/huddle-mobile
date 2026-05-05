import { Router, type IRouter } from "express";
import { eq, inArray, sql } from "drizzle-orm";
import { db, teamsTable, teamMembersTable, playersTable } from "@workspace/db";
import {
  CreateTeamBody,
  GetTeamParams,
  UpdateTeamParams,
  UpdateTeamBody,
  DeleteTeamParams,
} from "@workspace/api-zod";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { assertTeamAccess } from "../helpers/teamAccess";

const router: IRouter = Router();

router.get("/teams", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;
  const userRole = req.userRole!;

  if (userRole === "admin") {
    const teams = await db
      .select({
        id: teamsTable.id,
        name: teamsTable.name,
        sport: teamsTable.sport,
        season: teamsTable.season,
        description: teamsTable.description,
        coachName: teamsTable.coachName,
        avatarColor: teamsTable.avatarColor,
        imageUrl: teamsTable.imageUrl,
        location: teamsTable.location,
        playerCount: teamsTable.playerCount,
        createdAt: teamsTable.createdAt,
        updatedAt: teamsTable.updatedAt,
      })
      .from(teamsTable)
      .orderBy(teamsTable.createdAt);
    res.json(teams);
    return;
  }

  const [ownedRows, memberRows] = await Promise.all([
    db.select({ teamId: teamsTable.id }).from(teamsTable).where(eq(teamsTable.createdBy, userId)),
    db.select({ teamId: teamMembersTable.teamId }).from(teamMembersTable).where(eq(teamMembersTable.userId, userId)),
  ]);

  const teamIdSet = new Set([
    ...ownedRows.map((r) => r.teamId),
    ...memberRows.map((r) => r.teamId),
  ]);
  const teamIds = [...teamIdSet];

  if (teamIds.length === 0) {
    res.json([]);
    return;
  }

  const teams = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      sport: teamsTable.sport,
      season: teamsTable.season,
      description: teamsTable.description,
      coachName: teamsTable.coachName,
      avatarColor: teamsTable.avatarColor,
      imageUrl: teamsTable.imageUrl,
      location: teamsTable.location,
      playerCount: teamsTable.playerCount,
      createdAt: teamsTable.createdAt,
      updatedAt: teamsTable.updatedAt,
    })
    .from(teamsTable)
    .where(inArray(teamsTable.id, teamIds))
    .orderBy(teamsTable.createdAt);

  res.json(teams);
});

router.post("/teams", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const parsed = CreateTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;
  const userId = req.userId!;

  const [team] = await db
    .insert(teamsTable)
    .values({
      name: data.name,
      sport: data.sport,
      season: data.season ?? null,
      description: data.description ?? null,
      coachName: data.coachName,
      avatarColor: data.avatarColor ?? "#3b82f6",
      imageUrl: data.imageUrl ?? null,
      location: data.location ?? null,
      createdBy: userId,
    })
    .returning();

  await db.insert(teamMembersTable).values({
    teamId: team.id,
    userId,
    role: "coach",
  }).onConflictDoNothing();

  res.status(201).json(team);
});

router.get("/teams/:teamId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = GetTeamParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const [team] = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      sport: teamsTable.sport,
      season: teamsTable.season,
      description: teamsTable.description,
      coachName: teamsTable.coachName,
      avatarColor: teamsTable.avatarColor,
      imageUrl: teamsTable.imageUrl,
      location: teamsTable.location,
      playerCount: teamsTable.playerCount,
      joinCode: teamsTable.joinCode,
      createdAt: teamsTable.createdAt,
      updatedAt: teamsTable.updatedAt,
    })
    .from(teamsTable)
    .where(eq(teamsTable.id, teamId));
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  res.json(team);
});

router.patch("/teams/:teamId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = UpdateTeamParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTeamBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.sport !== undefined) updates.sport = d.sport;
  if ("season" in d) updates.season = d.season;
  if ("description" in d) updates.description = d.description;
  if (d.coachName !== undefined) updates.coachName = d.coachName;
  if (d.avatarColor !== undefined) updates.avatarColor = d.avatarColor;
  if ("imageUrl" in d) updates.imageUrl = d.imageUrl;
  if ("location" in d) updates.location = d.location;

  if (Object.keys(updates).length === 0) {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId));
    if (!team) { res.status(404).json({ error: "Team not found" }); return; }
    res.json(team);
    return;
  }

  const [team] = await db
    .update(teamsTable)
    .set(updates)
    .where(eq(teamsTable.id, teamId))
    .returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  res.json(team);
});

router.delete("/teams/:teamId", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const params = DeleteTeamParams.safeParse({ teamId: req.params.teamId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const teamId = params.data.teamId;

  if (!(await assertTeamAccess(teamId, req, res))) return;

  const [team] = await db.delete(teamsTable).where(eq(teamsTable.id, teamId)).returning();
  if (!team) { res.status(404).json({ error: "Team not found" }); return; }
  res.sendStatus(204);
});

export default router;
