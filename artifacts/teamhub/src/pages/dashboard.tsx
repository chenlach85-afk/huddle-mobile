import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Calendar, CheckSquare, MessageSquare, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p>Failed to load dashboard summary.</p>
      </div>
    );
  }

  const statCards = [
    { label: "Total Teams", value: summary.totalTeams, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Total Players", value: summary.totalPlayers, icon: Users, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Upcoming Events", value: summary.upcomingEventsCount, icon: Calendar, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Pending Tasks", value: summary.pendingTasksCount, icon: CheckSquare, color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground mt-1">Here's what's happening across your teams today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i}>
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                <h3 className="text-3xl font-bold mt-1">{stat.value}</h3>
              </div>
              <div className={`p-3 rounded-full ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Team Breakdown</CardTitle>
            <CardDescription>Status summary for each team</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.teamBreakdown.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <p>No teams yet.</p>
                <Link href="/teams">
                  <div className="mt-4 text-primary font-medium hover:underline cursor-pointer">Create your first team</div>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {summary.teamBreakdown.map((team) => (
                  <Link key={team.teamId} href={`/teams/${team.teamId}`}>
                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                      <div>
                        <h4 className="font-semibold group-hover:text-primary transition-colors">{team.teamName}</h4>
                        <p className="text-sm text-muted-foreground">{team.sport} • {team.playerCount} players</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5" title="Upcoming Events">
                          <Calendar className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">{team.upcomingEvents}</span>
                        </div>
                        <div className="flex items-center gap-1.5" title="Pending Tasks">
                          <CheckSquare className="h-4 w-4 text-rose-500" />
                          <span className="font-medium">{team.pendingTasks}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Manage your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/teams">
              <div className="w-full justify-start text-left font-normal border p-4 rounded-md cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                <div className="font-medium">View all teams</div>
                <div className="text-xs text-muted-foreground mt-1">Manage rosters, schedules, and messages</div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
