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
import { Card, CardContent } from "@/components/ui/card";
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

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-green-600",
  medium: "text-yellow-600",
  high: "text-red-600",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock3 className="h-4 w-4 text-blue-500" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  assignedToPlayerId: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(["pending", "in_progress", "done"]).default("pending"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
});
type TaskForm = z.infer<typeof taskSchema>;

export default function TasksTab({ teamId }: { teamId: number }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "done">("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
  function openEdit(t: typeof tasks[0]) {
    form.reset({ title: t.title, description: t.description || "", assignedToPlayerId: t.assignedToPlayerId?.toString() || "", dueDate: t.dueDate || "", status: t.status, priority: t.priority });
    setEditingId(t.id);
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
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(teamId) }); setOpen(false); toast({ title: "Task updated" }); },
        onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
      });
    } else {
      createTask.mutate({ teamId, data: payload }, {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(teamId) }); setOpen(false); toast({ title: "Task created" }); },
        onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
      });
    }
  }

  function cycleStatus(taskId: number, current: string) {
    const next: Record<string, "pending" | "in_progress" | "done"> = { pending: "in_progress", in_progress: "done", done: "pending" };
    updateTask.mutate({ taskId, data: { status: next[current] } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(teamId) }),
      onError: () => toast({ title: "Failed to update task", variant: "destructive" }),
    });
  }

  function handleDelete(taskId: number) {
    if (!confirm("Delete this task?")) return;
    deleteTask.mutate({ taskId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(teamId) }); toast({ title: "Task deleted" }); },
      onError: () => toast({ title: "Failed to delete task", variant: "destructive" }),
    });
  }

  const filtered = statusFilter === "all" ? tasks : tasks.filter(t => t.status === statusFilter);
  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {(["all", "pending", "in_progress", "done"] as const).map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "ghost"} onClick={() => setStatusFilter(s)} className="text-xs h-7" data-testid={`filter-${s}`}>
              {s === "all" ? "All" : s === "in_progress" ? "In Progress" : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
        <Button size="sm" onClick={openCreate} data-testid="button-add-task">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Task
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No tasks{statusFilter !== "all" ? ` with status "${statusFilter}"` : ""}</p>
            {statusFilter === "all" && <Button size="sm" onClick={openCreate} className="mt-4">Add Task</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <Card key={task.id} className={`group ${task.status === "done" ? "opacity-60" : ""}`} data-testid={`card-task-${task.id}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <button
                  onClick={() => cycleStatus(task.id, task.status)}
                  className="mt-0.5 hover:scale-110 transition-transform"
                  title="Click to change status"
                  data-testid={`button-cycle-status-${task.id}`}
                >
                  {STATUS_ICONS[task.status]}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`} data-testid={`text-task-title-${task.id}`}>
                      {task.title}
                    </span>
                    <span className={`text-xs font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                  </div>
                  {task.assignedToPlayerName && (
                    <p className="text-xs text-muted-foreground mt-0.5">Assigned to {task.assignedToPlayerName}</p>
                  )}
                  {task.dueDate && (
                    <p className="text-xs text-muted-foreground">Due {task.dueDate}</p>
                  )}
                  {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(task)} data-testid={`button-edit-task-${task.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(task.id)} data-testid={`button-delete-task-${task.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
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
            <DialogTitle>{editingId ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="Task title" data-testid="input-task-title" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              {players.length > 0 && (
                <FormField control={form.control} name="assignedToPlayerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to (optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger data-testid="select-assigned-player"><SelectValue placeholder="Unassigned" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {players.map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date (optional)</FormLabel>
                  <FormControl><Input type="date" data-testid="input-due-date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl><Textarea placeholder="Task details..." data-testid="input-task-description" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={isPending} data-testid="button-submit-task">
                {isPending ? "Saving..." : editingId ? "Update Task" : "Create Task"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
