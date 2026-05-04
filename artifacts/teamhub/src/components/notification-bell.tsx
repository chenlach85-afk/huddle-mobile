import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotifications, useMarkNotificationRead, useMarkAllRead } from "@/lib/useNotifications";
import { useI18n } from "@/lib/i18n";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const TYPE_COLORS = {
  task: "bg-blue-500",
  event: "bg-green-500",
  message: "bg-purple-500",
  general: "bg-orange-500",
};

export function NotificationBell() {
  const { t } = useI18n();
  const { data: notifications = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-foreground/60 hover:text-foreground hover:bg-accent"
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full text-white text-[9px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 border-border bg-card"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-foreground text-sm">{t.notifications.title}</h3>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              {t.notifications.markAllRead}
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground/60 text-sm">
              {t.notifications.noNotifications}
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border hover:bg-accent transition-colors",
                  !n.read && "bg-primary/5",
                )}
                onClick={() => markRead.mutate(n.id)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", TYPE_COLORS[n.type])} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-semibold truncate", n.read ? "text-muted-foreground" : "text-foreground")}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground/50 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
