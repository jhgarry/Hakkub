'use client';

import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  // 초기화 중복 실행 방지용 Ref
  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current) return;
    isMounted.current = true;

    // [중요] 5초 후 강제 해제 타이머 (네트워크 지연 대비)
    const safetyTimer = setTimeout(() => {
      if (!isInitialized) {
        console.warn("⚠️ 초기화 지연으로 인한 로딩 강제 해제");
        setIsInitialized(true);
      }
    }, 5000);

    const fetchProfile = async (sessionUser: any) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', sessionUser.id)
          .single();
        
        if (error) {
          console.error("프로필 조회 실패:", error.message);
          return null;
        }
        return data;
      } catch (e) {
        return null;
      }
    };

    const initAuth = async () => {
      console.log("🚀 인증 초기화 시작...");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const profile = await fetchProfile(session.user);
          setUser(profile);
        }
      } catch (error) {
        console.error("❌ 초기 세션 로드 에러:", error);
      } finally {
        console.log("✅ 인증 초기화 완료");
        setIsInitialized(true);
        clearTimeout(safetyTimer);
      }
    };

    initAuth();

    // 상태 변화 감지 (로그인/로그아웃)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 Auth State Change:", event);
      if (session?.user) {
        const profile = await fetchProfile(session.user);
        setUser(profile);
      } else {
        setUser(null);
      }
      setIsInitialized(true);
    });

    return () => {
      authListener.subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []); // 의존성 배열을 빈 배열로 두어 무한 루프 방지

  const login = (userData: any) => setUser(userData);
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isInitialized, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};