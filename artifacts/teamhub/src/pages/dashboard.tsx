import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, CheckSquare, AlertCircle, ArrowRight, Zap } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";

export default function Dashboard() {
  const { t } = useI18n();
  const { data: summary, isLoading, error } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-40 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-white/40">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p>{t.common.error}</p>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-6">

      {/* Hero card */}
      <div className="hero-card p-7" style={{ background: "linear-gradient(135deg, hsl(22,100%,42%) 0%, hsl(22,90%,28%) 100%)" }}>
        <p className="section-label text-white/60 mb-1">{t.dashboard.subtitle}</p>
        <h1 className="font-wordmark text-5xl text-white leading-none mb-1">TEAMHUB</h1>
        <p className="text-white/60 text-sm font-medium">
          <span className="ltr-num">{summary.totalTeams}</span> {t.teams.title.toLowerCase()} · <span className="ltr-num">{summary.totalPlayers}</span> {t.dashboard.athletes.toLowerCase()}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <div>
            <div className="stat-value text-white ltr-num">{summary.totalTeams}</div>
            <div className="stat-label mt-1">{t.dashboard.squads}</div>
          </div>
          <div>
            <div className="stat-value text-white ltr-num">{summary.upcomingEventsCount}</div>
            <div className="stat-label mt-1">{t.dashboard.lineup}</div>
          </div>
          <div>
            <div className="stat-value ltr-num" style={{ color: summary.pendingTasksCount > 0 ? "#f7b538" : "white" }}>
              {summary.pendingTasksCount}
            </div>
            <div className="stat-label mt-1">{t.dashboard.openTasks}</div>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t.dashboard.squads, value: summary.totalTeams, color: "hsl(22,100%,60%)", icon: Zap },
          { label: t.dashboard.athletes, value: summary.totalPlayers, color: "#4a90e2", icon: Users },
          { label: t.dashboard.lineup, value: summary.upcomingEventsCount, color: "#f7b538", icon: Calendar },
          { label: t.dashboard.openTasks, value: summary.pendingTasksCount, color: "#e74c3c", icon: CheckSquare },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl p-4 border border-white/6"
            style={{ background: "rgba(22,27,46,0.8)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="stat-label">{s.label}</span>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${s.color}22` }}>
                <s.icon className="h-3.5 w-3.5" style={{ color: s.color }} />
              </div>
            </div>
            <div className="font-display text-4xl leading-none ltr-num" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Squad breakdown */}
      <div className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "rgba(22,27,46,0.8)" }}>
        <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
          <p className="section-label">{t.dashboard.squadBreakdown}</p>
          <Link href="/teams">
            <span className="text-xs text-primary font-semibold hover:text-primary/80 transition-colors cursor-pointer flex items-center gap-1">
              {t.dashboard.allSquads} <ArrowRight className="h-3 w-3 flip-rtl" />
            </span>
          </Link>
        </div>

        {summary.teamBreakdown.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-white/30 text-sm mb-3">{t.dashboard.noSquadsYet}</p>
            <Link href="/teams">
              <span className="text-primary text-sm font-semibold cursor-pointer hover:text-primary/80">
                {t.dashboard.createFirstSquad}
              </span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {summary.teamBreakdown.map((team) => (
              <Link key={team.teamId} href={`/teams/${team.teamId}`}>
                <div className="px-5 py-4 flex items-center gap-4 hover:bg-white/4 transition-colors cursor-pointer group">
                  {/* Team initial tile */}
                  <div className="jersey-tile flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, hsl(22,100%,55%), hsl(22,90%,35%))" }}>
                    {team.teamName.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-white group-hover:text-primary transition-colors truncate">
                      {team.teamName}
                    </h4>
                    <p className="text-xs text-white/40 font-medium">
                      {team.sport} · <span className="ltr-num">{team.playerCount}</span> {t.dashboard.athletes.toLowerCase()}
                    </p>
                  </div>

                  {/* Scoreboard mini stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <div className="font-display text-2xl leading-none ltr-num" style={{ color: "#f7b538" }}>
                        {team.upcomingEvents}
                      </div>
                      <div className="stat-label mt-0.5">{t.dashboard.games}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-2xl leading-none ltr-num" style={{ color: team.pendingTasks > 0 ? "#e74c3c" : "#2ecc71" }}>
                        {team.pendingTasks}
                      </div>
                      <div className="stat-label mt-0.5">{t.dashboard.tasks}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/20 group-hover:text-primary transition-colors flip-rtl" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-3">
        <Link href="/teams">
          <div className="rounded-2xl border border-primary/20 p-4 flex items-center gap-4 cursor-pointer hover:bg-primary/8 transition-all group"
            style={{ background: "rgba(255,107,53,0.06)" }}>
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/30 transition-colors">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-white text-sm">{t.dashboard.manageSquads}</p>
              <p className="text-xs text-white/40">{t.dashboard.manageSquadsDesc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-primary/50 group-hover:text-primary transition-colors flip-rtl" />
          </div>
        </Link>
      </div>

    </div>
  );
}
