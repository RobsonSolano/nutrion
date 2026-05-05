// NutriOn — Edge function admin-list-users
// Junta auth.users + profiles + resolve coach_name. Acesso restrito a
// admins (validado via tabela admin_users).

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Role = 'comum' | 'aluno' | 'professor';
type RoleFilter = Role | 'all';

type RequestBody = {
  role?: RoleFilter;
  coach_id?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  // 1. Validar JWT do caller
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'missing_token' });

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userErr } = await supabaseUser.auth.getUser();
  if (userErr || !user) return json(401, { error: 'invalid_token' });

  // 2. Validar admin
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: adminRow } = await supabaseAdmin
    .from('admin_users')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!adminRow) return json(403, { error: 'not_admin' });

  // 3. Parse filtros
  let body: RequestBody = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }
  const role: RoleFilter = body.role ?? 'all';
  const search = body.search?.trim();
  const coachId = body.coach_id;
  const limit = Math.min(Math.max(body.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(body.offset ?? 0, 0);

  // 4. Query profiles (com filtros + count exato)
  let query = supabaseAdmin
    .from('profiles')
    .select(
      'id, full_name, avatar_url, role, coach_id, user_number, is_early_adopter, created_at',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (role !== 'all') query = query.eq('role', role);
  if (coachId) query = query.eq('coach_id', coachId);
  if (search) {
    // ILIKE em full_name. Email-search fica deferred (precisa lookup
    // adicional em auth.users por padrão).
    query = query.ilike('full_name', `%${search}%`);
  }

  const { data: profiles, count, error: profilesErr } = await query;
  if (profilesErr) {
    return json(500, { error: 'profiles_query_failed', detail: profilesErr.message });
  }

  // 5. Buscar e-mails de auth.users (uma chamada paginada simples)
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authErr) {
    return json(500, { error: 'auth_list_failed', detail: authErr.message });
  }

  const emailMap = new Map<string, string>();
  for (const u of authData.users) {
    if (u.email) emailMap.set(u.id, u.email);
  }

  // 6. Resolver coach_name — uma query extra pelos IDs únicos
  const coachIds = Array.from(
    new Set(
      profiles?.map((p) => p.coach_id).filter((id): id is string => Boolean(id)) ?? [],
    ),
  );

  const coachNameMap = new Map<string, string | null>();
  if (coachIds.length > 0) {
    const { data: coachProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', coachIds);
    for (const c of coachProfiles ?? []) {
      coachNameMap.set(c.id, c.full_name);
    }
  }

  // 7. Compor response
  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emailMap.get(p.id) ?? '',
    full_name: p.full_name,
    avatar_url: p.avatar_url,
    role: p.role as Role,
    coach_id: p.coach_id,
    coach_name: p.coach_id ? coachNameMap.get(p.coach_id) ?? null : null,
    user_number: p.user_number,
    is_early_adopter: p.is_early_adopter,
    created_at: p.created_at,
  }));

  return json(200, { users, total: count ?? users.length });
});
