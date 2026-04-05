'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function SignupPage() {
  const { isInitialized } = useAuth();
  const router = useRouter();

  // 상태 관리
  const [id, setId] = useState(''); // 닉네임(아이디) 상태
  const [pw, setPw] = useState(''); // 비밀번호 상태
  const [isIdChecked, setIsIdChecked] = useState(false); // 중복 확인 완료 여부
  const [isSubmitting, setIsSubmitting] = useState(false); // 가입 처리 중 상태

  // 비밀번호 조건: 8자 이상, 특수문자 포함
  const isPwValid = pw.length >= 8 && /[!@#$%^&*]/.test(pw);

  // [기능 1] DB 기반 아이디(닉네임) 중복 확인
  const handleIdCheck = async () => {
    if (!id) return alert("아이디를 입력하세요.");

    const { data, error } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('nickname', id);

    if (error) {
      console.error(error);
      return alert("조회 중 오류가 발생했습니다.");
    }

    if (data && data.length > 0) {
      alert("이미 존재하는 아이디입니다.");
      setIsIdChecked(false);
    } else {
      alert("사용 가능한 아이디입니다.");
      setIsIdChecked(true);
    }
  };

  // [기능 2] 회원가입 처리
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isIdChecked) return alert("아이디 중복 확인이 필요합니다.");
    if (!isPwValid) return alert("비밀번호 조건을 확인하세요.");
    
    setIsSubmitting(true);

    // 1. Auth 계정 생성
    const { data, error: authError } = await supabase.auth.signUp({
      email: `${id}@hackerhub.com`,
      password: pw,
    });

    if (authError) {
      setIsSubmitting(false);
      return alert(authError.message);
    }

    // 2. profiles 테이블에 유저 정보 추가
    if (data.user) {
      const { error: dbError } = await supabase.from('profiles').insert([
        { id: data.user.id, nickname: id, email: data.user.email }
      ]);
      
      if (dbError) {
        setIsSubmitting(false);
        return alert("프로필 생성 오류: " + dbError.message);
      }
      
      alert("회원가입이 완료되었습니다! 로그인해 주세요.");
      router.push('/login');
    }
    setIsSubmitting(false);
  };

  /* --- [로딩 문제 해결] 인증 시스템 초기화 가드 --- */
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-400 tracking-widest uppercase">Initializing</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* 카드 레이아웃 */}
        <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl shadow-slate-200/50 border border-slate-100">
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Create Account</h1>
            <p className="text-slate-400 font-medium">해껍의 새로운 멤버가 되어보세요.</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-6">
            {/* 아이디 입력 섹션 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-wider">Nickname (ID)</label>
              <div className="flex gap-2">
                <input 
                  className={`flex-1 bg-slate-50 border-2 px-4 py-3 rounded-2xl font-bold outline-none transition-all focus:bg-white ${
                    isIdChecked ? 'border-green-500 ring-4 ring-green-500/10' : 'border-slate-100 focus:border-blue-600'
                  }`}
                  value={id} 
                  onChange={(e) => {setId(e.target.value); setIsIdChecked(false);}} 
                  placeholder="사용할 닉네임"
                />
                <button 
                  type="button" 
                  onClick={handleIdCheck} 
                  className="px-5 py-3 bg-slate-900 text-white text-xs font-black rounded-2xl hover:bg-black transition-all active:scale-95"
                >
                  중복확인
                </button>
              </div>
              {isIdChecked && <p className="text-[10px] text-green-600 font-bold ml-1">✓ 사용 가능한 닉네임입니다.</p>}
            </div>

            {/* 비밀번호 입력 섹션 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1 tracking-wider">Password</label>
              <input 
                type="password" 
                className={`w-full bg-slate-50 border-2 px-4 py-3 rounded-2xl font-bold outline-none transition-all focus:bg-white ${
                  pw && isPwValid ? 'border-blue-600 ring-4 ring-blue-600/10' : pw ? 'border-red-400' : 'border-slate-100 focus:border-blue-600'
                }`}
                placeholder="8자 이상, 특수문자 포함"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
              />
              <div className="flex items-center gap-1.5 ml-1">
                <div className={`w-1.5 h-1.5 rounded-full ${isPwValid ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                <p className={`text-[10px] font-bold ${isPwValid ? 'text-green-600' : 'text-slate-400'}`}>
                  8자 이상 & 특수문자(!@#...) 필수 포함
                </p>
              </div>
            </div>

            {/* 가입 버튼 */}
            <button 
              type="submit"
              disabled={!isIdChecked || !isPwValid || isSubmitting}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg transition-all hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 shadow-xl shadow-blue-600/20 active:scale-[0.98] mt-4"
            >
              {isSubmitting ? '가입 처리 중...' : 'JOIN HACKER-HUB'}
            </button>
          </form>

          {/* 하단 링크 */}
          <div className="mt-10 pt-8 border-t border-slate-50 text-center">
            <p className="text-sm text-slate-400 font-medium">
              이미 계정이 있으신가요?{' '}
              <Link href="/login" className="text-blue-600 font-bold hover:underline ml-1">
                로그인하기
              </Link>
            </p>
          </div>
        </div>

        {/* 푸터 문구 */}
        <p className="text-center text-xs text-slate-300 mt-8 font-medium">
          가입 시 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
      </div>
    </main>
  );
}