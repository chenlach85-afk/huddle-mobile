import { useState } from "react";
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useListPlayers,
  getListTasksQueryKey,
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
import { Plus, CheckSquare, Trash2, Pencil, Circle, CheckCircle2, Clock3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";

const PRIORITY_COLORS: Record<string, string> = {
  low: "#2ecc71",
  medium: "#f7b538",
  high: "#e74c3c",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "rgba(255,255,255,0.3)",
  in_progress: "#4a90e2",
  done: "#2ecc71",
};

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assignedToPlayerId: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(["pending", "in_progress", "done"]).default("pending"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});
type TaskForm = z.infer<typeof taskSchema>;

export default function TasksTab({ teamId, teamColor }: { teamId: number; teamColor: string }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "done">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const tk = t.tasks;

  const { data: tasks = [], isLoading } = useListTasks(teamId, {
    query: { enabled: !!teamId, queryKey: getListTasksQueryKey(teamId) },
  });
  const { data: players = [] } = useListPlayers(teamId, { query: { enabled: !!teamId, queryKey: [] } });
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const form = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", assignedToPlayerId: "", dueDate: "", status: "pending", priority: "medium" },
  });

  function openCreate() { form.reset(); setEditingId(null); setOpen(true); }
  function openEdit(task: typeof tasks[0]) {
    form.reset({ title: task.title, description: task.description || "", assignedToPlayerId: task.assignedToPlayerId?.toString() || "", dueDate: task.dueDate || "", status: task.status, priority: task.priority });
    setEditingId(task.id);
    setOpen(true);
  }

  function onSubmit(values: TaskForm) {
    const payload = {
      title: values.title, description: values.description || null,
      assignedToPlayerId: values.assignedToPlayerId ? parseInt(values.assignedToPlayerId) : null,
      dueDate: values.dueDate || null, status: values.status, priority: values.priority,
    };
    if (editingId) {
      updateTask.mutate({ taskId: editingId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(teamId) }); setOpen(false); toast({ title: tk.taskUpdated }); },
        onError: () => toast({ title: tk.failedUpdate, variant: "destructive" }),
      });
    } else {
      createTask.mutate({ teamId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(teamId) }); setOpen(false); toast({ title: tk.taskCreated }); },
        onError: () => toast({ title: tk.failedCreate, variant: "destructive" }),
      });
    }
  }

  function cycleStatus(taskId: number, current: string) {
    const next: Record<string, "pending" | "in_progress" | "done"> = { pending: "in_progress", in_progress: "done", done: "pending" };
    updateTask.mutate({ taskId, data: { status: next[current] } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(teamId) }),
      onError: () => toast({ title: tk.failedUpdate, variant: "destructive" }),
    });
  }

  function handleDelete(taskId: number) {
    if (!confirm(tk.confirmDelete)) return;
    deleteTask.mutate({ taskId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(teamId) }); toast({ title: tk.taskDeleted }); },
      onError: () => toast({ title: tk.failedDelete, variant: "destructive" }),
    });
  }

  const filterLabel = (s: string) => {
    if (s === "all") return tk.all;
    if (s === "pending") return tk.pending;
    if (s === "in_progress") return tk.inProgress;
    return tk.done;
  };

  const priorityShort = (p: string) => {
    if (p === "low") return tk.priorityLowShort;
    if (p === "medium") return tk.priorityMedShort;
    return tk.priorityHighShort;
  };

  const statusIcon = (s: string) => {
    if (s === "in_progress") return <Clock3 className="h-4 w-4" />;
    if (s === "done") return <CheckCircle2 className="h-4 w-4" />;
    return <Circle className="h-4 w-4" />;
  };

  const filtered = statusFilter === "all" ? tasks : tasks.filter(t => t.status === statusFilter);
  const pending = tasks.filter(t => t.status === "pending").length;
  const inProgress = tasks.filter(t => t.status === "in_progress").length;
  const done = tasks.filter(t => t.status === "done").length;
  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/6 p-4" style={{ background: "rgba(22,27,46,0.8)" }}>
        <div className="flex items-center gap-5">
          <div className="text-center">
            <div className="font-display text-3xl leading-none text-[#e74c3c] ltr-num">{pending}</div>
            <div className="stat-label mt-1">{tk.pending.toUpperCase()}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="font-display text-3xl leading-none text-[#4a90e2] ltr-num">{inProgress}</div>
            <div className="stat-label mt-1">{tk.inProgress.toUpperCase()}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="font-display text-3xl leading-none text-[#2ecc71] ltr-num">{done}</div>
            <div className="stat-label mt-1">{tk.done.toUpperCase()}</div>
          </div>
          <div className="ms-auto">
            <Button size="sm" onClick={openCreate} className="font-semibold rounded-xl" style={{ background: teamColor, color: "white" }} data-testid="button-add-task">
              <Plus className="h-3.5 w-3.5 me-1.5" />
              {tk.addTask}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["all", "pending", "in_progress", "done"] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
            style={{
              background: statusFilter === s ? `${teamColor}25` : "rgba(255,255,255,0.04)",
              color: statusFilter === s ? teamColor : "rgba(255,255,255,0.35)",
              border: statusFilter === s ? `1px solid ${teamColor}50` : "1px solid rgba(255,255,255,0.06)",
            }}
            data-testid={`filter-${s}`}
          >
            {filterLabel(s)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/6 p-10 text-center" style={{ background: "rgba(22,27,46,0.8)" }}>
          <CheckSquare className="h-10 w-10 mx-auto text-white/15 mb-3" />
          <p className="font-display text-xl text-white/30 tracking-wide">{tk.noTasks.toUpperCase()}</p>
          {statusFilter === "all" && <Button size="sm" onClick={openCreate} style={{ background: teamColor, color: "white" }} className="rounded-xl font-semibold mt-4">{tk.addTask}</Button>}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const statusColor = STATUS_COLORS[task.status];
            const priorityColor = PRIORITY_COLORS[task.priority];
            return (
              <div
                key={task.id}
                className={`rounded-2xl border border-white/6 p-4 flex items-start gap-3 group hover:bg-white/3 transition-all ${task.status === "done" ? "opacity-50" : ""}`}
                style={{ background: "rgba(22,27,46,0.8)", borderLeft: `3px solid ${statusColor}` }}
                data-testid={`card-task-${task.id}`}
              >
                <button
                  onClick={() => cycleStatus(task.id, task.status)}
                  className="mt-0.5 hover:scale-110 transition-transform shrink-0"
                  style={{ color: statusColor }}
                  data-testid={`button-cycle-status-${task.id}`}
                >
                  {statusIcon(task.status)}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-semibold text-sm text-white ${task.status === "done" ? "line-through" : ""}`} data-testid={`text-task-title-${task.id}`}>
                      {task.title}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${priorityColor}20`, color: priorityColor }}>
                      {priorityShort(task.priority)}
                    </span>
                  </div>
                  {task.assignedToPlayerName && (
                    <p className="text-xs text-white/35 mt-0.5">{tk.assignedTo} {task.assignedToPlayerName}</p>
                  )}
                  {task.dueDate && <p className="text-xs text-white/30">{tk.due} <span className="ltr-num">{task.dueDate}</span></p>}
                  {task.description && <p className="text-xs text-white/30 mt-0.5">{task.description}</p>}
                </div>

                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-white/40 hover:text-white hover:bg-white/8" onClick={() => openEdit(task)} data-testid={`button-edit-task-${task.id}`}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400/40 hover:text-red-400 hover:bg-red-400/10" onClick={() => handleDelete(task.id)} data-testid={`button-delete-task-${task.id}`}>
                    <Trash2 className="h-3 w-3" />
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
            <DialogTitle className="font-display text-2xl text-white tracking-wide">
              {editingId ? tk.editTask.toUpperCase() : tk.addTask.toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{tk.title}</FormLabel>
                  <FormControl><Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-task-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">{tk.priority}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl" data-testid="select-priority"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent className="border-white/10" style={{ background: "#1f2742" }}>
                        <SelectItem value="low" className="text-white">{tk.priorityLow}</SelectItem>
                        <SelectItem value="medium" className="text-white">{tk.priorityMedium}</SelectItem>
                        <SelectItem value="high" className="text-white">{tk.priorityHigh}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">{tk.statusLabel}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl" data-testid="select-status"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent className="border-white/10" style={{ background: "#1f2742" }}>
                        <SelectItem value="pending" className="text-white">{tk.pending}</SelectItem>
                        <SelectItem value="in_progress" className="text-white">{tk.inProgress}</SelectItem>
                        <SelectItem value="done" className="text-white">{tk.done}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              {players.length > 0 && (
                <FormField control={form.control} name="assignedToPlayerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="stat-label text-white/50">{tk.assignTo}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl" data-testid="select-assigned-player"><SelectValue placeholder={tk.unassigned} /></SelectTrigger></FormControl>
                      <SelectContent className="border-white/10" style={{ background: "#1f2742" }}>
                        <SelectItem value="" className="text-white">{tk.unassigned}</SelectItem>
                        {players.map(p => <SelectItem key={p.id} value={p.id.toString()} className="text-white">{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{tk.dueDate}</FormLabel>
                  <FormControl><Input type="date" className="bg-white/6 border-white/10 text-white rounded-xl ltr-num" data-testid="input-due-date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{tk.description}</FormLabel>
                  <FormControl><Textarea className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" data-testid="input-task-description" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full font-semibold rounded-xl h-11" style={{ background: teamColor, color: "white" }} disabled={isPending} data-testid="button-submit-task">
                {isPending ? t.common.saving : editingId ? tk.updateTask : tk.createTask}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
