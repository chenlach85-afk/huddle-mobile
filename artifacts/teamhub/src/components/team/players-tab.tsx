import { useState } from "react";
import {
  useListPlayers,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Users, Trash2, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active: { label: "Active", color: "#2ecc71" },
  inactive: { label: "Inactive", color: "rgba(255,255,255,0.3)" },
  injured: { label: "Injured", color: "#e74c3c" },
};

const playerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  number: z.string().optional(),
  position: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive", "injured"]).default("active"),
  notes: z.string().optional(),
});
type PlayerForm = z.infer<typeof playerSchema>;

export default function PlayersTab({ teamId, teamColor }: { teamId: number; teamColor: string }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: players = [], isLoading } = useListPlayers(teamId, {
    query: { enabled: !!teamId, queryKey: getListPlayersQueryKey(teamId) },
  });
  const createPlayer = useCreatePlayer();
  const updatePlayer = useUpdatePlayer();
  const deletePlayer = useDeletePlayer();

  const form = useForm<PlayerForm>({
    resolver: zodResolver(playerSchema),
    defaultValues: { name: "", number: "", position: "", email: "", phone: "", status: "active", notes: "" },
  });

  function openCreate() { form.reset(); setEditingId(null); setOpen(true); }
  function openEdit(p: typeof players[0]) {
    form.reset({ name: p.name, number: p.number?.toString() || "", position: p.position || "", email: p.email || "", phone: p.phone || "", status: p.status, notes: p.notes || "" });
    setEditingId(p.id);
    setOpen(true);
  }

  function onSubmit(values: PlayerForm) {
    const payload = {
      name: values.name,
      number: values.number ? parseInt(values.number) : null,
      position: values.position || null,
      email: values.email || null,
      phone: values.phone || null,
      status: values.status,
      notes: values.notes || null,
    };
    if (editingId) {
      updatePlayer.mutate({ playerId: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(teamId) }); setOpen(false); toast({ title: "Player updated" }); },
        onError: () => toast({ title: "Failed to update player", variant: "destructive" }),
      });
    } else {
      createPlayer.mutate({ teamId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(teamId) }); setOpen(false); toast({ title: "Player added to squad" }); },
        onError: () => toast({ title: "Failed to add player", variant: "destructive" }),
      });
    }
  }

  function handleDelete(playerId: number) {
    if (!confirm("Remove player from squad?")) return;
    deletePlayer.mutate({ playerId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(teamId) }); toast({ title: "Player removed" }); },
      onError: () => toast({ title: "Failed to remove player", variant: "destructive" }),
    });
  }

  const isPending = createPlayer.isPending || updatePlayer.isPending;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-label">{players.length} ATHLETES ON SQUAD</p>
        <Button size="sm" onClick={openCreate} className="font-semibold rounded-xl" style={{ background: teamColor, color: "white" }} data-testid="button-add-player">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Athlete
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}</div>
      ) : players.length === 0 ? (
        <div className="rounded-2xl border border-white/6 p-10 text-center" style={{ background: "rgba(22,27,46,0.8)" }}>
          <Users className="h-10 w-10 mx-auto text-white/15 mb-3" />
          <p className="font-display text-xl text-white/30 tracking-wide">EMPTY SQUAD</p>
          <p className="text-xs text-white/25 mt-1 mb-4">Add athletes to get started</p>
          <Button size="sm" onClick={openCreate} style={{ background: teamColor, color: "white" }} className="rounded-xl font-semibold">Add Athlete</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {players.map(player => {
            const statusCfg = STATUS_CONFIG[player.status];
            return (
              <div key={player.id} className="rounded-2xl border border-white/6 p-4 flex items-center gap-4 group hover:bg-white/3 transition-all" style={{ background: "rgba(22,27,46,0.8)" }} data-testid={`card-player-${player.id}`}>
                {/* Jersey tile */}
                <div
                  className="jersey-tile text-lg relative"
                  style={{ background: `linear-gradient(135deg, ${teamColor}, ${teamColor}88)` }}
                >
                  {player.number ?? player.name.charAt(0).toUpperCase()}
                  {/* Status dot */}
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-[#161b2e]" style={{ background: statusCfg.color }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm" data-testid={`text-player-name-${player.id}`}>{player.name}</span>
                    {player.position && <span className="text-xs text-white/40">{player.position}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: statusCfg.color }}>{statusCfg.label}</span>
                    {(player.email || player.phone) && (
                      <span className="text-[10px] text-white/25">{player.email || player.phone}</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/8" onClick={() => openEdit(player)} data-testid={`button-edit-player-${player.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400/60 hover:text-red-400 hover:bg-red-400/10" onClick={() => handleDelete(player.id)} data-testid={`button-delete-player-${player.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-white/10" style={{ background: "#161b2e" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-white tracking-wide">{editingId ? "EDIT ATHLETE" : "ADD ATHLETE"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">Full Name</FormLabel>
                  <FormControl><Input placeholder="Player name" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-player-name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="number" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">Jersey #</FormLabel>
                    <FormControl><Input type="number" placeholder="00" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl font-display text-xl" data-testid="input-jersey-number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">Position</FormLabel>
                    <FormControl><Input placeholder="e.g. Forward" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-position" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl" data-testid="select-player-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="border-white/10" style={{ background: "#1f2742" }}>
                      <SelectItem value="active" className="text-white">Active</SelectItem>
                      <SelectItem value="inactive" className="text-white">Inactive</SelectItem>
                      <SelectItem value="injured" className="text-white">Injured</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">Email (optional)</FormLabel>
                  <FormControl><Input type="email" placeholder="player@example.com" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-player-email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">Phone (optional)</FormLabel>
                  <FormControl><Input placeholder="(555) 000-0000" className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-player-phone" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">Notes (optional)</FormLabel>
                  <FormControl><Textarea placeholder="Any notes..." className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-player-notes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full font-semibold rounded-xl h-11" style={{ background: teamColor, color: "white" }} disabled={isPending} data-testid="button-submit-player">
                {isPending ? "Saving..." : editingId ? "Update Athlete" : "Add to Squad"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
