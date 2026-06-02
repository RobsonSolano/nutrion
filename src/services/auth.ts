import { IS_EXPO_GO } from '@/lib/platform';
import { supabase } from './supabase';

const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

// Tipos mínimos para evitar import estático do módulo nativo.
// O módulo real só é carregado via require() dentro das funções que precisam dele,
// porque importá-lo estaticamente crasha no Expo Go (sem o native binary RNGoogleSignin).
type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin');

let googleSigninCache: GoogleSigninModule | null = null;
function loadGoogleSignin(): GoogleSigninModule {
  if (IS_EXPO_GO) {
    throw new Error(
      'Login com Google só funciona no development build. Use o login por e-mail no Expo Go.',
    );
  }
  if (!googleSigninCache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    googleSigninCache = require('@react-native-google-signin/google-signin') as GoogleSigninModule;
  }
  return googleSigninCache;
}

let configured = false;

export function configureGoogleSignin() {
  if (configured || IS_EXPO_GO) return;
  if (!webClientId) {
    throw new Error(
      'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID precisa estar definido em .env.local',
    );
  }
  const { GoogleSignin } = loadGoogleSignin();
  GoogleSignin.configure({
    webClientId,
    offlineAccess: false,
    scopes: ['profile', 'email'],
  });
  configured = true;
}

export class AuthCancelled extends Error {
  constructor() {
    super('Login cancelado pelo usuário.');
    this.name = 'AuthCancelled';
  }
}

export async function signInWithGoogle() {
  const { GoogleSignin, statusCodes } = loadGoogleSignin();
  configureGoogleSignin();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch (err) {
    throw new Error('Play Services indisponível neste device.');
  }

  let userInfo;
  try {
    userInfo = await GoogleSignin.signIn();
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e?.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new AuthCancelled();
    }
    if (e?.code === statusCodes.IN_PROGRESS) {
      throw new Error('Login já em andamento.');
    }
    if (e?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error('Play Services não disponível.');
    }
    throw err;
  }

  const idToken =
    // v14+ shape
    (userInfo as { data?: { idToken?: string | null } })?.data?.idToken ??
    // legacy shape
    (userInfo as { idToken?: string | null })?.idToken ??
    null;

  if (!idToken) {
    throw new Error('Google não devolveu um ID Token.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!IS_EXPO_GO && configured) {
    try {
      const { GoogleSignin } = loadGoogleSignin();
      await GoogleSignin.signOut();
    } catch {
      // ignora — queremos sair do Supabase de qualquer jeito
    }
  }
  await supabase.auth.signOut();
}

function normalizeEmail(raw: string) {
  const clean = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new Error('Email inválido.');
  }
  return clean;
}

function validatePassword(password: string) {
  if (!password || password.length < 6) {
    throw new Error('A senha precisa ter pelo menos 6 caracteres.');
  }
}

export async function signUpWithPassword(params: {
  fullName: string;
  email: string;
  password: string;
}) {
  const email = normalizeEmail(params.email);
  validatePassword(params.password);
  const fullName = params.fullName.trim();
  if (fullName.length < 2) {
    throw new Error('Informe seu nome.');
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: params.password,
    options: {
      data: { full_name: fullName, name: fullName },
    },
  });
  if (error) throw error;

  // Se o projeto estiver com "Confirm email" OFF, já vem session; senão,
  // faz sign-in imediato (confirmado por quem setou no dashboard).
  if (!data.session) {
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password: params.password,
    });
    if (signInErr) throw signInErr;
  }
  return data;
}

export async function signInWithEmailPassword(params: {
  email: string;
  password: string;
}) {
  const email = normalizeEmail(params.email);
  validatePassword(params.password);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: params.password,
  });
  if (error) throw error;
  return data;
}

export async function changePassword(newPassword: string) {
  validatePassword(newPassword);
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function requestPasswordReset(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  // Supabase manda email com link nativo (template configuravel no dashboard).
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

export type DeleteMyAccountError =
  | { code: 'has_students'; studentCount: number; studentIds: string[] }
  | { code: 'unauthorized' }
  | { code: 'unknown'; detail?: string };

/**
 * Excluir minha própria conta — fluxo LGPD / Play Store / App Store.
 *
 * - Se professor com alunos vinculados → erro `has_students` (UI
 *   precisa redirecionar pra desvincular antes).
 * - Caso contrário → hard delete em auth.users (cascade limpa tudo);
 *   se aluno, coach recebe push antes do delete.
 *
 * Após sucesso, o caller DEVE fazer signOut local + limpar caches.
 * A sessão fica inválida no próximo refresh do JWT.
 */
export async function deleteMyAccount(reason: string | null): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    const err = new Error('Sessão expirada.') as Error & {
      info?: DeleteMyAccountError;
    };
    err.info = { code: 'unauthorized' };
    throw err;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const res = await fetch(`${supabaseUrl}/functions/v1/delete-my-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
    },
    body: JSON.stringify({ reason: reason ?? null }),
  });

  if (res.ok) return;

  const payload = await res.json().catch(() => ({}));
  const err = new Error(
    payload?.detail || payload?.error || 'Falha ao excluir conta.',
  ) as Error & { info?: DeleteMyAccountError };
  if (res.status === 409 && payload?.error === 'has_students') {
    err.info = {
      code: 'has_students',
      studentCount: payload.student_count ?? 0,
      studentIds: payload.student_ids ?? [],
    };
  } else if (res.status === 401) {
    err.info = { code: 'unauthorized' };
  } else {
    err.info = { code: 'unknown', detail: payload?.detail };
  }
  throw err;
}
