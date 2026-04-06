import { createClient } from '@supabase/supabase-js';

// .trim()을 사용하여 혹시 모를 공백을 완전히 제거합니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

if (typeof window !== 'undefined') {
  console.log("🌐 Supabase 초기화 시도 중...");
  if (!supabaseUrl) console.error("❌ URL이 비어있습니다.");
  if (!supabaseAnonKey) console.error("❌ Key가 비어있습니다.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});