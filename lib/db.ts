import { supabase } from './supabase';

// ─── Key conversion ───
function camelize(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
function camelizeRecord<T>(obj: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[camelize(k)] = v;
  return out as T;
}
function camelizeArray<T>(arr: Record<string, unknown>[]): T[] {
  return arr.map((r) => camelizeRecord<T>(r));
}

// ─── Types (match actual Supabase schema) ───
export interface DbUser {
  id: string;           // Supabase auth UUID — IS the profile primary key
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  preferredLanguage: string;
  isPlatformAdmin: boolean;
  lastTeamId?: string | null;
  createdAt: string;
}

export interface DbTeam {
  id: string;           // UUID
  name: string;
  sport: string;
  season?: string | null;
  primaryColor: string;
  logoUrl?: string | null;
  createdAt: string;
}

export interface DbTeamMember {
  id: string;           // UUID
  teamId: string;
  userId?: string | null;
  role: string;
  jerseyNumber?: string | null;  // integer in DB, string for UI
  position?: string | null;
  status: string;
  placeholderName?: string | null;
  placeholderEmail?: string | null;
  canManageTeamSettings: boolean;
  createdAt: string;
}

export interface DbEvent {
  id: string;           // UUID
  teamId: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt?: string | null;
  locationName?: string | null;
  opponent?: string | null;
  isHome?: boolean | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface DbTask {
  id: string;           // UUID
  teamId: string;
  title: string;
  description?: string | null;
  assignedToMemberId?: string | null;
  dueDate?: string | null;
  status: string;
  priority: string;
  createdAt: string;
}

export interface DbMessage {
  id: string;           // UUID
  teamId: string;
  title?: string | null;
  body: string;
  type: string;
  isPinned: boolean;
  createdBy?: string | null;
  createdAt: string;
}

export interface DbNotification {
  id: string;           // UUID
  userId: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  data?: Record<string, unknown> | null;
  createdAt: string;
}

export interface DbRsvp {
  id: string;           // UUID
  eventId: string;
  teamMemberId: string;
  status: string;
  updatedAt: string;
}

export interface DbFile {
  id: string;           // UUID
  uploaderId?: string | null;
  teamId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
}

// ─── Auth helper ───
async function getAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ─── User sync (called on sign-in) ───
export async function syncUser(
  uid: string,
  email: string,
  fullName: string,
): Promise<void> {
  await supabase
    .from('profiles')
    .upsert({ id: uid, email, full_name: fullName }, { onConflict: 'id' });
}

// ─── Profile ───
export async function getMyProfile(): Promise<DbUser | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  return data ? camelizeRecord<DbUser>(data) : null;
}

export async function updateMyProfile(
  patch: Partial<{ fullName: string; preferredLanguage: string; avatarUrl: string }>,
): Promise<DbUser | null> {
  const user = await getAuthUser();
  if (!user) throw new Error('Not authenticated');
  const snake: Record<string, unknown> = {};
  if (patch.fullName !== undefined) snake.full_name = patch.fullName;
  if (patch.preferredLanguage !== undefined) snake.preferred_language = patch.preferredLanguage;
  if (patch.avatarUrl !== undefined) snake.avatar_url = patch.avatarUrl;
  const { data, error } = await supabase
    .from('profiles').update(snake).eq('id', user.id).select().single();
  if (error) throw error;
  return data ? camelizeRecord<DbUser>(data) : null;
}

// ─── Teams ───
export async function listMyTeams(): Promise<DbTeam[]> {
  const user = await getAuthUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('team_members')
    .select('teams(*)')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? [])
    .map((r: any) => r.teams)
    .filter(Boolean)
    .map((t: any) => camelizeRecord<DbTeam>(t));
}

export async function getTeam(id: string): Promise<DbTeam | null> {
  const { data } = await supabase.from('teams').select('*').eq('id', id).single();
  return data ? camelizeRecord<DbTeam>(data) : null;
}

export async function createTeam(payload: {
  name: string;
  sport: string;
  season?: string;
  primaryColor?: string;
  logoUrl?: string;
}): Promise<DbTeam> {
  const user = await getAuthUser();
  if (!user) throw new Error('Not authenticated');
  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      name: payload.name,
      sport: payload.sport,
      season: payload.season ?? null,
      primary_color: payload.primaryColor ?? '#18C6B4',
      logo_url: payload.logoUrl ?? null,
    })
    .select()
    .single();
  if (error || !team) throw error ?? new Error('Create team failed');
  await supabase.from('team_members').insert({
    team_id: team.id,
    user_id: user.id,
    role: 'coach',
    status: 'active',
  });
  return camelizeRecord<DbTeam>(team);
}

export async function getMyTeamRole(teamId: string): Promise<string | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const { data } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', teamId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();
  return data?.role ?? null;
}

// ─── Roster ───
function mapMember(raw: Record<string, unknown>): DbTeamMember {
  const m = camelizeRecord<any>(raw);
  return {
    ...m,
    jerseyNumber:
      m.jerseyNumber !== null && m.jerseyNumber !== undefined
        ? String(m.jerseyNumber)
        : null,
  };
}

export async function listRoster(teamId: string): Promise<DbTeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapMember);
}

export async function addRosterMember(
  teamId: string,
  payload: {
    placeholderName: string;
    jerseyNumber?: string;
    position?: string;
    placeholderEmail?: string;
  },
): Promise<DbTeamMember> {
  const jn = payload.jerseyNumber ? parseInt(payload.jerseyNumber, 10) : null;
  const { data, error } = await supabase
    .from('team_members')
    .insert({
      team_id: teamId,
      placeholder_name: payload.placeholderName,
      jersey_number: jn !== null && !isNaN(jn) ? jn : null,
      position: payload.position ?? null,
      placeholder_email: payload.placeholderEmail ?? null,
      role: 'player',
      status: 'active',
    })
    .select()
    .single();
  if (error) throw error;
  return mapMember(data);
}

export async function updateRosterMember(
  id: string,
  payload: {
    placeholderName?: string;
    jerseyNumber?: string;
    position?: string;
    placeholderEmail?: string;
  },
): Promise<DbTeamMember> {
  const snake: Record<string, unknown> = {};
  if (payload.placeholderName !== undefined) snake.placeholder_name = payload.placeholderName;
  if (payload.jerseyNumber !== undefined) {
    const jn = parseInt(payload.jerseyNumber, 10);
    snake.jersey_number = isNaN(jn) ? null : jn;
  }
  if (payload.position !== undefined) snake.position = payload.position;
  if (payload.placeholderEmail !== undefined) snake.placeholder_email = payload.placeholderEmail;
  const { data, error } = await supabase
    .from('team_members').update(snake).eq('id', id).select().single();
  if (error) throw error;
  return mapMember(data);
}

export async function removeRosterMember(id: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', id);
  if (error) throw error;
}

// ─── Events ───
export async function listEvents(teamId: string): Promise<DbEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('team_id', teamId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return camelizeArray<DbEvent>(data ?? []);
}

export async function createEvent(payload: {
  teamId: string;
  title: string;
  type: string;
  startsAt: string;
  endsAt?: string;
  locationName?: string;
  notes?: string;
}): Promise<DbEvent> {
  const user = await getAuthUser();
  const { data, error } = await supabase
    .from('events')
    .insert({
      team_id: payload.teamId,
      title: payload.title,
      type: payload.type,
      starts_at: payload.startsAt,
      ends_at: payload.endsAt ?? null,
      location_name: payload.locationName ?? null,
      notes: payload.notes ?? null,
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return camelizeRecord<DbEvent>(data);
}

// ─── Tasks (requires tasks table — run supabase/migrations/002_mobile_tables.sql) ───
export async function listTasks(teamId: string): Promise<DbTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) {
    if ((error as any).code === '42P01' || (error as any).code === 'PGRST116') return [];
    throw error;
  }
  return camelizeArray<DbTask>(data ?? []);
}

export async function createTask(payload: {
  teamId: string;
  title: string;
  priority?: string;
  dueDate?: string;
  assignedToMemberId?: string;
}): Promise<DbTask> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      team_id: payload.teamId,
      title: payload.title,
      priority: payload.priority ?? 'medium',
      due_date: payload.dueDate ?? null,
      assigned_to_member_id: payload.assignedToMemberId ?? null,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return camelizeRecord<DbTask>(data);
}

export async function updateTask(
  id: string,
  patch: Partial<{ title: string; status: string; priority: string; dueDate: string }>,
): Promise<DbTask> {
  const snake: Record<string, unknown> = {};
  if (patch.title !== undefined) snake.title = patch.title;
  if (patch.status !== undefined) snake.status = patch.status;
  if (patch.priority !== undefined) snake.priority = patch.priority;
  if (patch.dueDate !== undefined) snake.due_date = patch.dueDate;
  const { data, error } = await supabase
    .from('tasks').update(snake).eq('id', id).select().single();
  if (error) throw error;
  return camelizeRecord<DbTask>(data);
}

// ─── Messages (broadcasts table) ───
export async function listMessages(teamId: string): Promise<DbMessage[]> {
  const { data, error } = await supabase
    .from('broadcasts')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return camelizeArray<DbMessage>(data ?? []);
}

export async function createMessage(payload: {
  teamId: string;
  body: string;
  title?: string;
  type?: string;
}): Promise<DbMessage> {
  const user = await getAuthUser();
  const { data, error } = await supabase
    .from('broadcasts')
    .insert({
      team_id: payload.teamId,
      body: payload.body,
      title: payload.title ?? null,
      type: payload.type ?? 'announcement',
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return camelizeRecord<DbMessage>(data);
}

// ─── Notifications (user_notifications table) ───
export async function listNotifications(): Promise<DbNotification[]> {
  const user = await getAuthUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return camelizeArray<DbNotification>(data ?? []);
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await getAuthUser();
  if (!user) return;
  await supabase
    .from('user_notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);
}

// ─── RSVP (event_rsvp table — run supabase/migrations/002_mobile_tables.sql) ───
export async function listRsvp(eventId: string): Promise<DbRsvp[]> {
  const { data, error } = await supabase
    .from('event_rsvp')
    .select('*')
    .eq('event_id', eventId);
  if (error) {
    console.warn('RSVP query error:', error.message);
    return [];
  }
  return camelizeArray<DbRsvp>(data ?? []);
}

export async function upsertRsvp(
  eventId: string,
  teamMemberId: string,
  status: string,
): Promise<void> {
  const { error } = await supabase
    .from('event_rsvp')
    .upsert(
      {
        event_id: eventId,
        team_member_id: teamMemberId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id,team_member_id' },
    );
  if (error) throw error;
}

// ─── Files (files table — run supabase/migrations/002_mobile_tables.sql) ───
export async function listTeamFiles(teamId: string): Promise<DbFile[]> {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('Files query error:', error.message);
    return [];
  }
  return camelizeArray<DbFile>(data ?? []);
}

// ─── Storage uploads ───
export async function uploadToStorage(
  uri: string,
  path: string,
  mimeType: string,
): Promise<string | null> {
  try {
    const resp = await fetch(uri);
    const arrayBuffer = await resp.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    const { data, error } = await supabase.storage
      .from('clasiko-files')
      .upload(path, uint8, { contentType: mimeType, upsert: true });
    if (error) {
      console.warn('Storage upload failed:', error.message);
      return null;
    }
    return supabase.storage.from('clasiko-files').getPublicUrl(data.path).data.publicUrl;
  } catch (err) {
    console.warn('Upload error:', err);
    return null;
  }
}
