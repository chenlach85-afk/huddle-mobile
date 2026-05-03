import { useState } from "react";
import {
  useListTeams,
  useCreateTeam,
  useDeleteTeam,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users, ChevronRight, Trash2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SPORTS = ["Soccer", "Basketball", "Baseball", "Softball", "Football", "Volleyball", "Tennis", "Swimming", "Track", "Other"];
const COLORS = [
  { label: "Blue", value: "#3b82f6" },
  { label: "Orange", value: "#f97316" },
  { label: "Green", value: "#22c55e" },
  { label: "Purple", value: "#a855f7" },
  { label: "Red", value: "#ef4444" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Yellow", value: "#eab308" },
];

const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required"),
  sport: z.string().min(1, "Sport is required"),
  season: z.string().optional(),
  description: z.string().optional(),
  coachName: z.string().min(1, "Coach name is required"),
  avatarColor: z.string().default("#3b82f6"),
});

type CreateTeamForm = z.infer<typeof createTeamSchema>;

export default function TeamsPage() {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading, error } = useListTeams();
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();

  const form = useForm<CreateTeamForm>({
    resolver: zodResolver(createTeamSchema),
    defaultValues: { name: "", sport: "", season: "", description: "", coachName: "", avatarColor: "#3b82f6" },
  });

  function onSubmit(values: CreateTeamForm) {
    createTeam.mutate(
      { data: { name: values.name, sport: values.sport, season: values.season || null, description: values.description || null, coachName: values.coachName, avatarColor: values.avatarColor } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setOpen(false);
          form.reset();
          toast({ title: "Team created" });
        },
        onError: () => toast({ title: "Failed to create team", variant: "destructive" }),
      }
    );
  }

  function handleDelete(e: React.MouseEvent, teamId: number) {
    e.stopPropagation();
    if (!confirm("Delete this team and all its data?")) return;
    deleteTeam.mutate({ teamId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        toast({ title: "Team deleted" });
      },
      onError: () => toast({ title: "Failed to delete team", variant: "destructive" }),
    });
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-muted-foreground">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p>Failed to load teams.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          <p className="text-muted-foreground mt-1">Manage all your teams</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-team">
              <Plus className="h-4 w-4 mr-2" />
              New Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Name</FormLabel>
                    <FormControl><Input placeholder="e.g. Lightning FC" data-testid="input-team-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="sport" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sport</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-sport">
                          <SelectValue placeholder="Select sport" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SPORTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="coachName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coach Name</FormLabel>
                    <FormControl><Input placeholder="Your name" data-testid="input-coach-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="season" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Season (optional)</FormLabel>
                    <FormControl><Input placeholder="e.g. Spring 2025" data-testid="input-season" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="avatarColor" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team Color</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => field.onChange(c.value)}
                          className={`w-8 h-8 rounded-full border-2 transition-transform ${field.value === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                          style={{ backgroundColor: c.value }}
                          title={c.label}
                          data-testid={`color-${c.label.toLowerCase()}`}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl><Textarea placeholder="Brief team description..." data-testid="input-description" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createTeam.isPending} data-testid="button-submit-team">
                  {createTeam.isPending ? "Creating..." : "Create Team"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : teams.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No teams yet</h3>
            <p className="text-muted-foreground mb-4">Create your first team to get started</p>
            <Button onClick={() => setOpen(true)} data-testid="button-create-first-team">
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map(team => (
            <Card
              key={team.id}
              className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
              onClick={() => setLocation(`/teams/${team.id}`)}
              data-testid={`card-team-${team.id}`}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
                  style={{ backgroundColor: team.avatarColor }}
                >
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold truncate group-hover:text-primary transition-colors" data-testid={`text-team-name-${team.id}`}>{team.name}</h3>
                    <Badge variant="secondary" className="text-xs shrink-0">{team.sport}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {team.coachName} {team.season ? `• ${team.season}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <Users className="inline h-3 w-3 mr-1" />
                    {team.playerCount} players
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={(e) => handleDelete(e, team.id)}
                    data-testid={`button-delete-team-${team.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
