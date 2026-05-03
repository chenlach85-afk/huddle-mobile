import { useState } from "react";
import {
  useListPlayers,
  useCreatePlayer,
  useUpdatePlayer,
  useDeletePlayer,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
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

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  injured: "bg-red-100 text-red-700 border-red-200",
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

export default function PlayersTab({ teamId }: { teamId: number }) {
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
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(teamId) });
          setOpen(false);
          toast({ title: "Player updated" });
        },
        onError: () => toast({ title: "Failed to update player", variant: "destructive" }),
      });
    } else {
      createPlayer.mutate({ teamId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(teamId) });
          setOpen(false);
          toast({ title: "Player added" });
        },
        onError: () => toast({ title: "Failed to add player", variant: "destructive" }),
      });
    }
  }

  function handleDelete(playerId: number) {
    if (!confirm("Remove this player?")) return;
    deletePlayer.mutate({ playerId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey(teamId) });
        toast({ title: "Player removed" });
      },
      onError: () => toast({ title: "Failed to remove player", variant: "destructive" }),
    });
  }

  const isPending = createPlayer.isPending || updatePlayer.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{players.length} player{players.length !== 1 ? "s" : ""} on roster</p>
        <Button size="sm" onClick={openCreate} data-testid="button-add-player">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Player
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : players.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No players yet</p>
            <p className="text-sm text-muted-foreground mb-4">Add your first player to the roster</p>
            <Button size="sm" onClick={openCreate}>Add Player</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {players.map(player => (
            <Card key={player.id} className="group" data-testid={`card-player-${player.id}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {player.number ?? player.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" data-testid={`text-player-name-${player.id}`}>{player.name}</span>
                    {player.position && <span className="text-xs text-muted-foreground">{player.position}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[player.status]}`}>
                      {player.status}
                    </span>
                  </div>
                  {(player.email || player.phone) && (
                    <p className="text-xs text-muted-foreground mt-0.5">{player.email}{player.email && player.phone ? " • " : ""}{player.phone}</p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(player)} data-testid={`button-edit-player-${player.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(player.id)} data-testid={`button-delete-player-${player.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Player" : "Add Player"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="Player name" data-testid="input-player-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="number" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jersey #</FormLabel>
                    <FormControl><Input type="number" placeholder="00" data-testid="input-jersey-number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="position" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl><Input placeholder="e.g. Forward" data-testid="input-position" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-player-status">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="injured">Injured</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl><Input type="email" placeholder="player@example.com" data-testid="input-player-email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (optional)</FormLabel>
                  <FormControl><Input placeholder="(555) 000-0000" data-testid="input-player-phone" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl><Textarea placeholder="Any notes..." data-testid="input-player-notes" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-player">
                {isPending ? "Saving..." : editingId ? "Update Player" : "Add Player"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
