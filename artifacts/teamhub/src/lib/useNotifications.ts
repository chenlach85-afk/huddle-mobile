import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/useAuth";

export interface AppNotification {
  id: number;
  userId: number;
  type: "task" | "event" | "message" | "general";
  title: string;
  body: string;
  read: boolean;
  relatedId?: number;
  relatedType?: string;
  createdAt: string;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useNotifications() {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery<AppNotification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token;

  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}/api/notifications/${id}/read`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to mark as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const token = session?.access_token;

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}/api/notifications/read-all`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
