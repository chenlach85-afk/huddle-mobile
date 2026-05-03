import { useState } from "react";
import {
  useListMessages,
  useCreateMessage,
  useDeleteMessage,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, MessageSquare, Pin, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const ROLE_CONFIG: Record<string, { color: string; label: string }> = {
  coach: { color: "#FF6B35", label: "COACH" },
  player: { color: "#4a90e2", label: "PLAYER" },
  admin: { color: "#9b59b6", label: "ADMIN" },
};

export default function MessagesTab({ teamId, teamColor }: { teamId: number; teamColor: string }) {
  const [senderName, setSenderName] = useState("Coach");
  const [senderRole, setSenderRole] = useState<"coach" | "player" | "admin">("coach");
  const [content, setContent] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useListMessages(teamId, {
    query: { enabled: !!teamId, queryKey: getListMessagesQueryKey(teamId) },
  });
  const createMessage = useCreateMessage();
  const deleteMessage = useDeleteMessage();

  function handleSend() {
    if (!content.trim() || !senderName.trim()) return;
    createMessage.mutate({ teamId, data: { senderName: senderName.trim(), senderRole, content: content.trim(), pinned: false } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(teamId) });
        setContent("");
        toast({ title: "Message sent" });
      },
      onError: () => toast({ title: "Failed to send", variant: "destructive" }),
    });
  }

  function handleDelete(messageId: number) {
    if (!confirm("Delete this message?")) return;
    deleteMessage.mutate({ messageId }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(teamId) }); toast({ title: "Message deleted" }); },
      onError: () => toast({ title: "Failed to delete message", variant: "destructive" }),
    });
  }

  const pinned = messages.filter(m => m.pinned);
  const regular = messages.filter(m => !m.pinned);

  return (
    <div className="space-y-3">
      {/* Composer */}
      <div className="rounded-2xl border p-4 space-y-3" style={{ background: `${teamColor}0a`, borderColor: `${teamColor}25` }}>
        <div className="grid grid-cols-2 gap-2">
          <Input
            placeholder="Your name"
            value={senderName}
            onChange={e => setSenderName(e.target.value)}
            className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl text-sm h-9"
            data-testid="input-sender-name"
          />
          <Select value={senderRole} onValueChange={(v: "coach" | "player" | "admin") => setSenderRole(v)}>
            <SelectTrigger className="bg-white/6 border-white/10 text-white rounded-xl h-9 text-sm" data-testid="select-sender-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10" style={{ background: "#1f2742" }}>
              <SelectItem value="coach" className="text-white">Coach</SelectItem>
              <SelectItem value="player" className="text-white">Player</SelectItem>
              <SelectItem value="admin" className="text-white">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          placeholder="Send a message to the team..."
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
          rows={2}
          className="bg-white/6 border-white/10 text-white placeholder:text-white/30 rounded-xl text-sm resize-none"
          data-testid="input-message-content"
        />
        <Button
          onClick={handleSend}
          disabled={!content.trim() || !senderName.trim() || createMessage.isPending}
          className="w-full font-semibold rounded-xl h-10"
          style={{ background: teamColor, color: "white" }}
          data-testid="button-send-message"
        >
          <Send className="h-4 w-4 mr-2" />
          {createMessage.isPending ? "Sending..." : "Send Message"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}</div>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border border-white/6 p-10 text-center" style={{ background: "rgba(22,27,46,0.8)" }}>
          <MessageSquare className="h-10 w-10 mx-auto text-white/15 mb-3" />
          <p className="font-display text-xl text-white/30 tracking-wide">HUDDLE IS QUIET</p>
          <p className="text-xs text-white/25 mt-1">Send the first message above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Pinned */}
          {pinned.length > 0 && (
            <>
              <p className="section-label flex items-center gap-1.5 px-1">
                <Pin className="h-2.5 w-2.5" />
                Pinned
              </p>
              {pinned.map(msg => <MessageBubble key={msg.id} msg={msg} onDelete={handleDelete} teamColor={teamColor} />)}
              {regular.length > 0 && <p className="section-label px-1 pt-1">All Messages</p>}
            </>
          )}
          {[...regular].reverse().map(msg => (
            <MessageBubble key={msg.id} msg={msg} onDelete={handleDelete} teamColor={teamColor} />
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  msg,
  onDelete,
  teamColor,
}: {
  msg: { id: number; senderName: string; senderRole: string; content: string; pinned: boolean; createdAt: string | Date };
  onDelete: (id: number) => void;
  teamColor: string;
}) {
  const roleCfg = ROLE_CONFIG[msg.senderRole] ?? { color: "#fff", label: msg.senderRole.toUpperCase() };

  return (
    <div
      className="rounded-2xl border border-white/6 p-4 group hover:bg-white/2 transition-all"
      style={{
        background: msg.pinned ? `${teamColor}0d` : "rgba(22,27,46,0.8)",
        borderColor: msg.pinned ? `${teamColor}25` : "rgba(255,255,255,0.06)",
        borderLeft: `3px solid ${roleCfg.color}50`,
      }}
      data-testid={`card-message-${msg.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: `${roleCfg.color}20`, color: roleCfg.color }}
          >
            {roleCfg.label}
          </span>
          <span className="font-semibold text-sm text-white">{msg.senderName}</span>
          {msg.pinned && <Pin className="h-3 w-3" style={{ color: teamColor }} />}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-white/25">
            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-400/50 hover:text-red-400 hover:bg-red-400/10"
            onClick={() => onDelete(msg.id)}
            data-testid={`button-delete-message-${msg.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-white/75 whitespace-pre-wrap leading-relaxed" data-testid={`text-message-content-${msg.id}`}>{msg.content}</p>
    </div>
  );
}
