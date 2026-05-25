import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';
import { readFileAsArrayBuffer } from '@/lib/uploadFile';

const BUCKET = 'profile-photos';
const TARGET_WIDTH = 512; // suficiente pra avatar em qualquer tela do app

/**
 * Comprime a imagem apontada por `uri` pra ~512px (JPEG), sobe pro
 * bucket profile-photos e atualiza profiles.avatar_url do user atual.
 *
 * Path: `<user_id>/avatar-<timestamp>.jpg` — timestamp evita problemas
 * de cache do Image que reusa o mesmo path entre uploads.
 */
export async function uploadAvatar(localUri: string): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  const resized = await manipulateAsync(
    localUri,
    [{ resize: { width: TARGET_WIDTH } }],
    { compress: 0.85, format: SaveFormat.JPEG },
  );

  const buffer = await readFileAsArrayBuffer(resized.uri);
  const path = `${user.id}/avatar-${Date.now()}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', user.id);
  if (profErr) throw profErr;

  // Best-effort: tenta apagar avatares antigos do user (mesma pasta)
  void cleanupOldAvatars(user.id, path);

  return publicUrl;
}

export async function removeAvatar(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sessão expirada.');

  // Limpa o avatar_url no profile primeiro (não-bloqueante pra delete)
  await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', user.id);

  // Apaga tudo na pasta do user
  const { data: files } = await supabase.storage.from(BUCKET).list(user.id);
  if (files && files.length > 0) {
    const paths = files.map((f) => `${user.id}/${f.name}`);
    await supabase.storage.from(BUCKET).remove(paths);
  }
}

// =====================================================================
// Helpers
// =====================================================================
async function cleanupOldAvatars(userId: string, keepPath: string) {
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list(userId);
    if (!files) return;
    const stale = files
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => p !== keepPath);
    if (stale.length === 0) return;
    await supabase.storage.from(BUCKET).remove(stale);
  } catch (err) {
    console.warn('[avatar] cleanup failed:', err);
  }
}
