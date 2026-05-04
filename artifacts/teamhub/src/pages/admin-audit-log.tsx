import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList, ChevronLeft, ChevronRight, ChevronDown, AlertCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { he, es, enUS } from "date-fns/locale";

const DATE_LOCALES = { he, es, en: enUS };

type AuditEntry = {
  id: number;
  action: string;
  targetUserId: number | null;
  targetTeamId: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  adminId: number;
  adminName: string | null;
  adminEmail: string | null;
};

const ACTION_COLORS: Record<string, string> = {
  user_suspended: "#f7b538",
  user_reactivated: "#2ecc71",
  user_soft_deleted: "#FF6B35",
  user_hard_deleted: "#ef4444",
  user_role_changed: "#4a90e2",
  user_edited: "#9b59b6",
  team_archived: "#f7b538",
  team_transferred: "#4a90e2",
  team_deleted: "#ef4444",
};

const ACTION_LABELS: Record<string, string> = {
  user_suspended: "User Suspended",
  user_reactivated: "User Reactivated",
  user_soft_deleted: "User Soft Deleted",
  user_hard_deleted: "User Hard Deleted",
  user_role_changed: "Role Changed",
  user_edited: "User Edited",
  team_archived: "Team Archived",
  team_transferred: "Team Transferred",
  team_deleted: "Team Deleted",
};

async function apiFetch(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load");
  return res.json();
}

export default function AuditLogPage() {
  const { t, language } = useI18n();
  const ad = t.admin;
  const dateLocale = DATE_LOCALES[language] ?? enUS;
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const limit = 25;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(actionFilter !== "all" ? { action: actionFilter } : {}),
  });

  const { data, isLoading, error } = useQuery<{ logs: AuditEntry[]; total: number; page: number; limit: number }>({
    queryKey: ["admin", "audit-log", page, actionFilter],
    queryFn: () => apiFetch(`/api/admin/audit-log?${params}`),
    retry: false,
    staleTime: 10_000,
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-white/40">
        <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
        <p>{ad.failedLoad}</p>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/admin">
          <Button variant="ghost" className="text-white/50 hover:text-white h-9 px-3 rounded-xl">
            <ChevronLeft className="h-4 w-4 me-1 flip-rtl" />
            {ad.title}
          </Button>
        </Link>
        <div className="flex-1">
          <p className="section-label mb-0.5">ADMIN</p>
          <h1 className="font-display text-3xl text-white">{ad.auditLog.toUpperCase()}</h1>
        </div>
        <ClipboardList className="h-8 w-8 text-primary opacity-50" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div dir="ltr" className="w-52">
          <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1); }}>
            <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
              <SelectItem value="all" className="text-white text-xs">All actions</SelectItem>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key} className="text-xs" style={{ color: ACTION_COLORS[key] ?? "white" }}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {total > 0 && (
          <p className="text-xs text-white/30">{total} entries</p>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
        {/* Header row */}
        <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_40px] px-5 py-3 border-b border-white/6 gap-4">
          <p className="stat-label">{ad.auditAction}</p>
          <p className="stat-label">{ad.auditAdmin}</p>
          <p className="stat-label">{ad.auditTarget}</p>
          <p className="stat-label">{ad.auditTime}</p>
          <div />
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="h-10 w-10 mx-auto text-white/15 mb-3" />
            <p className="text-sm text-white/30">{ad.noAuditLogs}</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map(entry => {
              const color = ACTION_COLORS[entry.action] ?? "rgba(255,255,255,0.4)";
              const label = ACTION_LABELS[entry.action] ?? entry.action;
              const isExpanded = expanded === entry.id;

              return (
                <div key={entry.id}>
                  <div
                    className="px-5 py-3 grid grid-cols-[1fr_auto] md:grid-cols-[1fr_1fr_1fr_1fr_40px] gap-4 items-center cursor-pointer hover:bg-white/2 transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : entry.id)}
                  >
                    <div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md"
                        style={{ background: `${color}18`, color }}>
                        {label}
                      </span>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-xs text-white/70">{entry.adminName ?? `#${entry.adminId}`}</p>
                      <p className="text-[10px] text-white/30">{entry.adminEmail}</p>
                    </div>
                    <div className="hidden md:block text-xs text-white/50">
                      {entry.targetUserId && <p>User #{entry.targetUserId}</p>}
                      {entry.targetTeamId && <p>Team #{entry.targetTeamId}</p>}
                    </div>
                    <div className="hidden md:block">
                      <p className="text-xs text-white/40 ltr-num">
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: dateLocale })}
                      </p>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                  {isExpanded && (
                    <div className="px-5 py-3 border-t border-white/5 space-y-2"
                      style={{ background: "rgba(0,0,0,0.2)" }}>
                      <div className="md:hidden space-y-1">
                        <p className="text-xs text-white/50">Admin: {entry.adminName} ({entry.adminEmail})</p>
                        {entry.targetUserId && <p className="text-xs text-white/50">Target user: #{entry.targetUserId}</p>}
                        {entry.targetTeamId && <p className="text-xs text-white/50">Target team: #{entry.targetTeamId}</p>}
                        <p className="text-xs text-white/40 ltr-num">
                          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: dateLocale })}
                        </p>
                      </div>
                      {entry.metadata && (
                        <div>
                          <p className="stat-label mb-1">{ad.auditMetadata}</p>
                          <pre className="text-[11px] text-white/60 p-3 rounded-xl overflow-x-auto"
                            style={{ background: "rgba(255,255,255,0.04)", fontFamily: "monospace" }}>
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" className="text-white/50 hover:text-white rounded-xl"
            onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4 me-1 flip-rtl" /> Previous
          </Button>
          <p className="text-xs text-white/40 ltr-num">Page {page} / {totalPages}</p>
          <Button variant="ghost" className="text-white/50 hover:text-white rounded-xl"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next <ChevronRight className="h-4 w-4 ms-1 flip-rtl" />
          </Button>
        </div>
      )}
    </div>
  );
}
