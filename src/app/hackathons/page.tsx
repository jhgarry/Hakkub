'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import HackathonCard from '@/components/HackathonCard';

export default function HackathonListPage() {
  // 1. 인증 초기화 상태 가져오기 (로딩 문제 해결의 핵심)
  const { isInitialized } = useAuth();
  
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 필터 상태
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTag, setSelectedTag] = useState('');

  // 2. 데이터 페칭 로직 (useEffect 외부로 분리 및 useCallback 처리)
  const fetchHackathons = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('hackathons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setHackathons(data);
    } catch (err) {
      console.error("데이터 로드 실패:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 3. 인증 확인이 완료된 시점에만 데이터 호출
  useEffect(() => {
    if (isInitialized) {
      fetchHackathons();
    }
  }, [isInitialized, fetchHackathons]);

  // 4. 필터링 로직 (Memoization을 통해 성능 최적화)
  const availableTags = useMemo(() => {
    return Array.from(new Set(hackathons.flatMap((h) => h.tags || []))).sort();
  }, [hackathons]);

  const filteredHackathons = useMemo(() => {
    return hackathons.filter((h) => {
      const matchStatus = statusFilter === 'all' || h.status === statusFilter;
      const matchTag = selectedTag === '' || (h.tags && h.tags.includes(selectedTag));
      return matchStatus && matchTag;
    });
  }, [hackathons, statusFilter, selectedTag]);

  // 5. 로딩 가드 (데이터가 준비되기 전 본문 렌더링 차단)
  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          Searching Competitions...
        </p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">
          로딩이 오래 걸리면 새로고침을 해 보세요!
        </p>
      </div>
    );
  }

  return (
    <main className="bg-white min-h-screen text-slate-900">
      {/* Hero Section */}
      <section className="bg-slate-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
            Discover <span className="text-blue-600">Hackathons</span>
          </h1>
          <p className="text-slate-500 font-medium max-w-2xl leading-relaxed">
            당신의 기술력을 증명할 새로운 도전을 찾아보세요. <br />
            분야별 해커톤을 필터링하고 당신에게 맞는 팀을 꾸릴 수 있습니다.
          </p>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* 필터 바 (Modern & Clean) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
          <div className="flex flex-wrap items-center gap-4">
            {/* 상태 필터 */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
              {['all', '진행중', '예정', '종료됨'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
                    statusFilter === status 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {status === 'all' ? '전체' : status}
                </button>
              ))}
            </div>

            {/* 태그 필터 (Pill 형태) */}
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(selectedTag === tag ? '' : tag)}
                  className={`px-4 py-2 rounded-full text-[11px] font-extrabold uppercase tracking-tight border transition-all ${
                    selectedTag === tag
                      ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  #{tag}
                </button>
              ))}
              {selectedTag && (
                <button 
                  onClick={() => setSelectedTag('')}
                  className="px-2 py-2 text-[11px] font-bold text-slate-400 hover:text-red-500 transition-colors"
                >
                  Reset ✕
                </button>
              )}
            </div>
          </div>

          <div className="text-sm font-bold text-slate-400">
            검색 결과 <span className="text-slate-900">{filteredHackathons.length}</span>건
          </div>
        </div>

        {/* 해커톤 리스트 그리드 */}
        {filteredHackathons.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
            {filteredHackathons.map((h) => (
              <div key={h.id} className="group">
                <HackathonCard 
                  slug={h.slug}
                  title={h.title}
                  status={h.status}
                  tags={h.tags}
                  startDate={h.start_date}
                  endDate={h.end_date}
                  participants={h.participant_count}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="py-32 text-center bg-slate-50 rounded-[2rem] border border-slate-100">
            <span className="text-4xl mb-4 block">🔍</span>
            <h3 className="text-lg font-bold text-slate-900">일치하는 해커톤이 없습니다</h3>
            <p className="text-slate-400 text-sm mt-1">다른 필터 조건을 선택해보세요.</p>
            <button 
              onClick={() => { setStatusFilter('all'); setSelectedTag(''); }}
              className="mt-6 text-sm font-bold text-blue-600 hover:underline"
            >
              필터 초기화하기
            </button>
          </div>
        )}
      </div>
    </main>
  );
}