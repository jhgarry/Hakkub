'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false); // 초기화 상태 추가

  useEffect(() => {
    // [보안/디버깅] 5초 이상 초기화가 안 되면 강제로 로딩을 풉니다.
    const safetyTimer = setTimeout(() => {
      if (!isInitialized) {
        console.warn("⚠️ 인증 초기화가 너무 오래 걸려 강제로 로딩을 해제합니다.");
        setIsInitialized(true);
      }
    }, 5000);

    const initAuth = async () => {
      console.log("🚀 인증 초기화 시작...");
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) console.error("프로필 로드 실패:", profileError);
          setUser(profile || null);
        }
      } catch (error) {
        console.error("❌ 인증 과정 중 치명적 에러:", error);
      } finally {
        console.log("✅ 인증 초기화 완료");
        setIsInitialized(true);
        clearTimeout(safetyTimer);
      }
    };

    initAuth();

    // 상태 변화 감지
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 Auth State Change:", event);
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
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
  }, [isInitialized]);

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