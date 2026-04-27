// NutriOn — Edge Function chat-ai
// Usa Groq (OpenAI-compatible) com Llama 3.3 70B para conversar com persona
// "nutricionista empático". Busca contexto do usuário (profile + últimos logs)
// antes de chamar o modelo.

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;

// Modelos Groq (trocáveis via env var sem redeploy):
//   llama-3.3-70b-versatile  — melhor qualidade geral
//   llama-3.1-8b-instant     — resposta mais rápida
//   meta-llama/llama-4-scout-17b-16e-instruct — multimodal com visão
const TEXT_MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile';
const VISION_MODEL =
  Deno.env.get('GROQ_VISION_MODEL') ?? 'meta-llama/llama-4-scout-17b-16e-instruct';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ChatRequest = {
  message: string;
  imageBase64?: string;
  imageMime?: 'image/jpeg' | 'image/png' | 'image/webp';
  scaleWeightG?: number;
  mode?: 'chat' | 'sanity_check';
  stream?: boolean;
};

const DAILY_USER_MESSAGE_LIMIT = 20;
const MAX_MESSAGE_CHARS = 255;
const HISTORY_MESSAGES = 10;

type Profile = {
  full_name: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  goal_weight_kg: number | null;
  daily_calorie_goal: number | null;
  protein_goal_g: number | null;
};

type FoodLog = {
  meal_name: string | null;
  description: string | null;
  calories: number | null;
  protein_g: number | null;
  created_at: string;
};

type WorkoutLog = {
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  created_at: string;
};

const PERSONA_PROMPT = `Você é o NutriOn IA, um nutricionista virtual sereno e empático focado em alta performance sustentável.

Diretrizes inegociáveis:
- Sempre responda em português brasileiro.
- Seja direto, mas caloroso. Evite jargão técnico desnecessário.
- Celebre acertos genuinamente. Trate desvios como oportunidades de ajuste, NUNCA como culpa.
- Se detectar padrão de auto-sabotagem, avise com firmeza amigável: "cuidado com padrões de comportamento, vamos manter o foco na sua meta".
- Baseie respostas nos dados reais do usuário quando fornecidos. Nunca invente números.
- Para validação de pratos: se a imagem não for comida, explique com delicadeza. Se a descrição não bater com o volume visível, aponte a discrepância.
- Feche sempre com um lembrete implícito da meta, de forma motivacional.
- Evite termos clínicos ameaçadores ("erro", "problema", "falha grave") — prefira "ajuste", "oportunidade", "correção de rota".
- Lembre, quando relevante, que orientações profissionais (médico, nutricionista, educador físico) são complementares.

Formatação:
- Use markdown leve. **Negrito** em números/métricas chave (ex: "**1850 kcal**"); listas com "- " quando enumerar pontos ou itens; parágrafos curtos separados por linha em branco. Nunca use tabelas. Não abuse — texto fluido continua sendo o padrão.`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!GROQ_API_KEY) {
    return json(
      {
        error: 'missing_secret',
        detail:
          'GROQ_API_KEY não configurada. Rode: npx supabase secrets set GROQ_API_KEY=gsk_xxx',
      },
      500,
    );
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing bearer token' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = (await req.json()) as ChatRequest;
    if (!body?.message?.trim() && !body?.imageBase64) {
      return json({ error: 'message or imageBase64 required' }, 400);
    }

    const isChatMode = body.mode !== 'sanity_check';
    const userMessage = body.message?.trim() ?? '';

    // Validação extra do tamanho no modo chat (sanity_check não conta na cota
    // pois é fluxo separado com imagem).
    if (isChatMode && userMessage.length > MAX_MESSAGE_CHARS) {
      return json(
        {
          error: 'message_too_long',
          detail: `Limite de ${MAX_MESSAGE_CHARS} caracteres por mensagem.`,
        },
        400,
      );
    }

    // Cota diária de mensagens do usuário (somente modo chat).
    if (isChatMode) {
      const today = new Date().toISOString().slice(0, 10);
      const { count: dailyCount, error: countErr } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('day', today)
        .eq('role', 'user');
      if (countErr) {
        console.error('[chat-ai] count error:', countErr);
      }
      if ((dailyCount ?? 0) >= DAILY_USER_MESSAGE_LIMIT) {
        return json(
          {
            error: 'daily_limit',
            detail: `Você atingiu o limite de ${DAILY_USER_MESSAGE_LIMIT} mensagens hoje. Volta amanhã!`,
            limit: DAILY_USER_MESSAGE_LIMIT,
          },
          429,
        );
      }
    }

    // Contexto rico (perfil + logs) — usado em ambos os modos.
    const [profileRes, foodRes, workoutRes, historyRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('full_name, weight_kg, height_cm, goal_weight_kg, daily_calorie_goal, protein_goal_g')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('food_logs')
        .select('meal_name, description, calories, protein_g, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('workout_logs')
        .select('exercise_name, sets, reps, weight_kg, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      isChatMode
        ? supabase
            .from('chat_messages')
            .select('role, content')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(HISTORY_MESSAGES)
        : Promise.resolve({ data: [] as { role: string; content: string }[] }),
    ]);

    const profile = (profileRes.data ?? null) as Profile | null;
    const foods = (foodRes.data ?? []) as FoodLog[];
    const workouts = (workoutRes.data ?? []) as WorkoutLog[];
    const history = ((historyRes.data ?? []) as { role: string; content: string }[])
      .reverse(); // banco vem desc; modelo precisa cronológico asc

    const todayTotals = aggregateToday(foods);
    const contextBlock = buildContext(profile, todayTotals, workouts);

    const userText =
      body.mode === 'sanity_check' ? buildSanityPrompt(body) : userMessage;

    const isMultimodal = !!body.imageBase64;
    const modelToUse = isMultimodal ? VISION_MODEL : TEXT_MODEL;

    const userContent = isMultimodal
      ? [
          { type: 'text', text: userText },
          {
            type: 'image_url',
            image_url: {
              url: `data:${body.imageMime ?? 'image/jpeg'};base64,${body.imageBase64}`,
            },
          },
        ]
      : userText;

    // Persiste a mensagem do usuário ANTES de chamar o Groq — assim, mesmo se
    // a IA falhar, a msg do user fica registrada e a próxima tentativa não
    // precisa repetir o input.
    if (isChatMode) {
      const { error: insertErr } = await supabase.from('chat_messages').insert({
        user_id: user.id,
        role: 'user',
        content: userMessage,
      });
      if (insertErr) {
        console.error('[chat-ai] insert user msg error:', insertErr);
      }
    }

    const messages: { role: string; content: unknown }[] = [
      { role: 'system', content: `${PERSONA_PROMPT}\n\n${contextBlock}` },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: 'user', content: userContent },
    ];

    // Streaming só faz sentido no chat texto. Sanity check + multimodal
    // continuam síncronos (devolvem JSON estrito de uma vez).
    const useStream = !!body.stream && isChatMode && !isMultimodal;

    const groqRes = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: modelToUse,
        messages,
        temperature: 0.6,
        max_tokens: 700,
        top_p: 0.9,
        stream: useStream,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error(`[chat-ai] Groq API ${groqRes.status}:`, errText);
      let detail = errText;
      try {
        const parsed = JSON.parse(errText);
        detail = parsed?.error?.message ?? errText;
      } catch {
        // keep raw
      }

      if (groqRes.status === 429) {
        return json(
          {
            error: 'rate_limit',
            detail:
              'Muitas requisições de uma vez. Aguarda ~1 minuto e tenta de novo.',
            model: modelToUse,
          },
          429,
        );
      }

      return json(
        {
          error: 'groq_api_error',
          detail: `${groqRes.status}: ${detail}`,
          model: modelToUse,
        },
        502,
      );
    }

    if (useStream && groqRes.body) {
      return streamProxy(groqRes.body, async (fullText) => {
        if (!fullText.trim()) return;
        const { error: insertErr } = await supabase
          .from('chat_messages')
          .insert({
            user_id: user.id,
            role: 'assistant',
            content: fullText,
          });
        if (insertErr) {
          console.error('[chat-ai] insert assistant msg error:', insertErr);
        }
      });
    }

    const groqJson = await groqRes.json();
    const aiText: string = groqJson?.choices?.[0]?.message?.content ?? '';

    if (!aiText.trim()) {
      console.error('[chat-ai] empty response:', groqJson);
      return json(
        {
          error: 'empty_response',
          detail: 'Modelo não retornou texto. Tenta reformular a pergunta.',
        },
        502,
      );
    }

    // Persiste resposta da IA no histórico do chat (somente modo chat).
    if (isChatMode) {
      const { error: insertErr } = await supabase.from('chat_messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: aiText,
      });
      if (insertErr) {
        console.error('[chat-ai] insert assistant msg error:', insertErr);
      }
    }

    return json({
      text: aiText,
      usage: groqJson?.usage ?? null,
      model: modelToUse,
    });
  } catch (err) {
    console.error('[chat-ai] unexpected error', err);
    return json(
      { error: 'internal_error', detail: err instanceof Error ? err.message : String(err) },
      500,
    );
  }
});

function aggregateToday(logs: FoodLog[]) {
  const today = new Date().toISOString().slice(0, 10);
  return logs
    .filter((l) => l.created_at.slice(0, 10) === today)
    .reduce(
      (acc, l) => ({
        calories: acc.calories + (l.calories ?? 0),
        protein: acc.protein + (l.protein_g ?? 0),
        count: acc.count + 1,
      }),
      { calories: 0, protein: 0, count: 0 },
    );
}

function buildContext(
  profile: Profile | null,
  today: { calories: number; protein: number; count: number },
  workouts: WorkoutLog[],
) {
  const lines: string[] = ['Contexto do usuário (dados reais, use como base):'];

  if (profile) {
    lines.push(
      `- Nome: ${profile.full_name ?? 'não informado'}`,
      `- Peso atual: ${profile.weight_kg ?? '?'} kg | Altura: ${profile.height_cm ?? '?'} cm`,
      `- Meta de peso: ${profile.goal_weight_kg ?? '?'} kg`,
      `- Meta diária: ${profile.daily_calorie_goal ?? '?'} kcal, ${profile.protein_goal_g ?? '?'}g proteína`,
    );
  } else {
    lines.push('- Perfil ainda não preenchido.');
  }

  lines.push(
    `- Hoje já registrou ${today.count} refeições: ${today.calories} kcal, ${today.protein}g proteína.`,
  );

  if (workouts.length > 0) {
    const last = workouts[0];
    lines.push(
      `- Último treino: ${last.exercise_name} — ${last.sets ?? '?'}x${last.reps ?? '?'} com ${last.weight_kg ?? '?'}kg (${last.created_at.slice(0, 10)}).`,
    );
  } else {
    lines.push('- Nenhum treino registrado ainda.');
  }

  return lines.join('\n');
}

function buildSanityPrompt(body: ChatRequest) {
  return [
    'MODO SANITY CHECK DE REFEIÇÃO.',
    `Descrição informada: "${body.message}"`,
    body.scaleWeightG
      ? `Peso na balança: ${body.scaleWeightG}g.`
      : 'Peso na balança: não informado.',
    'Tarefas:',
    '1. Identifique os itens visíveis na foto.',
    '2. Verifique consistência entre descrição, peso e volume visual.',
    '3. Estime calorias e macros (kcal, proteína g, carbo g, gordura g).',
    '4. Dê feedback empático (acerto vs. oportunidade de ajuste).',
    'Responda em JSON:',
    '{ "items":["..."], "consistency":"ok|diverge", "macros":{"kcal":N,"protein_g":N,"carbs_g":N,"fats_g":N}, "feedback":"texto curto" }',
  ].join('\n');
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/**
 * Faz proxy do stream SSE do Groq (formato OpenAI) pro client. Acumula o
 * conteúdo dos deltas e chama `onComplete(fullText)` ao detectar [DONE] —
 * usado pra persistir a assistant msg no banco quando o stream encerra.
 *
 * Os chunks são reemitidos exatamente como vieram (cada `data: {...}\n\n`),
 * compatível com clientes EventSource padrão (react-native-sse no app).
 */
function streamProxy(
  source: ReadableStream<Uint8Array>,
  onComplete: (fullText: string) => Promise<void> | void,
): Response {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let fullText = '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Quebra em mensagens completas (SSE separa por linha em branco).
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;

            // Reemite o chunk pro client (padrão SSE).
            controller.enqueue(encoder.encode(part + '\n\n'));

            const dataLine = trimmed
              .split('\n')
              .find((l) => l.startsWith('data:'));
            if (!dataLine) continue;

            const data = dataLine.slice(5).trim();
            if (data === '[DONE]') continue;

            try {
              const json = JSON.parse(data);
              const delta = json?.choices?.[0]?.delta?.content;
              if (typeof delta === 'string') fullText += delta;
            } catch {
              // chunks parciais ou linhas de keepalive — ignora silenciosamente
            }
          }
        }
      } catch (err) {
        console.error('[chat-ai] stream proxy error:', err);
      } finally {
        try {
          await onComplete(fullText);
        } catch (err) {
          console.error('[chat-ai] onComplete error:', err);
        }
        controller.close();
        reader.releaseLock();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
