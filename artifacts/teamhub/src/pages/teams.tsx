import { useState } from "react";
import {
  useListTeams,
  useCreateTeam,
  useDeleteTeam,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

const TEAM_COLORS = [
  { label: "Ignition", value: "#FF6B35" },
  { label: "Blue", value: "#4A90E2" },
  { label: "Green", value: "#2ECC71" },
  { label: "Purple", value: "#9B59B6" },
  { label: "Gold", value: "#F7B538" },
  { label: "Red", value: "#E74C3C" },
  { label: "Teal", value: "#1ABC9C" },
  { label: "Pink", value: "#E91E8C" },
];

const createTeamSchema = z.object({
  name: z.string().min(1, "Squad name is required"),
  sport: z.string().min(1, "Sport is required"),
  season: z.string().optional(),
  description: z.string().optional(),
  coachName: z.string().min(1, "Coach name is required"),
  avatarColor: z.string().default("#FF6B35"),
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
    defaultValues: { name: "", sport: "", season: "", description: "", coachName: "", avatarColor: "#FF6B35" },
  });

  function onSubmit(values: CreateTeamForm) {
    createTeam.mutate(
      { data: { name: values.name, sport: values.sport, season: values.season || null, description: values.description || null, coachName: values.coachName, avatarColor: values.avatarColor } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setOpen(false);
          form.reset();
          toast({ title: "Squad created" });
        },
        onError: () => toast({ title: "Failed to create squad", variant: "destructive" }),
      }
    );
  }

  function handleDelete(e: React.MouseEvent, teamId: number) {
    e.stopPropagation();
    if (!confirm("Delete this squad and all its data?")) return;
    deleteTeam.mutate({ teamId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        toast({ title: "Squad deleted" });
      },
      onError: () => toast({ title: "Failed to delete squad", variant: "destructive" }),
    });
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-white/40">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p>Failed to load squads.</p>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">COACH PANEL</p>
          <h1 className="font-display text-4xl text-white tracking-wide">YOUR SQUADS</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/20" data-testid="button-create-team">
              <Plus className="h-4 w-4 mr-2" />
              New Squad
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md border-white/10" style={{ background: "#161b2e" }}>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl text-white tracking-wide">CREATE SQUAD</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">Squad Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Lightning FC" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-team-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="sport" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">Sport</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl" data-testid="select-sport">
                          <SelectValue placeholder="Select sport" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="border-white/10" style={{ background: "#1f2742" }}>
                        {SPORTS.map(s => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="coachName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">Coach Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-coach-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="season" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">Season (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Spring 2025" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-season" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="avatarColor" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">Squad Color</FormLabel>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {TEAM_COLORS.map(c => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => field.onChange(c.value)}
                          className={`w-8 h-8 rounded-lg border-2 transition-all ${field.value === c.value ? "border-white scale-110 shadow-lg" : "border-transparent opacity-70 hover:opacity-100"}`}
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
                    <FormLabel className="stat-label text-white/50">Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Brief team description..." className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-11" disabled={createTeam.isPending} data-testid="button-submit-team">
                  {createTeam.isPending ? "Creating..." : "Create Squad"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-white/6 p-12 text-center" style={{ background: "rgba(22,27,46,0.8)" }}>
          <Users className="h-12 w-12 mx-auto text-white/20 mb-4" />
          <h3 className="font-display text-2xl text-white tracking-wide mb-2">NO SQUADS YET</h3>
          <p className="text-white/40 text-sm mb-5">Create your first squad to get started</p>
          <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl" data-testid="button-create-first-team">
            <Plus className="h-4 w-4 mr-2" />
            Create Squad
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {teams.map(team => (
            <div
              key={team.id}
              className="rounded-2xl border border-white/6 p-4 flex items-center gap-4 cursor-pointer hover:bg-white/4 transition-all group"
              style={{ background: "rgba(22,27,46,0.8)" }}
              onClick={() => setLocation(`/teams/${team.id}`)}
              data-testid={`card-team-${team.id}`}
            >
              {/* Jersey tile */}
              <div
                className="jersey-tile text-xl shadow-lg"
                style={{ background: `linear-gradient(135deg, ${team.avatarColor}, ${team.avatarColor}99)` }}
              >
                {team.name.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-white group-hover:text-primary transition-colors" data-testid={`text-team-name-${team.id}`}>
                    {team.name}
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-md font-semibold"
                    style={{ background: `${team.avatarColor}22`, color: team.avatarColor }}>
                    {team.sport}
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-0.5 font-medium">
                  {team.coachName}{team.season ? ` · ${team.season}` : ""} · {team.playerCount} athletes
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-400 hover:bg-red-400/10 h-8 w-8"
                  onClick={(e) => handleDelete(e, team.id)}
                  data-testid={`button-delete-team-${team.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-primary transition-colors" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
