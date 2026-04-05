'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false); // 초기화 상태 추가

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. 현재 세션 확인
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          // 2. 세션이 있다면 프로필 정보 가져오기
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setUser(profile);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        // 3. 확인이 끝났으므로 초기화 완료 설정
        setIsInitialized(true);
      }
    };

    initAuth();

    // 로그인 상태 변경 감지
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
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