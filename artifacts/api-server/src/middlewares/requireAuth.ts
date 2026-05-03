import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthedRequest extends Request {
  userId?: number;
  clerkId?: string;
}

export const requireAuth = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const auth = getAuth(req);
  const clerkId = auth?.userId;
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.clerkId = clerkId;

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found. Please complete registration." });
    return;
  }

  req.userId = user.id;
  next();
};
