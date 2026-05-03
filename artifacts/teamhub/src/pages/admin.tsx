import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users, BarChart3, ShieldCheck, Trash2, AlertCircle,
  TrendingUp, Calendar, CheckSquare, MessageSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { he, es, enUS } from "date-fns/locale";

const DATE_LOCALES = { he, es, en: enUS };

type AdminUser = {
  id: number;
  clerkId: string;
  email: string;
  name: string;
  role: "coach" | "player" | "admin";
  createdAt: string;
};

type AdminKpis = {
  totalUsers: number;
  totalTeams: number;
  totalEvents: number;
  totalTasks: number;
  totalMessages: number;
  recentUsers: AdminUser[];
};

async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export default function AdminPage() {
  const { t, language } = useI18n();
  const ad = t.admin;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"kpis" | "users">("kpis");
  const dateLocale = DATE_LOCALES[language] ?? enUS;

  const { data: kpis, isLoading: kpisLoading, error: kpisError } = useQuery<AdminKpis>({
    queryKey: ["admin", "kpis"],
    queryFn: () => apiFetch("/api/admin/kpis"),
    retry: false,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch("/api/admin/users"),
    enabled: tab === "users",
    retry: false,
  });

  async function handleRoleChange(userId: number, role: string) {
    try {
      await apiFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({ title: ad.roleUpdated });
    } catch {
      toast({ title: ad.failedLoad, variant: "destructive" });
    }
  }

  async function handleDeleteUser(userId: number) {
    if (!confirm(ad.confirmDeleteUser)) return;
    try {
      await apiFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({ title: ad.userDeleted });
    } catch {
      toast({ title: ad.failedLoad, variant: "destructive" });
    }
  }

  if (kpisError && (kpisError as Error).message?.includes("Admin")) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-white/40">
        <ShieldCheck className="h-12 w-12 text-red-500 mb-4" />
        <p>{ad.notAdmin}</p>
      </div>
    );
  }

  const kpiCards = kpis ? [
    { label: ad.totalUsers, value: kpis.totalUsers, icon: Users, color: "#4a90e2" },
    { label: ad.totalTeams, value: kpis.totalTeams, icon: TrendingUp, color: "#FF6B35" },
    { label: ad.totalEvents, value: kpis.totalEvents, icon: Calendar, color: "#f7b538" },
    { label: ad.totalTasks, value: kpis.totalTasks, icon: CheckSquare, color: "#2ecc71" },
    { label: ad.totalMessages, value: kpis.totalMessages, icon: MessageSquare, color: "#9b59b6" },
  ] : [];

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">{ad.subtitle.toUpperCase()}</p>
          <h1 className="font-display text-4xl text-white tracking-wide">{ad.title.toUpperCase()}</h1>
        </div>
        <ShieldCheck className="h-10 w-10 text-primary opacity-60" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("kpis")}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: tab === "kpis" ? "rgba(255,107,53,0.2)" : "rgba(255,255,255,0.05)",
            color: tab === "kpis" ? "#FF6B35" : "rgba(255,255,255,0.4)",
            border: tab === "kpis" ? "1px solid rgba(255,107,53,0.4)" : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <BarChart3 className="h-4 w-4 inline me-2" />
          {ad.kpis}
        </button>
        <button
          onClick={() => setTab("users")}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{
            background: tab === "users" ? "rgba(255,107,53,0.2)" : "rgba(255,255,255,0.05)",
            color: tab === "users" ? "#FF6B35" : "rgba(255,255,255,0.4)",
            border: tab === "users" ? "1px solid rgba(255,107,53,0.4)" : "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Users className="h-4 w-4 inline me-2" />
          {ad.users}
        </button>
      </div>

      {tab === "kpis" && (
        <div className="space-y-6">
          {kpisLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-28 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
            </div>
          ) : kpisError ? (
            <div className="flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle className="h-5 w-5" />
              {ad.failedLoad}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {kpiCards.map(card => (
                <div key={card.label} className="rounded-2xl p-4 border border-white/6" style={{ background: "rgba(22,27,46,0.8)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${card.color}20` }}>
                    <card.icon className="h-5 w-5" style={{ color: card.color }} />
                  </div>
                  <p className="font-display text-3xl text-white ltr-num">{card.value.toLocaleString()}</p>
                  <p className="text-xs text-white/40 mt-1 font-medium">{card.label}</p>
                </div>
              ))}
            </div>
          )}

          {kpis && (
            <div className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "rgba(22,27,46,0.8)" }}>
              <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="font-semibold text-white text-sm">{ad.recentUsers}</p>
              </div>
              <div className="divide-y divide-white/5">
                {kpis.recentUsers.map(user => (
                  <div key={user.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                      style={{ background: "rgba(255,107,53,0.15)", color: "#FF6B35" }}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                      <p className="text-xs text-white/40 truncate">{user.email}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-md font-semibold shrink-0"
                      style={{
                        background: user.role === "admin" ? "rgba(255,107,53,0.2)" : user.role === "coach" ? "rgba(74,144,226,0.2)" : "rgba(46,204,113,0.2)",
                        color: user.role === "admin" ? "#FF6B35" : user.role === "coach" ? "#4a90e2" : "#2ecc71",
                      }}>
                      {ad[user.role]}
                    </span>
                    <p className="text-xs text-white/30 shrink-0 ltr-num">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: dateLocale })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "rgba(22,27,46,0.8)" }}>
          <div className="px-5 py-4 border-b border-white/6">
            <p className="font-semibold text-white text-sm">{ad.users}</p>
          </div>
          {usersLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {users.map(user => (
                <div key={user.id} className="px-5 py-3 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: "rgba(255,107,53,0.15)", color: "#FF6B35" }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <p className="text-xs text-white/40 truncate">{user.email}</p>
                    <p className="text-[10px] text-white/25 ltr-num">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true, locale: dateLocale })}
                    </p>
                  </div>
                  <div dir="ltr" className="shrink-0">
                    <Select value={user.role} onValueChange={(val) => handleRoleChange(user.id, val)}>
                      <SelectTrigger className="h-8 text-xs rounded-lg border-white/10 w-28" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-white/10" style={{ background: "#1f2742" }}>
                        <SelectItem value="coach" className="text-white text-xs">{ad.coach}</SelectItem>
                        <SelectItem value="player" className="text-white text-xs">{ad.player}</SelectItem>
                        <SelectItem value="admin" className="text-white text-xs">{ad.admin}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-400 hover:bg-red-400/10 h-8 w-8 shrink-0"
                    onClick={() => handleDeleteUser(user.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
