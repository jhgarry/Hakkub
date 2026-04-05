'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function RankingsPage() {
  const { user, isInitialized } = useAuth();
  
  // 상태 관리
  const [view, setView] = useState<'individual' | 'hackathon'>('individual');
  const [loading, setLoading] = useState(true);
  
  // 개인 랭킹 상태
  const [individualRanks, setIndividualRanks] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState(0); 
  const [myMessage, setMyMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // 해커톤 팀 랭킹 상태
  const [myParticipatingHackathons, setMyParticipatingHackathons] = useState<any[]>([]);
  const [selectedHackathon, setSelectedHackathon] = useState<any>(null);
  const [teamRanks, setTeamRanks] = useState<any[]>([]);
  const [isTeamLoading, setIsTeamLoading] = useState(false);

  /* -------------------------------------------------------------------------- */
  /* 1. 데이터 페칭 로직                                                           */
  /* -------------------------------------------------------------------------- */
  
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    try {
      // 개인 랭킹 가져오기
      const { data: userData } = await supabase
        .from('profiles')
        .select('id, nickname, points, rank_message')
        .order('points', { ascending: false });

      if (userData) {
        setIndividualRanks(userData);
        const myData = userData.find(r => r.id === user?.id);
        if (myData) setMyMessage(myData.rank_message || '');
      }

      // 참여 중인 해커톤 가져오기
      if (user) {
        const { data: hData } = await supabase
          .from('hackathon_participants')
          .select('hackathons(id, title, slug)')
          .eq('user_id', user.id);
        if (hData) setMyParticipatingHackathons(hData.map((i: any) => i.hackathons));
      }
    } catch (error) {
      console.error("Rankings load error:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchTeamRanks = async (hackathon: any) => {
    setSelectedHackathon(hackathon);
    setIsTeamLoading(true);

    try {
      const { data: teamsData } = await supabase
        .from('hackathon_teams')
        .select(`id, name, points, leader_id, leader:profiles!leader_id(nickname)`)
        .eq('hackathon_id', hackathon.id);

      const { data: submissionsData } = await supabase
        .from('hackathon_submissions')
        .select('team_id')
        .eq('hackathon_id', hackathon.id);

      const submittedTeamIds = new Set(submissionsData?.map(s => s.team_id));

      if (teamsData) {
        const processed = teamsData.map(team => ({
          ...team,
          isSubmitted: submittedTeamIds.has(team.id)
        })).sort((a, b) => {
          if (a.isSubmitted !== b.isSubmitted) return a.isSubmitted ? -1 : 1;
          return b.points - a.points;
        });
        setTeamRanks(processed);
      }
    } catch (error) {
      console.error("Team ranking load error:", error);
    } finally {
      setIsTeamLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized) fetchInitialData();
  }, [isInitialized, fetchInitialData]);

  const updateMyMessage = async () => {
    if (!user) return;
    setIsUpdating(true);
    const { error } = await supabase
      .from('profiles')
      .update({ rank_message: myMessage })
      .eq('id', user.id);
    
    if (!error) {
      alert("메시지가 저장되었습니다.");
      fetchInitialData();
    }
    setIsUpdating(false);
  };

  /* -------------------------------------------------------------------------- */
  /* 2. 로딩 가드                                                                */
  /* -------------------------------------------------------------------------- */
  
  if (!isInitialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">Calculating Standings</p>
          <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
        </div>
      </div>
    );
  }

  return (
    <main className="bg-white min-h-screen text-slate-900 pb-20">
      {/* Header Section */}
      <section className="bg-slate-50 border-b border-slate-100 py-16 mb-12">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">명예의 전당</h1>
          <p className="text-slate-500 font-medium text-lg">최고의 실력을 증명한 챌린저들과 팀을 확인하세요.</p>
          
          {/* View Switcher (Tabs) */}
          <div className="flex bg-slate-200/50 p-1 rounded-xl w-fit mt-10">
            <button 
              onClick={() => setView('individual')}
              className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-all ${
                view === 'individual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              개인 포인트 랭킹
            </button>
            <button 
              onClick={() => setView('hackathon')}
              className={`px-8 py-2.5 rounded-lg text-sm font-bold transition-all ${
                view === 'hackathon' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              해커톤 팀 랭킹
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6">
        
        {/* --- [1] INDIVIDUAL RANKING VIEW --- */}
        {view === 'individual' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 mb-8">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Global Top Rankings</span>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                {[
                  { l: '전체', v: 0 },
                  { l: '7일', v: 7 },
                  { l: '30일', v: 30 }
                ].map(p => (
                  <button 
                    key={p.v}
                    onClick={() => setDateFilter(p.v)}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                      dateFilter === p.v ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {p.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-24">Rank</th>
                    <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">User</th>
                    <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status Message</th>
                    <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {individualRanks.map((player, idx) => {
                    const isMe = player.id === user?.id;
                    const isTop3 = idx < 3;
                    return (
                      <tr key={player.id} className={`transition-colors ${isMe ? 'bg-blue-50/30' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-8 py-6">
                          <span className={`text-lg font-black ${
                            idx === 0 ? 'text-yellow-500' : isTop3 ? 'text-blue-600' : 'text-slate-300'
                          }`}>
                            {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                          </span>
                        </td>
                        <td className="px-8 py-6 font-bold text-slate-900">{player.nickname}</td>
                        <td className="px-8 py-6">
                          {isMe ? (
                            <div className="flex gap-2 max-w-md">
                              <input 
                                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium outline-none focus:ring-2 ring-blue-500/20 transition-all"
                                value={myMessage}
                                onChange={(e) => setMyMessage(e.target.value)}
                                placeholder="나만의 한 줄 메시지..."
                              />
                              <button 
                                onClick={updateMyMessage} 
                                disabled={isUpdating}
                                className="bg-blue-600 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
                              >
                                저장
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500 font-medium">{player.rank_message || '-'}</span>
                          )}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <span className="text-lg font-extrabold text-blue-600">{player.points.toLocaleString()}</span>
                          <span className="ml-1 text-[10px] font-bold text-slate-400 uppercase">pts</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- [2] HACKATHON TEAM RANKING VIEW --- */}
        {view === 'hackathon' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
            {/* Hackathon Select Chips */}
            <div className="space-y-4">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-1">My Participations</span>
              <div className="flex flex-wrap gap-3">
                {myParticipatingHackathons.map((h) => (
                  <button 
                    key={h.id}
                    onClick={() => fetchTeamRanks(h)}
                    className={`px-6 py-4 rounded-2xl border-2 font-bold text-sm transition-all ${
                      selectedHackathon?.id === h.id 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {h.title}
                  </button>
                ))}
                {myParticipatingHackathons.length === 0 && (
                  <div className="py-8 px-10 rounded-2xl border-2 border-dashed border-slate-100 text-slate-400 font-medium w-full text-center">
                    현재 참여 중인 해커톤이 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* Team Ranking Table */}
            {selectedHackathon && (
              <div className="animate-in fade-in duration-500">
                <div className="flex items-center gap-3 mb-8">
                  <h2 className="text-2xl font-bold text-slate-900">{selectedHackathon.title}</h2>
                  <span className="bg-yellow-400 text-[10px] font-black px-2 py-0.5 rounded-md uppercase">Live Ranking</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest w-24">Rank</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Team Name</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Leader</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-8 py-5 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right">Team Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {teamRanks.map((team, idx) => {
                        const leaderNickname = Array.isArray(team.leader) ? team.leader[0]?.nickname : team.leader?.nickname;
                        return (
                          <tr key={team.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-6">
                              <span className={`text-lg font-black ${team.isSubmitted ? 'text-blue-600' : 'text-slate-200'}`}>
                                {team.isSubmitted ? (idx + 1 < 10 ? `0${idx + 1}` : idx + 1) : '-'}
                              </span>
                            </td>
                            <td className="px-8 py-6 font-bold text-slate-900">{team.name}</td>
                            <td className="px-8 py-6 text-sm font-medium text-slate-500">{leaderNickname || 'Unknown'}</td>
                            <td className="px-8 py-6">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                team.isSubmitted ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                              }`}>
                                <span className={`w-1 h-1 rounded-full ${team.isSubmitted ? 'bg-green-600' : 'bg-red-500'}`}></span>
                                {team.isSubmitted ? 'Submitted' : 'Missing'}
                              </span>
                            </td>
                            <td className="px-8 py-6 text-right font-extrabold text-blue-600">
                              {team.points.toLocaleString()} pts
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {teamRanks.length === 0 && (
                    <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">No teams found.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}