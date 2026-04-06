'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      try {
        console.log("🔄 [Auth] 세션 확인 시작...");
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          setUser(profile || null);
          console.log("✅ [Auth] 유저 로드 완료");
        } else {
          console.log("ℹ️ [Auth] 로그인 세션 없음");
        }
      } catch (err) {
        console.error("❌ [Auth] 초기화 에러:", err);
      } finally {
        setIsInitialized(true); // 에러가 나도 로딩은 끝냄
      }
    };

    init();

    // 상태 변화 감지
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
        setUser(profile);
      } else {
        setUser(null);
      }
      setIsInitialized(true);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isInitialized, login: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);