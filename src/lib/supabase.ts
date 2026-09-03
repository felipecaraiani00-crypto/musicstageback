import { createClient } from "@supabase/supabase-js";

// Configuração do Supabase
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL || "https://asuvdhymomtjbbdjhhfq.supabase.co",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_FGYNX4HL_9-Pr0PIIHCzWQ_b-zIlSkv",
  bucket: "multitracks2",
} as const;

// Instância singleton do cliente Supabase
export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

/**
 * Retorna a URL pública de um arquivo de áudio no bucket multitracks2
 */
export function getAudioPublicUrl(filePath: string): string {
  if (!filePath) return "";
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return filePath;
  }
  const { data } = supabase.storage.from(SUPABASE_CONFIG.bucket).getPublicUrl(filePath);
  return data.publicUrl;
}
