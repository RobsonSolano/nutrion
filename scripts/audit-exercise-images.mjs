// NutriOn — auditoria de imagens/vídeos no catálogo de exercícios
//
// Uso:
//   node --env-file=.env.local scripts/audit-exercise-images.mjs
// ou:
//   npm run audit:exercise-images
//
// Lê a tabela exercises via REST (anon key — basta SELECT permitido pela RLS)
// e imprime quem está sem image_urls e/ou sem video_url, agrupado por grupo
// muscular. Saída em markdown — útil pra colar em issue/spec.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  console.error(
    '❌ Faltam EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY no env.',
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const [groupsRes, exercisesRes] = await Promise.all([
  supabase
    .from('exercise_groups')
    .select('id, slug, name, sort_order')
    .order('sort_order', { ascending: true }),
  supabase
    .from('exercises')
    .select('id, name, equipment, group_id, image_urls, video_url')
    .order('name', { ascending: true }),
]);

if (groupsRes.error) {
  console.error('❌ Erro lendo exercise_groups:', groupsRes.error.message);
  process.exit(1);
}
if (exercisesRes.error) {
  console.error('❌ Erro lendo exercises:', exercisesRes.error.message);
  process.exit(1);
}

const groups = groupsRes.data;
const exercises = exercisesRes.data;
const total = exercises.length;
const semImg = exercises.filter((e) => !e.image_urls || e.image_urls.length === 0);
const semVid = exercises.filter((e) => !e.video_url);

console.log('# Auditoria do catálogo de exercícios\n');
console.log(`- Total: **${total}**`);
console.log(`- Sem imagem: **${semImg.length}** (${pct(semImg.length, total)}%)`);
console.log(`- Sem vídeo:  **${semVid.length}** (${pct(semVid.length, total)}%)\n`);

printSection('Sem imagem', semImg, groups);
printSection('Sem vídeo', semVid, groups);

function printSection(title, items, groupList) {
  console.log(`## ${title} (por grupo)\n`);
  for (const g of groupList) {
    const list = items.filter((e) => e.group_id === g.id);
    if (list.length === 0) continue;
    console.log(`### ${g.name} (${list.length})\n`);
    for (const e of list) {
      console.log(`- ${e.name}${e.equipment ? ` _(${e.equipment})_` : ''}`);
    }
    console.log('');
  }
}

function pct(part, whole) {
  return whole === 0 ? 0 : Math.round((part * 100) / whole);
}
