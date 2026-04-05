'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function MyTeamsPage() {
  const { user, isInitialized } = useAuth();
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. 내가 팀장(leader_id)인 팀 조회
      const { data: ledTeams, error: ledError } = await supabase
        .from('hackathon_teams')
        .select(`
          id, 
          name, 
          leader:profiles!leader_id(nickname), 
          hackathon:hackathons(title)
        `)
        .eq('leader_id', user.id);

      if (ledError) throw ledError;

      // 2. 내가 팀원으로 속한 팀 조회
      const { data: memberEntries, error: memberError } = await supabase
        .from('team_members')
        .select(`
          team:hackathon_teams (
            id, 
            name, 
            leader:profiles!leader_id(nickname), 
            hackathon:hackathons(title)
          )
        `)
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      const memberTeams = memberEntries ? memberEntries.map((item: any) => item.team) : [];
      const combined = [...(ledTeams || []), ...memberTeams];
      
      // ID를 기준으로 중복 제거
      const uniqueTeams = combined.filter((team, index, self) =>
        index === self.findIndex((t) => t.id === team.id)
      );

      setMyTeams(uniqueTeams);
    } catch (error) {
      console.error("팀 목록 로드 중 오류 발생:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // 인증 확인이 완료된 시점에만 데이터 페칭 시작
    if (isInitialized) {
      fetchMyTeams();
    }
  }, [isInitialized, fetchMyTeams]);

  /* --- 로딩 가드: 인증 초기화 중이거나 데이터를 불러오는 중일 때 --- */
  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-white">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          Synchronizing Your Workspace...
        </p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          로딩이 오래 걸리면 새로고침을 해 보세요!
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-900 font-sans tracking-tight">
      {/* Hero Header Section */}
      <section className="bg-slate-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 leading-tight">
                My <span className="text-blue-600">Workspaces</span>
              </h1>
              <p className="text-slate-500 font-medium max-w-xl">
                소속된 팀원들과 소통하고 프로젝트를 관리하세요. <br />
                모든 해커톤 참여 정보와 팀 게시판이 여기에 모여있습니다.
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-tighter">Active Teams</span>
              <span className="text-3xl font-black text-blue-600">{myTeams.length}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Team List Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {myTeams.map((team) => (
            <Link key={team.id} href={`/myteams/${team.id}`} className="group">
              <div className="bg-white border border-slate-200 p-8 rounded-[2rem] hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/5 transition-all h-full flex flex-col relative overflow-hidden">
                {/* Accent Line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="mb-6">
                  {team.hackathon ? (
                    <div className="inline-flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-blue-600 rounded-full"></span>
                      <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">
                        {team.hackathon.title}
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        자유 주제 팀
                      </span>
                    </div>
                  )}
                </div>
                
                <h2 className="text-2xl font-bold text-slate-900 mb-8 group-hover:text-blue-600 transition-colors leading-snug flex-1">
                  {team.name}
                </h2>
                
                <div className="pt-6 border-t border-slate-50 flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-sm">
                      👤
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Leader</p>
                      <p className="font-bold text-slate-700 text-sm">{team.leader?.nickname || 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-yellow-400 transition-all duration-300">
                    <span className="text-slate-400 group-hover:text-black font-black">→</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {myTeams.length === 0 && (
            <div className="col-span-full py-32 text-center border border-dashed border-slate-200 rounded-[3rem] bg-slate-50/50">
              <div className="w-20 h-20 bg-white rounded-3xl border border-slate-100 flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm">
                💨
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">소속된 팀이 없습니다</h3>
              <p className="text-slate-400 font-medium mb-10">캠프에서 마음에 드는 팀을 찾아보거나 직접 생성해보세요.</p>
              <Link 
                href="/camp" 
                className="inline-flex items-center px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-blue-600 transition-all shadow-lg shadow-slate-200"
              >
                팀원 모집 바로가기
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}