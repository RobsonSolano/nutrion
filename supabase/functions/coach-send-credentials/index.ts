// NutriOn — Edge Function coach-send-credentials
// Envia um email pro aluno com as credenciais (email + senha) que o
// professor definiu/gerou ao cadastrá-lo. Usa Gmail SMTP via denomailer
// — credenciais via secrets GMAIL_USER + GMAIL_APP_PASSWORD.
//
// Não armazenamos a senha em lugar nenhum — quem chama (o app do
// professor) lembra a senha apenas até este envio. Se o professor
// quiser reenviar mais tarde, terá que resetar a senha do aluno.

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GMAIL_USER = Deno.env.get('GMAIL_USER');
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = {
  student_id: string;
  password: string;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  if (!SERVICE_ROLE_KEY) {
    return json({ error: 'missing_service_role' }, 500);
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return json(
      {
        error: 'missing_smtp_secret',
        detail:
          'GMAIL_USER e GMAIL_APP_PASSWORD precisam estar nos secrets. Rode: npx supabase secrets set GMAIL_USER=... GMAIL_APP_PASSWORD="..."',
      },
      500,
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing bearer token' }, 401);
    }

    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user: caller },
      error: callerErr,
    } = await supabaseAuth.auth.getUser();
    if (callerErr || !caller) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body?.student_id || !body?.password) {
      return json(
        { error: 'invalid_body', detail: 'student_id e password obrigatórios.' },
        400,
      );
    }

    // Caller precisa ser professor do aluno.
    const { data: student, error: studentErr } = await supabaseService
      .from('profiles')
      .select('id, role, coach_id, full_name')
      .eq('id', body.student_id)
      .single();
    if (studentErr || !student) {
      return json({ error: 'student_not_found' }, 404);
    }
    if (student.role !== 'aluno' || student.coach_id !== caller.id) {
      return json({ error: 'forbidden' }, 403);
    }

    // Pega email do aluno do auth.users (não fica em public.profiles).
    const { data: authStudent, error: authErr } =
      await supabaseService.auth.admin.getUserById(body.student_id);
    if (authErr || !authStudent.user?.email) {
      return json(
        { error: 'student_email_missing', detail: authErr?.message ?? 'email ausente' },
        500,
      );
    }
    const studentEmail = authStudent.user.email;

    // Nome do professor pra assinatura do email.
    const { data: coachProfile } = await supabaseService
      .from('profiles')
      .select('full_name')
      .eq('id', caller.id)
      .single();
    const coachName = coachProfile?.full_name ?? 'Seu professor';

    const studentName = student.full_name ?? 'Aluno';

    const subject = `Seu acesso ao NutriOn — convite de ${coachName}`;
    const text = buildPlainText({
      studentName,
      coachName,
      email: studentEmail,
      password: body.password,
    });
    const html = buildHtml({
      studentName,
      coachName,
      email: studentEmail,
      password: body.password,
    });

    const client = new SMTPClient({
      connection: {
        hostname: 'smtp.gmail.com',
        port: 465,
        tls: true,
        auth: {
          username: GMAIL_USER,
          password: GMAIL_APP_PASSWORD,
        },
      },
    });

    try {
      await client.send({
        from: `NutriOn <${GMAIL_USER}>`,
        to: studentEmail,
        subject,
        content: text,
        html,
      });
    } finally {
      // denomailer.close() pode retornar void OU Promise dependendo da
      // versao. Encapsulamos em try/catch defensivo pra evitar
      // "Cannot read properties of undefined (reading 'catch')".
      try {
        const maybePromise = client.close();
        if (
          maybePromise &&
          typeof (maybePromise as Promise<unknown>).then === 'function'
        ) {
          await maybePromise;
        }
      } catch (_) {
        // ignora — close best-effort.
      }
    }

    return json({ ok: true, sent_to: studentEmail });
  } catch (err) {
    console.error('[coach-send-credentials] unexpected error:', err);
    return json(
      {
        error: 'send_failed',
        detail: err instanceof Error ? err.message : String(err),
      },
      500,
    );
  }
});

function buildPlainText(p: {
  studentName: string;
  coachName: string;
  email: string;
  password: string;
}): string {
  return [
    `Olá, ${p.studentName}!`,
    '',
    `${p.coachName} criou um acesso pra você no NutriOn — o app de nutrição e treino que vocês vão usar pra acompanhar seu progresso.`,
    '',
    'Seus dados de acesso:',
    `  Email: ${p.email}`,
    `  Senha: ${p.password}`,
    '',
    'Recomendação: troque a senha no primeiro acesso, em Perfil > Trocar senha.',
    '',
    'Baixe o app e faça login pra começar.',
    '',
    '— Equipe NutriOn',
  ].join('\n');
}

function buildHtml(p: {
  studentName: string;
  coachName: string;
  email: string;
  password: string;
}): string {
  // HTML simples e robusto — sem CSS externo, sem imagens.
  return `<!doctype html>
<html lang="pt-BR">
<body style="margin:0; padding:24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0a0b0f; color:#e4e4e7;">
  <div style="max-width:560px; margin:0 auto; background:#15161c; border:1px solid #2a2c36; border-radius:16px; padding:28px;">
    <h1 style="font-size:22px; margin:0 0 8px; color:#39ff14;">NutriOn</h1>
    <p style="margin:0 0 16px; color:#a1a1aa;">Convite de acesso enviado por ${escapeHtml(p.coachName)}</p>
    <p style="margin:0 0 16px;">Olá, <strong>${escapeHtml(p.studentName)}</strong>!</p>
    <p style="margin:0 0 16px; line-height:1.6;">
      ${escapeHtml(p.coachName)} criou um acesso pra você no NutriOn —
      o app de nutrição e treino que vocês vão usar pra acompanhar seu progresso.
    </p>
    <div style="background:#0a0b0f; border:1px solid #2a2c36; border-radius:12px; padding:16px; margin:16px 0;">
      <div style="font-size:11px; color:#71717a; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:6px;">Email</div>
      <div style="font-family: monospace; font-size:14px; color:#e4e4e7;">${escapeHtml(p.email)}</div>
    </div>
    <div style="background:#0a0b0f; border:1px solid #2a2c36; border-radius:12px; padding:16px; margin:16px 0;">
      <div style="font-size:11px; color:#71717a; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:6px;">Senha</div>
      <div style="font-family: monospace; font-size:14px; color:#e4e4e7;">${escapeHtml(p.password)}</div>
    </div>
    <p style="margin:16px 0 0; color:#a1a1aa; font-size:13px; line-height:1.6;">
      Recomendamos trocar a senha no primeiro acesso, em <strong>Perfil &gt; Trocar senha</strong>.
    </p>
    <p style="margin:24px 0 0; color:#71717a; font-size:12px;">— Equipe NutriOn</p>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
