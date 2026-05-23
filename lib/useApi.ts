import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const body = await res.json() as { error?: string; message?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export interface RosterMember {
  id: number;
  teamId: number;
  userId: string | null;
  role: string;
  status: string;
  placeholderFullName: string | null;
  placeholderEmail: string | null;
  placeholderPhone: string | null;
  jerseyNumber: string | null;
  position: string | null;
  memberNotes: string | null;
  coachTitle: string | null;
  invitationId: number | null;
  createdAt: string;
}

export interface AppUser {
  id: number;
  clerkId: string | null;
  email: string;
  name: string;
  role: string;
  language: string;
  accountStatus: string;
}

export interface AppNotification {
  id: number;
  userId: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  relatedId: number | null;
  relatedType: string | null;
  createdAt: string;
}

export function useRoster(teamId: number) {
  return useQuery({
    queryKey: ["roster", teamId],
    queryFn: () => apiFetch<RosterMember[]>(`/api/teams/${teamId}/roster`),
    enabled: teamId > 0,
  });
}

export function useCreateRosterMember(teamId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      placeholderFullName: string;
      jerseyNumber?: string;
      position?: string;
      placeholderEmail?: string;
      placeholderPhone?: string;
    }) => apiFetch<RosterMember>(`/api/teams/${teamId}/roster`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roster", teamId] }),
  });
}

export function useAppUser() {
  return useQuery({
    queryKey: ["auth-me"],
    queryFn: () => apiFetch<AppUser>("/api/auth/me"),
    retry: 1,
  });
}

export function useUpdateAppUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Pick<AppUser, "name" | "language">>) =>
      apiFetch<AppUser>("/api/auth/me", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auth-me"] }),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<AppNotification[]>("/api/notifications"),
    refetchInterval: 30_000,
    retry: 0,
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useUnreadCount() {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.read).length;
}
