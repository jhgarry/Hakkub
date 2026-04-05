'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function MainPage() {
  const { user, isInitialized } = useAuth();
  
  const [popularHackathons, setPopularHackathons] = useState<any[]>([]);
  const [teamAds, setTeamAds] = useState<any[]>([]);
  const [topRankers, setTopRankers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMainData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. 인기 해커톤 (가독성을 위해 핵심 정보만 추출)
      const { data: hData } = await supabase
        .from('hackathons')
        .select('id, title, slug, start_date, end_date, participant_count')
        .order('participant_count', { ascending: false })
        .limit(3);
      if (hData) setPopularHackathons(hData);

      // 2. 랭킹 상위 5인 (간결한 프로필 형태)
      const { data: rData } = await supabase
        .from('profiles')
        .select('id, nickname, points')
        .order('points', { ascending: false })
        .limit(5);
      if (rData) setTopRankers(rData);

      // 3. 팀 모집 공고 (찜한 해커톤 우선순위 로직 유지)
      let finalTeams: any[] = [];
      if (user) {
        const { data: wishData } = await supabase
          .from('hackathon_wishlist')
          .select('hackathon_id')
          .eq('user_id', user.id);
        const wishIds = wishData?.map(w => w.hackathon_id) || [];

        if (wishIds.length > 0) {
          const { data: priorityTeams } = await supabase
            .from('hackathon_teams')
            .select('id, name, description, recruiting_positions, hackathons(title)')
            .in('hackathon_id', wishIds)
            .eq('is_recruiting', true)
            .limit(6);
          if (priorityTeams) finalTeams = [...priorityTeams];
        }
      }

      if (finalTeams.length < 6) {
        const { data: randomTeams } = await supabase
          .from('hackathon_teams')
          .select('id, name, description, recruiting_positions, hackathons(title)')
          .eq('is_recruiting', true)
          .limit(10);
        const filteredRandom = randomTeams?.filter(rt => !finalTeams.find(ft => ft.id === rt.id)) || [];
        finalTeams = [...finalTeams, ...filteredRandom].slice(0, 6);
      }
      setTeamAds(finalTeams);

    } catch (error) {
      console.error("Data load error:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isInitialized) fetchMainData();
  }, [isInitialized, fetchMainData]);

  if (!isInitialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-400 tracking-widest uppercase">Loading Hub</p>
          <p className="text-sm font-medium text-slate-400 tracking-widest uppercase">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
        </div>
      </div>
    );
  }

  return (
    <main className="bg-white min-h-screen text-slate-900 font-sans tracking-tight">
      {/* Hero Section */}
      <section className="bg-slate-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
          <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 mb-6 leading-[1.1]">
            Build the future,<br />
            <span className="text-blue-600">Join the Hackathon.</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-2xl font-medium leading-relaxed">
            해껍은 혁신적인 아이디어를 가진 개발자들을 연결합니다.<br />
            지금 바로 해커톤에 참여하고 최고의 팀을 만나보세요.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-16 flex flex-col lg:flex-row gap-16">
        
        {/* Main Content Area */}
        <div className="flex-1 space-y-24">
          
          {/* 1. Quick Navigation Cards */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { t: '해커톤 탐색', d: '진행 중인 모든 대회 보기', l: '/hackathons', icon: '🏆', color: 'blue' },
              { t: '팀원 모집', d: '나와 맞는 동료 찾기', l: '/camp', icon: '🤝', color: 'yellow' },
              { t: '랭킹 확인', d: '최고의 챌린저 순위', l: '/rankings', icon: '⚡', color: 'black' },
            ].map((s) => (
              <Link key={s.l} href={s.l} className="group bg-white border border-slate-200 p-8 rounded-2xl hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all">
                <div className={`w-12 h-12 flex items-center justify-center rounded-xl mb-6 text-2xl transition-transform group-hover:scale-110 ${
                  s.color === 'blue' ? 'bg-blue-50' : s.color === 'yellow' ? 'bg-yellow-50' : 'bg-slate-50'
                }`}>
                  {s.icon}
                </div>
                <h2 className="text-xl font-bold mb-2 group-hover:text-blue-600">{s.t}</h2>
                <p className="text-sm text-slate-400 font-medium">{s.d}</p>
              </Link>
            ))}
          </section>

          {/* 2. Popular Hackathons (Blue & White) */}
          <section>
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">인기 해커톤</h2>
                <p className="text-sm text-slate-400 mt-1 font-medium">가장 많은 관심을 받고 있는 프로젝트</p>
              </div>
              <Link href="/hackathons" className="text-sm font-bold text-blue-600 hover:underline">전체보기 →</Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {popularHackathons.map((h) => (
                <Link key={h.id} href={`/hackathons/${h.slug}`} className="group block border border-slate-100 bg-white p-6 rounded-2xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-blue-600 w-1.5 h-1.5 rounded-full"></span>
                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">{h.participant_count} Members</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-8 group-hover:text-blue-600 line-clamp-2 min-h-[3.5rem]">{h.title}</h3>
                  <div className="text-[12px] font-medium text-slate-400">
                    {h.start_date} - {h.end_date}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* 3. Featured Recruiting (Yellow Accent) */}
          <section>
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">팀원 모집 공고</h2>
                <p className="text-sm text-slate-400 mt-1 font-medium">당신을 기다리고 있는 팀원들을 확인하세요</p>
              </div>
              <Link href="/teamboard" className="text-sm font-bold text-blue-600 hover:underline">공고 더보기 →</Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamAds.map((t) => (
                <Link key={t.id} href={`/teamboard/${t.id}`} className="bg-white border border-slate-100 p-6 rounded-2xl hover:border-yellow-400 hover:shadow-lg transition-all h-full flex flex-col">
                  <span className="text-[10px] font-black bg-yellow-400 text-black px-2 py-0.5 rounded-md self-start mb-4">
                    {t.hackathons?.title || '자유 주제'}
                  </span>
                  <h3 className="text-lg font-bold text-slate-800 mb-2 truncate">{t.name}</h3>
                  <p className="text-sm text-slate-400 mb-6 line-clamp-2 font-medium">{t.description}</p>
                  <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">Looking for</span>
                    <span className="text-[11px] font-extrabold text-blue-600">{t.recruiting_positions || 'All Roles'}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* 4. Sidebar (Personal Rankings) */}
        <aside className="lg:w-80">
          <div className="sticky top-24">
            <div className="bg-slate-900 text-white rounded-3xl p-8 overflow-hidden relative">
              {/* Background Accent */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-600 rounded-full blur-3xl opacity-20"></div>
              
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-bold tracking-tight">Top Challengers</h3>
                <span className="text-yellow-400 text-xl">🏆</span>
              </div>
              
              <div className="space-y-6 relative z-10">
                {topRankers.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-4 group cursor-default">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                      idx === 0 ? 'bg-yellow-400 text-black' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{r.nickname}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{r.points.toLocaleString()} pts</p>
                    </div>
                    {idx === 0 && <span className="text-[10px] font-black text-yellow-400 animate-pulse">HOT</span>}
                  </div>
                ))}
              </div>

              <Link href="/rankings" className="mt-12 block w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-center text-xs font-bold transition-all uppercase tracking-widest">
                Full Rankings
              </Link>
            </div>

            {/* Sub-info in sidebar */}
            <div className="mt-6 p-8 bg-blue-600 rounded-3xl text-white">
              <h4 className="font-bold mb-2">Create your own team</h4>
              <p className="text-xs text-blue-100 leading-relaxed mb-6 font-medium">팀장이 되어 최고의 프로젝트를 이끌어보세요.</p>
              <Link href="/camp" className="inline-block text-xs font-black bg-black px-4 py-2 rounded-lg">Get Started</Link>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}