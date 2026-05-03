import { useState } from "react";
import {
  useListTeams,
  useCreateTeam,
  useUpdateTeam,
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
import { Plus, Users, ChevronRight, Trash2, AlertCircle, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

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

const teamSchema = z.object({
  name: z.string().min(1),
  sport: z.string().min(1),
  season: z.string().optional(),
  description: z.string().optional(),
  coachName: z.string().min(1),
  avatarColor: z.string().default("#FF6B35"),
  imageUrl: z.string().optional(),
  location: z.string().optional(),
});
type TeamForm = z.infer<typeof teamSchema>;

type TeamRow = {
  id: number;
  name: string;
  sport: string;
  season?: string | null;
  description?: string | null;
  coachName: string;
  avatarColor: string;
  imageUrl?: string | null;
  location?: string | null;
  playerCount: number;
};

function TeamFormFields({ form, sq }: { form: any; sq: any }) {
  return (
    <>
      <FormField control={form.control} name="name" render={({ field }) => (
        <FormItem>
          <FormLabel className="stat-label text-white/50">{sq.squadName}</FormLabel>
          <FormControl>
            <Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-team-name" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="sport" render={({ field }) => (
        <FormItem>
          <FormLabel className="stat-label text-white/50">{sq.sport}</FormLabel>
          <Select onValueChange={field.onChange} value={field.value}>
            <FormControl>
              <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl" data-testid="select-sport">
                <SelectValue placeholder={sq.selectSport} />
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
          <FormLabel className="stat-label text-white/50">{sq.coachName}</FormLabel>
          <FormControl>
            <Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-coach-name" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="season" render={({ field }) => (
        <FormItem>
          <FormLabel className="stat-label text-white/50">{sq.seasonOptional}</FormLabel>
          <FormControl>
            <Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-season" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="location" render={({ field }) => (
        <FormItem>
          <FormLabel className="stat-label text-white/50">{sq.locationOptional}</FormLabel>
          <FormControl>
            <Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="imageUrl" render={({ field }) => (
        <FormItem>
          <FormLabel className="stat-label text-white/50">{sq.teamImageOptional}</FormLabel>
          <FormControl>
            <Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" placeholder="https://..." {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="avatarColor" render={({ field }) => (
        <FormItem>
          <FormLabel className="stat-label text-white/50">{sq.squadColor}</FormLabel>
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
          <FormLabel className="stat-label text-white/50">{sq.descriptionOptional}</FormLabel>
          <FormControl>
            <Textarea className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-description" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );
}

export default function TeamsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<TeamRow | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const sq = t.squads;

  const { data: teams = [], isLoading, error } = useListTeams();
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const deleteTeam = useDeleteTeam();

  const createForm = useForm<TeamForm>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: "", sport: "", season: "", description: "", coachName: "", avatarColor: "#FF6B35", imageUrl: "", location: "" },
  });

  const editForm = useForm<TeamForm>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: "", sport: "", season: "", description: "", coachName: "", avatarColor: "#FF6B35", imageUrl: "", location: "" },
  });

  function openEdit(e: React.MouseEvent, team: TeamRow) {
    e.stopPropagation();
    setEditTeam(team);
    editForm.reset({
      name: team.name,
      sport: team.sport,
      season: team.season ?? "",
      description: team.description ?? "",
      coachName: team.coachName,
      avatarColor: team.avatarColor,
      imageUrl: team.imageUrl ?? "",
      location: team.location ?? "",
    });
  }

  function onCreate(values: TeamForm) {
    createTeam.mutate(
      { data: { name: values.name, sport: values.sport, season: values.season || null, description: values.description || null, coachName: values.coachName, avatarColor: values.avatarColor, imageUrl: values.imageUrl || null, location: values.location || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setCreateOpen(false);
          createForm.reset();
          toast({ title: sq.squadCreated });
        },
        onError: () => toast({ title: sq.failedCreate, variant: "destructive" }),
      }
    );
  }

  function onEdit(values: TeamForm) {
    if (!editTeam) return;
    updateTeam.mutate(
      { teamId: editTeam.id, data: { name: values.name, sport: values.sport, season: values.season || null, description: values.description || null, coachName: values.coachName, avatarColor: values.avatarColor, imageUrl: values.imageUrl || null, location: values.location || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setEditTeam(null);
          toast({ title: sq.squadUpdated });
        },
        onError: () => toast({ title: sq.failedUpdate, variant: "destructive" }),
      }
    );
  }

  function handleDelete(e: React.MouseEvent, teamId: number) {
    e.stopPropagation();
    if (!confirm(sq.confirmDelete)) return;
    deleteTeam.mutate({ teamId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
        toast({ title: sq.squadDeleted });
      },
      onError: () => toast({ title: sq.failedDelete, variant: "destructive" }),
    });
  }

  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-[50vh] text-white/40">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p>{sq.failedLoad}</p>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">{sq.coachPanel.toUpperCase()}</p>
          <h1 className="font-display text-4xl text-white tracking-wide">{sq.yourSquads.toUpperCase()}</h1>
        </div>
        <Button
          className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl shadow-lg shadow-primary/20"
          data-testid="button-create-team"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-4 w-4 me-2" />
          {sq.newSquad}
        </Button>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md border-white/10 max-h-[90vh] overflow-y-auto" style={{ background: "#161b2e" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-white tracking-wide">{sq.createSquad.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4">
              <TeamFormFields form={createForm} sq={sq} />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-11" disabled={createTeam.isPending} data-testid="button-submit-team">
                {createTeam.isPending ? sq.creating : sq.createSquad}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTeam} onOpenChange={(v) => { if (!v) setEditTeam(null); }}>
        <DialogContent className="max-w-md border-white/10 max-h-[90vh] overflow-y-auto" style={{ background: "#161b2e" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-white tracking-wide">{sq.editSquad.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <TeamFormFields form={editForm} sq={sq} />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-11" disabled={updateTeam.isPending} data-testid="button-submit-edit-team">
                {updateTeam.isPending ? sq.saving : sq.saveChanges}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
        </div>
      ) : teams.length === 0 ? (
        <div className="rounded-2xl border border-white/6 p-12 text-center" style={{ background: "rgba(22,27,46,0.8)" }}>
          <Users className="h-12 w-12 mx-auto text-white/20 mb-4" />
          <h3 className="font-display text-2xl text-white tracking-wide mb-2">{sq.noSquadsYet.toUpperCase()}</h3>
          <p className="text-white/40 text-sm mb-5">{sq.createFirstDesc}</p>
          <Button onClick={() => setCreateOpen(true)} className="bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl" data-testid="button-create-first-team">
            <Plus className="h-4 w-4 me-2" />
            {sq.createSquad}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {(teams as TeamRow[]).map(team => (
            <div
              key={team.id}
              className="rounded-2xl border border-white/6 p-4 flex items-center gap-4 cursor-pointer hover:bg-white/4 transition-all group"
              style={{ background: "rgba(22,27,46,0.8)" }}
              onClick={() => setLocation(`/teams/${team.id}`)}
              data-testid={`card-team-${team.id}`}
            >
              <div
                className="jersey-tile text-xl shadow-lg shrink-0 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${team.avatarColor}, ${team.avatarColor}99)` }}
              >
                {team.imageUrl ? (
                  <img src={team.imageUrl} alt={team.name} className="w-full h-full object-cover" />
                ) : (
                  team.name.charAt(0).toUpperCase()
                )}
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
                  {team.coachName}{team.season ? ` · ${team.season}` : ""}{team.location ? ` · ${team.location}` : ""} · <span className="ltr-num">{team.playerCount}</span> {sq.athletes}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-white/50 hover:text-white hover:bg-white/10 h-8 w-8"
                  onClick={(e) => openEdit(e, team)}
                  data-testid={`button-edit-team-${team.id}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-400 hover:bg-red-400/10 h-8 w-8"
                  onClick={(e) => handleDelete(e, team.id)}
                  data-testid={`button-delete-team-${team.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-primary transition-colors flip-rtl" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
