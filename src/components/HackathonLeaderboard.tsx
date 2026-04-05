'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

interface Props {
  hackathonId: string;
}

export default function HackathonLeaderboard({ hackathonId }: Props) {
  const { user, isInitialized } = useAuth();
  
  // 상태 관리
  const [displayTeams, setDisplayTeams] = useState<any[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboardData = useCallback(async () => {
    if (!user || !hackathonId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. 현재 사용자가 속한 팀 정보 조회 (리더 또는 멤버)
      // 팀장인 경우 우선 확인
      let { data: myTeam } = await supabase
        .from('hackathon_teams')
        .select('id')
        .eq('hackathon_id', hackathonId)
        .eq('leader_id', user.id)
        .single();

      // 만약 팀장이 아니라면 멤버 테이블에서 확인
      if (!myTeam) {
        const { data: memberData } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .single();
        
        if (memberData) {
          const { data: teamInfo } = await supabase
            .from('hackathon_teams')
            .select('id')
            .eq('id', memberData.team_id)
            .eq('hackathon_id', hackathonId)
            .single();
          myTeam = teamInfo;
        }
      }

      const teamId = myTeam?.id;

      if (teamId) {
        // 2. 해당 팀의 제출 여부 확인
        const { data: submission } = await supabase
          .from('hackathon_submissions')
          .select('id')
          .eq('hackathon_id', hackathonId)
          .eq('team_id', teamId)
          .single();
        
        const submitted = !!submission;
        setHasSubmitted(submitted);

        // 3. 제출이 확인된 경우에만 주변 랭킹 데이터 호출
        if (submitted) {
          const { data: allTeams } = await supabase
            .from('hackathon_teams')
            .select(`
              id, 
              name, 
              points, 
              leader_id,
              leader:profiles!leader_id(nickname)
            `)
            .eq('hackathon_id', hackathonId)
            .order('points', { ascending: false });

          if (allTeams) {
            const myIndex = allTeams.findIndex(t => t.id === teamId);
            
            // 내 팀 기준 상하 5팀 계산
            const start = Math.max(0, myIndex - 5);
            const end = Math.min(allTeams.length, myIndex + 6);
            
            const sliced = allTeams.slice(start, end).map((t, idx) => {
              const leaderData = Array.isArray(t.leader) ? t.leader[0] : t.leader;
              return {
                ...t,
                leaderNickname: leaderData?.nickname || 'Unknown',
                actualRank: start + idx + 1
              };
            });
            setDisplayTeams(sliced);
          }
        }
      }
    } catch (error) {
      console.error("Leaderboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [user, hackathonId]);

  useEffect(() => {
    if (isInitialized) {
      fetchLeaderboardData();
    }
  }, [isInitialized, fetchLeaderboardData]);

  // [로딩 가드] 인증 초기화 중이거나 데이터 로딩 중인 경우
  if (!isInitialized || loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Calculating Ranks</p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
      </div>
    );
  }

  // [미제출 가드] 결과물을 제출하지 않은 경우
  if (!hasSubmitted) {
    return (
      <div className="py-16 px-8 bg-slate-50 border border-slate-100 rounded-3xl text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm text-2xl">
          🔒
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">리더보드 접근 제한</h3>
        <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
          결과물을 제출한 팀만 실시간 리더보드를 확인할 수 있습니다.<br />
          Submit 탭에서 프로젝트를 먼저 제출해 주세요.
        </p>
        <div className="inline-block px-6 py-2 bg-blue-600 text-white text-xs font-bold rounded-full">
          제출 후 자동 활성화
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 섹션 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">팀별 실시간 랭킹</h3>
          <p className="text-sm text-slate-400 font-medium mt-1">우리 팀 주변(상하 5팀)의 현재 순위입니다.</p>
        </div>
        <div className="flex items-center gap-2 bg-yellow-50 px-4 py-2 rounded-xl border border-yellow-100">
          <span className="text-yellow-600 text-sm">⚡</span>
          <span className="text-[11px] font-bold text-yellow-700 uppercase tracking-wider">Live Updates</span>
        </div>
      </div>

      {/* 랭킹 테이블 */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-20">Rank</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Team Info</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {displayTeams.map((t) => {
                const isMyTeam = (t.leader_id === user?.id) || (t.id === displayTeams.find(team => team.leader_id === user?.id)?.id);
                
                return (
                  <tr 
                    key={t.id} 
                    className={`group transition-colors ${
                      isMyTeam ? 'bg-yellow-50/50' : 'hover:bg-slate-50/50'
                    }`}
                  >
                    <td className="px-6 py-5">
                      <div className={`text-lg font-black ${
                        isMyTeam ? 'text-blue-600' : 'text-slate-900'
                      }`}>
                        #{t.actualRank}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {t.name}
                          {isMyTeam && <span className="ml-2 text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full uppercase">My Team</span>}
                        </span>
                        <span className="text-xs font-medium text-slate-400 mt-0.5">
                          Leader: {t.leaderNickname}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-lg font-bold text-slate-900 tracking-tight">
                          {t.points.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">Points</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {displayTeams.length === 0 && (
          <div className="py-20 text-center">
            <p className="text-slate-300 font-medium italic">데이터를 불러올 수 없습니다.</p>
          </div>
        )}
      </div>

      {/* 안내 문구 */}
      <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl">
        <span className="text-slate-400 text-sm">💡</span>
        <p className="text-xs text-slate-500 leading-relaxed font-medium">
          해커톤 전체 순위 및 최종 결과는 대회가 완전히 종료된 후 <b>'전체 랭킹'</b> 메뉴에서 확인할 수 있습니다.
          현재 표시는 공정성을 위해 우리 팀 주변의 점수차만 공개합니다.
        </p>
      </div>
    </div>
  );
}