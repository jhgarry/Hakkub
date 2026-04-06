'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // 1. 프로필 정보를 가져오는 별도의 함수
    const getProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (error) throw error;
        return data;
      } catch (e) {
        console.error("⚠️ 프로필 로드 실패:", e);
        return null;
      }
    };

    // 2. 메인 초기화 로직
    const initialize = async () => {
      console.log("🔄 [Auth] 세션 확인 시작...");
      
      try {
        // getSession이 무한대기에 빠지는 것을 방지하기 위해 Promise.race 사용 (3초 타임아웃)
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 3000)
        );

        const { data: { session } }: any = await Promise.race([sessionPromise, timeoutPromise]);

        if (session?.user) {
          console.log("✅ [Auth] 세션 발견, 유저 ID:", session.user.id);
          const profile = await getProfile(session.user.id);
          setUser(profile);
        } else {
          console.log("ℹ️ [Auth] 세션 없음");
        }
      } catch (err) {
        console.error("❌ [Auth] 초기화 중단 또는 타임아웃:", err);
      } finally {
        // 성공하든 실패하든, 혹은 타임아웃이 나든 본문은 보여줌
        setIsInitialized(true);
        console.log("🏁 [Auth] 초기화 프로세스 종료");
      }
    };

    initialize();

    // 3. 인증 상태 변화 리스너
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 [Auth] 상태 변경 이벤트:", event);
      if (session?.user) {
        const profile = await getProfile(session.user.id);
        setUser(profile);
      } else {
        setUser(null);
      }
      setIsInitialized(true);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, isInitialized, login: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);