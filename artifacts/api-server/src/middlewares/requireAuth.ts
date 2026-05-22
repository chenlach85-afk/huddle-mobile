import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { supabaseAdmin } from "../lib/supabase";

export interface AuthedRequest extends Request {
  userId?: number;
  supabaseUserId?: string;
  userRole?: "coach" | "player" | "admin";
}

export const requireAuth = async (
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.supabaseUserId = user.id;

  const [dbUser] = await db
    .select({ id: usersTable.id, accountStatus: usersTable.accountStatus, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.clerkId, user.id))
    .limit(1);

  if (!dbUser) {
    res.status(401).json({ error: "User not found. Please complete registration." });
    return;
  }

  if (dbUser.accountStatus === "suspended") {
    res.status(403).json({ error: "account_suspended", message: "Your account has been suspended. Please contact support." });
    return;
  }

  if (dbUser.accountStatus === "deleted") {
    res.status(403).json({ error: "account_deleted", message: "This account no longer exists." });
    return;
  }

  req.userId = dbUser.id;
  req.userRole = dbUser.role as "coach" | "player" | "admin";
  next();
};
