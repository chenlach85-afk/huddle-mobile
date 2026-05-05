import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthedRequest extends Request {
  userId?: number;
  clerkId?: string;
  userRole?: "coach" | "player" | "admin";
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
    .select({ id: usersTable.id, accountStatus: usersTable.accountStatus, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "User not found. Please complete registration." });
    return;
  }

  if (user.accountStatus === "suspended") {
    res.status(403).json({ error: "account_suspended", message: "Your account has been suspended. Please contact support." });
    return;
  }

  if (user.accountStatus === "deleted") {
    res.status(403).json({ error: "account_deleted", message: "This account no longer exists." });
    return;
  }

  req.userId = user.id;
  req.userRole = user.role as "coach" | "player" | "admin";
  next();
};
