// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 배포 환경에서만 변수 존재 여부 출력 (값은 보안상 숨김)
if (typeof window !== 'undefined') {
  console.log("🛠️ Supabase URL Loaded:", !!supabaseUrl);
  console.log("🛠️ Supabase Key Loaded:", !!supabaseAnonKey);
}

if (!supabaseUrl || !supabaseAnonKey) {
  // 이 에러가 뜬다면 Vercel Environment Variables 설정에 오타가 있거나 배포 시점에 누락된 것입니다.
  console.error("❌ Supabase environment variables are missing!");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);