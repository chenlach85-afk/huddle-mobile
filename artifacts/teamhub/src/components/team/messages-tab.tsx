import { useState } from "react";
import {
  useListMessages,
  useCreateMessage,
  useDeleteMessage,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, MessageSquare, Pin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const ROLE_COLORS: Record<string, string> = {
  coach: "bg-primary text-primary-foreground",
  player: "bg-secondary text-secondary-foreground",
  admin: "bg-muted text-muted-foreground",
};

export default function MessagesTab({ teamId }: { teamId: number }) {
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
      onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
    });
  }

  function handleDelete(messageId: number) {
    if (!confirm("Delete this message?")) return;
    deleteMessage.mutate({ messageId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(teamId) });
        toast({ title: "Message deleted" });
      },
      onError: () => toast({ title: "Failed to delete message", variant: "destructive" }),
    });
  }

  const pinned = messages.filter(m => m.pinned);
  const regular = messages.filter(m => !m.pinned);

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : messages.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-1">No messages yet</p>
            <p className="text-sm text-muted-foreground">Send the first message to your team below</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pinned.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Pin className="h-3 w-3" />
                Pinned
              </p>
              {pinned.map(msg => <MessageCard key={msg.id} msg={msg} onDelete={handleDelete} />)}
            </div>
          )}
          {regular.map(msg => <MessageCard key={msg.id} msg={msg} onDelete={handleDelete} />)}
        </div>
      )}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Your name"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              data-testid="input-sender-name"
            />
            <Select value={senderRole} onValueChange={(v: "coach" | "player" | "admin") => setSenderRole(v)}>
              <SelectTrigger data-testid="select-sender-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coach">Coach</SelectItem>
                <SelectItem value="player">Player</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Write a message to the team..."
            value={content}
            onChange={e => setContent(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend(); }}
            rows={3}
            data-testid="input-message-content"
          />
          <Button
            onClick={handleSend}
            disabled={!content.trim() || !senderName.trim() || createMessage.isPending}
            className="w-full"
            data-testid="button-send-message"
          >
            {createMessage.isPending ? "Sending..." : "Send Message"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function MessageCard({ msg, onDelete }: { msg: { id: number; senderName: string; senderRole: string; content: string; pinned: boolean; createdAt: string | Date }; onDelete: (id: number) => void }) {
  return (
    <Card className={`group ${msg.pinned ? "border-primary/30 bg-primary/5" : ""}`} data-testid={`card-message-${msg.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[msg.senderRole]}`}>
              {msg.senderRole}
            </span>
            <span className="font-medium text-sm">{msg.senderName}</span>
            {msg.pinned && <Pin className="h-3 w-3 text-primary" />}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              onClick={() => onDelete(msg.id)}
              data-testid={`button-delete-message-${msg.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <p className="mt-2 text-sm whitespace-pre-wrap" data-testid={`text-message-content-${msg.id}`}>{msg.content}</p>
      </CardContent>
    </Card>
  );
}
