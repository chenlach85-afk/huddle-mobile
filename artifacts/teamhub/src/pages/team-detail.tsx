import { useParams, useLocation } from "wouter";
import {
  useGetTeam,
  useGetTeamActivity,
  getGetTeamQueryKey,
  getGetTeamActivityQueryKey,
  useUpdateTeam,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft, Users, Calendar, CheckSquare, MessageSquare,
  AlertCircle, Activity, Link2, Check, Zap, MapPin, Pencil,
  ImageIcon, FileText,
} from "lucide-react";
import PlayersTab from "@/components/team/players-tab";
import EventsTab from "@/components/team/events-tab";
import TasksTab from "@/components/team/tasks-tab";
import MessagesTab from "@/components/team/messages-tab";
import AlbumsTab from "@/components/team/albums-tab";
import DocsTab from "@/components/team/docs-tab";
import { formatDistanceToNow } from "date-fns";
import { he, es, enUS } from "date-fns/locale";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { Upload, X } from "lucide-react";

function LogoUploadField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const res = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await res.json() as { uploadURL: string; objectPath: string };
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error("Upload failed");
      const filename = objectPath.replace(/^\/objects\//, "");
      const serveUrl = `/api/storage/objects/${filename}`;
      onChange(serveUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {value ? (
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/15 bg-white/5 shrink-0">
            <img src={value} alt="logo" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="text-xs text-primary hover:text-primary/80 font-semibold text-start"
            >
              {uploading ? "Uploading…" : "Change logo"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70"
            >
              <X className="h-3 w-3" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 w-full p-3 rounded-xl border border-dashed border-white/15 bg-white/3 hover:bg-white/6 hover:border-white/25 text-white/50 hover:text-white/80 transition-all text-sm"
        >
          <Upload className="h-4 w-4 shrink-0" />
          {uploading ? "Uploading…" : "Upload team logo"}
        </button>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

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

const editSchema = z.object({
  name: z.string().min(1),
  sport: z.string().min(1),
  season: z.string().optional(),
  description: z.string().optional(),
  coachName: z.string().min(1),
  avatarColor: z.string().default("#FF6B35"),
  imageUrl: z.string().optional(),
  location: z.string().optional(),
});
type EditForm = z.infer<typeof editSchema>;

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
  const sq = t.squads;
  const [copied, setCopied] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const id = Number(teamId);
  const queryClient = useQueryClient();

  const { data: team, isLoading: teamLoading } = useGetTeam(id, {
    query: { enabled: !!id, queryKey: getGetTeamQueryKey(id) },
  });
  const { data: activity = [] } = useGetTeamActivity(id, {
    query: { enabled: !!id, queryKey: getGetTeamActivityQueryKey(id) },
  });

  const updateTeam = useUpdateTeam();

  const teamColor = (team as any)?.avatarColor ?? "#FF6B35";
  const dateLocale = DATE_LOCALES[language] ?? enUS;

  const editForm = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      sport: "",
      season: "",
      description: "",
      coachName: "",
      avatarColor: "#FF6B35",
      imageUrl: "",
      location: "",
    },
  });

  function openEditDialog() {
    if (!team) return;
    editForm.reset({
      name: team.name,
      sport: (team as any).sport ?? "",
      season: (team as any).season ?? "",
      description: (team as any).description ?? "",
      coachName: (team as any).coachName ?? "",
      avatarColor: teamColor,
      imageUrl: (team as any).imageUrl ?? "",
      location: (team as any).location ?? "",
    });
    setEditOpen(true);
  }

  function onEditSubmit(values: EditForm) {
    updateTeam.mutate(
      {
        teamId: id,
        data: {
          name: values.name,
          sport: values.sport,
          season: values.season || null,
          description: values.description || null,
          coachName: values.coachName,
          avatarColor: values.avatarColor,
          imageUrl: values.imageUrl || null,
          location: values.location || null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() });
          setEditOpen(false);
          toast({ title: sq.squadUpdated });
        },
        onError: () => toast({ title: sq.failedUpdate, variant: "destructive" }),
      }
    );
  }

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
    { value: "albums", label: td.tabAlbums, icon: ImageIcon },
    { value: "docs", label: td.tabDocs, icon: FileText },
  ];

  const teamImage = (team as any).imageUrl as string | null | undefined;
  const teamLocation = (team as any).location as string | null | undefined;

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-5">

      {/* Edit Team Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md border-border max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-card)" }}>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-white tracking-wide">{sq.editSquad.toUpperCase()}</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{sq.squadName}</FormLabel>
                  <FormControl><Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="sport" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{sq.sport}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl">
                        <SelectValue placeholder={sq.selectSport} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="border-border" style={{ background: "var(--surface-elevated)" }}>
                      {SPORTS.map(s => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="coachName" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{sq.coachName}</FormLabel>
                  <FormControl><Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="season" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{sq.seasonOptional}</FormLabel>
                  <FormControl><Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{sq.locationOptional}</FormLabel>
                  <FormControl><Input className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="imageUrl" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{sq.teamImageOptional}</FormLabel>
                  <FormControl>
                    <LogoUploadField value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="avatarColor" render={({ field }) => (
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
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel className="stat-label text-white/50">{sq.descriptionOptional}</FormLabel>
                  <FormControl><Textarea className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl h-11" disabled={updateTeam.isPending}>
                {updateTeam.isPending ? sq.saving : sq.saveChanges}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <div className="hero-card p-5" style={{
        background: `linear-gradient(135deg, ${teamColor}cc 0%, ${teamColor}55 100%)`,
        borderColor: `${teamColor}33`,
        border: `1px solid ${teamColor}33`,
      }}>
        {/* Top row: back + logo + name/meta */}
        <div className="flex items-center gap-4">
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
            className="jersey-tile text-2xl shadow-lg shrink-0 overflow-hidden"
            style={{ background: teamImage ? "transparent" : `linear-gradient(135deg, white 0%, rgba(255,255,255,0.7) 100%)`, color: teamColor }}
          >
            {teamImage ? (
              <img src={teamImage} alt={team.name} className="w-full h-full object-cover" />
            ) : (
              team.name.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl md:text-3xl text-white tracking-wide leading-none" data-testid="text-team-name">
              {team.name.toUpperCase()}
            </h1>
            <p className="text-white/60 text-sm font-medium mt-1 truncate">
              {(team as any).sport} · {td.coachLabel} {(team as any).coachName}{(team as any).season ? ` · ${(team as any).season}` : ""}
            </p>
            {teamLocation && (
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3 text-white/40" />
                <p className="text-xs text-white/40">{teamLocation}</p>
              </div>
            )}
          </div>

          {/* Desktop action buttons — hidden on mobile */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={openEditDialog}
              className="font-semibold rounded-xl text-white border border-white/20 hover:border-white/40"
              style={{ background: "rgba(255,255,255,0.12)" }}
              data-testid="button-edit-team"
            >
              <Pencil className="h-3.5 w-3.5 me-1.5" />
              {td.editTeam}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  onClick={copyMemberLink}
                  className="font-semibold rounded-xl text-white border border-white/20 hover:border-white/40"
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
        </div>

        {/* Mobile action buttons — shown below on small screens */}
        <div className="flex md:hidden items-center gap-2 mt-3 ps-12">
          <Button
            size="sm"
            onClick={openEditDialog}
            className="font-semibold rounded-xl text-white border border-white/20 hover:border-white/40"
            style={{ background: "rgba(255,255,255,0.12)" }}
            data-testid="button-edit-team-mobile"
          >
            <Pencil className="h-3.5 w-3.5 me-1.5" />
            {td.editTeam}
          </Button>
          <Button
            size="sm"
            onClick={copyMemberLink}
            className="font-semibold rounded-xl text-white border border-white/20 hover:border-white/40"
            style={{ background: "rgba(255,255,255,0.12)" }}
            data-testid="button-share-member-link-mobile"
          >
            {copied ? (
              <><Check className="h-4 w-4 me-1.5 text-green-400" />{td.copied}</>
            ) : (
              <><Link2 className="h-4 w-4 me-1.5" />{td.shareLink}</>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="players" className="space-y-4">
        <TabsList className="border border-border p-1 rounded-xl h-auto gap-0.5 flex-wrap" style={{ background: "var(--surface-card)" }}>
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-lg px-3 py-2 text-white/50 font-semibold text-sm data-[state=active]:text-white data-[state=active]:shadow-none transition-all"
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
            <TabsContent value="albums" className="mt-0"><AlbumsTab teamId={id} teamColor={teamColor} /></TabsContent>
            <TabsContent value="docs" className="mt-0"><DocsTab teamId={id} teamColor={teamColor} /></TabsContent>
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

            <div className="rounded-2xl border border-border overflow-hidden" style={{ background: "var(--surface-card)" }}>
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
