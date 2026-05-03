import { useParams, useLocation } from "wouter";
import {
  useGetTeam,
  useGetTeamActivity,
  getGetTeamQueryKey,
  getGetTeamActivityQueryKey,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft, Users, Calendar, CheckSquare, MessageSquare,
  AlertCircle, Activity, Link2, Check, Zap,
} from "lucide-react";
import PlayersTab from "@/components/team/players-tab";
import EventsTab from "@/components/team/events-tab";
import TasksTab from "@/components/team/tasks-tab";
import MessagesTab from "@/components/team/messages-tab";
import { formatDistanceToNow } from "date-fns";
import { he, es, enUS } from "date-fns/locale";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

const ACTIVITY_COLORS: Record<string, string> = {
  event_created: "#f7b538",
  player_added: "#2ecc71",
  task_created: "#4a90e2",
  task_completed: "#2ecc71",
  message_sent: "#9b59b6",
};

const DATE_LOCALES = { he, es, en: enUS };

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t, language } = useI18n();
  const td = t.teamDetail;
  const [copied, setCopied] = useState(false);
  const id = Number(teamId);

  const { data: team, isLoading: teamLoading } = useGetTeam(id, {
    query: { enabled: !!id, queryKey: getGetTeamQueryKey(id) },
  });
  const { data: activity = [] } = useGetTeamActivity(id, {
    query: { enabled: !!id, queryKey: getGetTeamActivityQueryKey(id) },
  });

  const teamColor = team?.avatarColor ?? "#FF6B35";
  const dateLocale = DATE_LOCALES[language] ?? enUS;

  function copyMemberLink() {
    if (!team || !(team as any).joinCode) return;
    const joinCode = (team as any).joinCode as string;
    const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${base}/member/${joinCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast({ title: td.memberLinkCopied, description: td.shareWithPlayers });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (teamLoading) {
    return (
      <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-5">
        <Skeleton className="h-32 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
        <Skeleton className="h-10 w-72 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }} />
        <Skeleton className="h-96 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-white/40">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p>{td.squadNotFound}</p>
        <Button variant="ghost" className="mt-4 text-white/50 hover:text-white" onClick={() => setLocation("/teams")}>
          <ArrowLeft className="h-4 w-4 me-2 flip-rtl" />
          {td.backToSquads}
        </Button>
      </div>
    );
  }

  const tabs = [
    { value: "players", label: td.tabSquad, icon: Users },
    { value: "events", label: td.tabLineup, icon: Calendar },
    { value: "tasks", label: td.tabTasks, icon: CheckSquare },
    { value: "messages", label: td.tabHuddle, icon: MessageSquare },
  ];

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-5">

      <div className="hero-card p-5 flex items-center gap-4" style={{
        background: `linear-gradient(135deg, ${teamColor}cc 0%, ${teamColor}55 100%)`,
        borderColor: `${teamColor}33`,
        border: `1px solid ${teamColor}33`,
      }}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/teams")}
          className="text-white/70 hover:text-white hover:bg-white/10 shrink-0"
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5 flip-rtl" />
        </Button>

        <div
          className="jersey-tile text-2xl shadow-lg shrink-0"
          style={{ background: `linear-gradient(135deg, white 0%, rgba(255,255,255,0.7) 100%)`, color: teamColor }}
        >
          {team.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-display text-3xl text-white tracking-wide leading-none" data-testid="text-team-name">
            {team.name.toUpperCase()}
          </h1>
          <p className="text-white/60 text-sm font-medium mt-1">
            {team.sport} · {td.coachLabel} {team.coachName}{team.season ? ` · ${team.season}` : ""}
          </p>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={copyMemberLink}
              className="shrink-0 font-semibold rounded-xl text-white border border-white/20 hover:border-white/40"
              style={{ background: "rgba(255,255,255,0.12)" }}
              data-testid="button-share-member-link"
            >
              {copied ? (
                <><Check className="h-4 w-4 me-1.5 text-green-400" />{td.copied}</>
              ) : (
                <><Link2 className="h-4 w-4 me-1.5" />{td.shareLink}</>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{td.copyLinkTooltip}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Tabs defaultValue="players" className="space-y-4">
        <TabsList className="border border-white/8 p-1 rounded-xl h-auto gap-0.5" style={{ background: "rgba(22,27,46,0.9)" }}>
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-lg px-4 py-2 text-white/50 font-semibold text-sm data-[state=active]:text-white data-[state=active]:shadow-none transition-all"
              data-testid={`tab-${tab.value}`}
            >
              <tab.icon className="h-3.5 w-3.5 me-1.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-3">
            <TabsContent value="players" className="mt-0"><PlayersTab teamId={id} teamColor={teamColor} /></TabsContent>
            <TabsContent value="events" className="mt-0"><EventsTab teamId={id} teamColor={teamColor} /></TabsContent>
            <TabsContent value="tasks" className="mt-0"><TasksTab teamId={id} teamColor={teamColor} /></TabsContent>
            <TabsContent value="messages" className="mt-0"><MessagesTab teamId={id} teamColor={teamColor} /></TabsContent>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-2xl p-4 border" style={{ background: `${teamColor}10`, borderColor: `${teamColor}30` }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5" style={{ color: teamColor }} />
                <p className="text-xs font-bold tracking-widest uppercase" style={{ color: teamColor }}>{td.memberAccess}</p>
              </div>
              <p className="text-xs text-white/40 mb-3 leading-relaxed">{td.memberAccessDesc}</p>
              <Button
                size="sm"
                onClick={copyMemberLink}
                className="w-full font-semibold rounded-xl text-white border"
                style={{ background: `${teamColor}20`, borderColor: `${teamColor}40` }}
                data-testid="button-copy-member-link-card"
              >
                {copied ? (
                  <><Check className="h-3.5 w-3.5 me-1.5 text-green-400" />{td.copied}!</>
                ) : (
                  <><Link2 className="h-3.5 w-3.5 me-1.5" />{td.copyMemberLink}</>
                )}
              </Button>
            </div>

            <div className="rounded-2xl border border-white/6 overflow-hidden" style={{ background: "rgba(22,27,46,0.8)" }}>
              <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-white/40" />
                <p className="section-label">{td.recentActivity}</p>
              </div>
              <div className="p-3 space-y-2">
                {activity.length === 0 ? (
                  <p className="text-xs text-white/25 text-center py-4">{td.noRecentActivity}</p>
                ) : (
                  activity.slice(0, 8).map(item => (
                    <div key={item.id} className="flex gap-2.5 py-1.5 border-s-2 ps-2.5" style={{ borderColor: ACTIVITY_COLORS[item.type] ?? "#4a90e2" }} data-testid={`activity-item-${item.id}`}>
                      <div>
                        <p className="text-xs text-white/70 leading-tight">{item.description}</p>
                        <p className="text-[10px] text-white/30 mt-0.5 ltr-num">
                          {formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true, locale: dateLocale })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
