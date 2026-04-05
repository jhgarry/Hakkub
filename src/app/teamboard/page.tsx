'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function TeamBoardPage() {
  const { isInitialized } = useAuth();
  
  // 데이터 상태
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 데이터 페칭 로직
  const fetchRecruitingTeams = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hackathon_teams')
        .select('*, hackathon:hackathons(title)')
        .eq('is_recruiting', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setTeams(data);
    } catch (err) {
      console.error("Error fetching teams:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 인증 시스템 준비 완료 후 데이터 호출
  useEffect(() => {
    if (isInitialized) {
      fetchRecruitingTeams();
    }
  }, [isInitialized, fetchRecruitingTeams]);

  /* --- 로딩 가드: 인증 초기화 혹은 데이터 로딩 중일 때 본문 렌더링 차단 --- */
  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-white">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          Loading Board...
        </p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          로딩이 오래 걸리면 새로고침을 해 보세요!
        </p>
      </div>
    );
  }

  return (
    <main className="bg-white min-h-screen">
      {/* Header Section */}
      <section className="bg-slate-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-8 py-16 md:py-20">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
                모집 게시판
              </h1>
              <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
                현재 팀원을 찾고 있는 프로젝트들입니다. <br />
                당신의 기술 스택에 맞는 최고의 팀에 합류해 보세요.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white px-6 py-3 rounded-2xl border border-slate-200 shadow-sm">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
              <span className="text-sm font-bold text-slate-700">
                {teams.length}개의 활성 공고
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Grid Content Area */}
      <section className="max-w-7xl mx-auto px-8 py-16">
        {teams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {teams.map((team) => (
              <Link key={team.id} href={`/teamboard/${team.id}`} className="group">
                <div className="h-full bg-white border border-slate-200 p-8 rounded-[2rem] hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/5 transition-all flex flex-col">
                  {/* Status & Hackathon Badge */}
                  <div className="flex items-center justify-between mb-6">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                      team.hackathon ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {team.hackathon?.title || '자유 주제 프로젝트'}
                    </span>
                    <div className="w-8 h-8 bg-yellow-400 rounded-xl flex items-center justify-center text-xs shadow-sm shadow-yellow-200">
                      🤝
                    </div>
                  </div>

                  {/* Team Title */}
                  <h2 className="text-2xl font-bold text-slate-900 mb-4 group-hover:text-blue-600 transition-colors leading-tight line-clamp-1">
                    {team.name}
                  </h2>

                  {/* Team Description - Simplified for modern look */}
                  <p className="text-slate-400 text-sm font-medium leading-relaxed line-clamp-2 mb-8">
                    {team.description || "팀 소개 정보가 없습니다."}
                  </p>

                  {/* Position Info - Bottom Fixed */}
                  <div className="mt-auto pt-6 border-t border-slate-50 flex flex-col gap-1">
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-tighter">
                      Currently Seeking
                    </p>
                    <p className="text-sm font-extrabold text-slate-800">
                      {team.recruiting_positions ? (
                        <span className="text-blue-600">{team.recruiting_positions}</span>
                      ) : (
                        "포지션 무관"
                      )}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-32 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
            <div className="text-4xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">게시글이 없습니다</h3>
            <p className="text-slate-400 font-medium">현재 모집 중인 팀이 없습니다. 직접 팀을 만들어보세요!</p>
            <Link href="/camp" className="inline-block mt-8 px-8 py-3 bg-black text-white rounded-2xl font-bold text-sm hover:bg-blue-600 transition-colors">
              새 팀 만들기
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}