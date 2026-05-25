import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as db from './db';

export * from './db';

// ─── Profile ───
export function useMyProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: db.getMyProfile, staleTime: 60_000 });
}

export function useUpdateProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof db.updateMyProfile>[0]) => db.updateMyProfile(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

// ─── Teams ───
export function useTeams() {
  return useQuery({ queryKey: ['teams'], queryFn: db.listMyTeams });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: ['team', id],
    queryFn: () => db.getTeam(id),
    enabled: !!id,
  });
}

export function useCreateTeamMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof db.createTeam>[0]) => db.createTeam(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['teams'] }),
  });
}

export function useMyTeamRole(teamId: string) {
  return useQuery({
    queryKey: ['team-role', teamId],
    queryFn: () => db.getMyTeamRole(teamId),
    enabled: !!teamId,
  });
}

// ─── Roster ───
export function useRosterQuery(teamId: string) {
  return useQuery({
    queryKey: ['roster', teamId],
    queryFn: () => db.listRoster(teamId),
    enabled: !!teamId,
  });
}

export function useAddRosterMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof db.addRosterMember>[1]) =>
      db.addRosterMember(teamId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster', teamId] }),
  });
}

export function useUpdateRosterMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: { id: string; payload: Parameters<typeof db.updateRosterMember>[1] }) =>
      db.updateRosterMember(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster', teamId] }),
  });
}

export function useRemoveRosterMember(teamId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => db.removeRosterMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster', teamId] }),
  });
}

// ─── Events ───
export function useEvents(teamId: string) {
  return useQuery({
    queryKey: ['events', teamId],
    queryFn: () => db.listEvents(teamId),
    enabled: !!teamId,
  });
}

export function useCreateEventMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof db.createEvent>[0]) => db.createEvent(payload),
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['events', data.teamId] }),
  });
}

// ─── Tasks ───
export function useTasksQuery(teamId: string) {
  return useQuery({
    queryKey: ['tasks', teamId],
    queryFn: () => db.listTasks(teamId),
    enabled: !!teamId,
  });
}

export function useCreateTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof db.createTask>[0]) => db.createTask(payload),
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['tasks', data.teamId] }),
  });
}

export function useUpdateTaskMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: { id: string; patch: Parameters<typeof db.updateTask>[1] }) =>
      db.updateTask(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

// ─── Messages (broadcasts) ───
export function useMessagesQuery(teamId: string) {
  return useQuery({
    queryKey: ['messages', teamId],
    queryFn: () => db.listMessages(teamId),
    enabled: !!teamId,
    refetchInterval: 10_000,
  });
}

export function useCreateMessageMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Parameters<typeof db.createMessage>[0]) => db.createMessage(payload),
    onSuccess: (data) => qc.invalidateQueries({ queryKey: ['messages', data.teamId] }),
  });
}

// ─── Notifications ───
export function useNotificationsQuery() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: db.listNotifications,
    refetchInterval: 30_000,
    retry: 0,
  });
}

export function useMarkAllReadMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: db.markAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useUnreadCountQuery(): number {
  const { data } = useNotificationsQuery();
  return (data ?? []).filter((n) => !n.isRead).length;
}

// ─── RSVP ───
export function useRsvpQuery(eventId: string) {
  return useQuery({
    queryKey: ['rsvp', eventId],
    queryFn: () => db.listRsvp(eventId),
    enabled: !!eventId,
  });
}

export function useUpsertRsvpMutation(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamMemberId,
      status,
    }: { teamMemberId: string; status: string }) =>
      db.upsertRsvp(eventId, teamMemberId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rsvp', eventId] }),
  });
}

// ─── Files ───
export function useTeamFilesQuery(teamId: string) {
  return useQuery({
    queryKey: ['files', teamId],
    queryFn: () => db.listTeamFiles(teamId),
    enabled: !!teamId,
  });
}
