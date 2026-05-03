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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft, Users, Calendar, CheckSquare, MessageSquare,
  Clock, AlertCircle, Activity, Link2, Check,
} from "lucide-react";
import PlayersTab from "@/components/team/players-tab";
import EventsTab from "@/components/team/events-tab";
import TasksTab from "@/components/team/tasks-tab";
import MessagesTab from "@/components/team/messages-tab";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const id = Number(teamId);

  const { data: team, isLoading: teamLoading } = useGetTeam(id, {
    query: { enabled: !!id, queryKey: getGetTeamQueryKey(id) },
  });
  const { data: activity = [] } = useGetTeamActivity(id, {
    query: { enabled: !!id, queryKey: getGetTeamActivityQueryKey(id) },
  });

  function copyMemberLink() {
    if (!team || !(team as any).joinCode) return;
    const joinCode = (team as any).joinCode as string;
    const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${base}/member/${joinCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      toast({ title: "Member link copied to clipboard", description: "Share this link with your players" });
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (teamLoading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p>Team not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => setLocation("/teams")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Teams
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/teams")} data-testid="button-back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ backgroundColor: team.avatarColor }}
          >
            {team.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-team-name">{team.name}</h1>
              <Badge variant="secondary">{team.sport}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Coach: {team.coachName}
              {team.season && ` • ${team.season}`}
            </p>
          </div>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={copyMemberLink}
              className="shrink-0"
              data-testid="button-share-member-link"
            >
              {copied ? (
                <><Check className="h-4 w-4 mr-2 text-green-500" />Copied</>
              ) : (
                <><Link2 className="h-4 w-4 mr-2" />Share with Team</>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Copy the member link to share with your players</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <Tabs defaultValue="players" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full md:w-auto md:inline-flex">
          <TabsTrigger value="players" data-testid="tab-players">
            <Users className="h-4 w-4 mr-1.5" />
            Roster
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">
            <Calendar className="h-4 w-4 mr-1.5" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <CheckSquare className="h-4 w-4 mr-1.5" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="messages" data-testid="tab-messages">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Messages
          </TabsTrigger>
        </TabsList>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <TabsContent value="players"><PlayersTab teamId={id} /></TabsContent>
            <TabsContent value="events"><EventsTab teamId={id} /></TabsContent>
            <TabsContent value="tasks"><TasksTab teamId={id} /></TabsContent>
            <TabsContent value="messages"><MessagesTab teamId={id} /></TabsContent>
          </div>

          <div className="lg:col-span-1 space-y-4">
            {/* Member link card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-primary mb-1.5">Member Access</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Share the member link with your players. They'll see the schedule, messages, tasks, and roster — but nothing from other teams.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full border-primary/30 text-primary hover:bg-primary/10"
                  onClick={copyMemberLink}
                  data-testid="button-copy-member-link-card"
                >
                  {copied ? (
                    <><Check className="h-3.5 w-3.5 mr-2 text-green-500" />Link Copied</>
                  ) : (
                    <><Link2 className="h-3.5 w-3.5 mr-2" />Copy Member Link</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Activity feed */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activity.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No recent activity</p>
                ) : (
                  activity.slice(0, 8).map(item => (
                    <div key={item.id} className="flex gap-2" data-testid={`activity-item-${item.id}`}>
                      <Clock className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs">{item.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(item.occurredAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
