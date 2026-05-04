import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";

export const adminAuditLogTable = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull(),
  action: text("action", {
    enum: [
      "user_suspended",
      "user_reactivated",
      "user_soft_deleted",
      "user_hard_deleted",
      "user_role_changed",
      "user_edited",
      "team_archived",
      "team_transferred",
      "team_deleted",
      "invitation_created",
      "invitation_revoked",
      "user_registered_via_invitation",
      "user_promoted_admin",
      "user_demoted_admin",
    ],
  }).notNull(),
  targetUserId: integer("target_user_id"),
  targetTeamId: integer("target_team_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminAuditLog = typeof adminAuditLogTable.$inferSelect;
