'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, login, isInitialized } = useAuth();
  const router = useRouter();

  // 로그인 상태 가드: 이미 로그인된 유저라면 메인으로 리다이렉트
  useEffect(() => {
    if (isInitialized && user) {
      router.push('/');
    }
  }, [isInitialized, user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !pw) return alert("아이디와 비밀번호를 모두 입력해주세요.");
    
    setIsSubmitting(true);
    try {
      // Supabase 로그인 시도 (아이디를 가공된 이메일 형식으로 사용)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: `${id}@hackerhub.com`,
        password: pw,
      });

      if (error) throw error;

      // 로그인 성공 시 DB에서 프로필 정보 가져오기
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      login(profile); // Context 상태 갱신
      router.push('/');
    } catch (error: any) {
      alert("로그인 실패: " + (error.message || "정보를 확인해주세요."));
    } finally {
      setIsSubmitting(false);
    }
  };

  /* --- [로딩 문제 해결] 인증 초기화 대기 가드 --- */
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden transition-all">
        {/* 상단 디자인 포인트 */}
        <div className="h-2 bg-blue-600 w-full"></div>
        
        <div className="p-10 md:p-12">
          <header className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-400 rounded-2xl text-2xl mb-4 shadow-lg shadow-yellow-200">
              🔑
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tighter">Welcome Back</h1>
            <p className="text-slate-400 mt-2 font-medium">해껍에 오신 것을 환영합니다</p>
          </header>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-widest">User ID</label>
              <input 
                type="text"
                required
                disabled={isSubmitting}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all font-bold placeholder-slate-300" 
                placeholder="아이디를 입력하세요" 
                value={id}
                onChange={(e) => setId(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-widest">Password</label>
              <input 
                type="password" 
                required
                disabled={isSubmitting}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all font-bold placeholder-slate-300" 
                placeholder="••••••••" 
                value={pw}
                onChange={(e) => setPw(e.target.value)} 
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-blue-600 shadow-lg shadow-slate-200 hover:shadow-blue-200 transition-all active:scale-[0.98] disabled:bg-slate-300 flex items-center justify-center"
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                "LOGIN NOW"
              )}
            </button>
          </form>

          <footer className="mt-10 text-center space-y-4">
            <div className="text-sm text-slate-400 font-medium">
              아직 회원이 아니신가요? 
              <Link href="/signup" className="ml-2 text-blue-600 font-bold hover:underline">
                회원가입 하기
              </Link>
            </div>
            
            <div className="pt-6 border-t border-slate-50">
              <Link href="/" className="text-xs font-bold text-slate-300 hover:text-slate-500 transition-colors uppercase tracking-widest">
                ← Back to Home
              </Link>
            </div>
          </footer>
        </div>
      </div>
      
      {/* 배경 장식 요소 */}
      <div className="fixed top-0 right-0 -z-10 w-[500px] h-[500px] bg-blue-50 rounded-full blur-[120px] opacity-50 translate-x-1/2 -translate-y-1/2"></div>
      <div className="fixed bottom-0 left-0 -z-10 w-[500px] h-[500px] bg-yellow-50 rounded-full blur-[120px] opacity-50 -translate-x-1/2 translate-y-1/2"></div>
    </main>
  );
}