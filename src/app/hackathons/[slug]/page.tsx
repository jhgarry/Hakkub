'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import HackathonTeams from '@/components/HackathonTeams';
import HackathonSubmit from '@/components/HackathonSubmit';
import HackathonLeaderboard from '@/components/HackathonLeaderboard';
import Link from 'next/link';

export default function HackathonDetailPage() {
  const { slug } = useParams();
  const { user, isInitialized } = useAuth();
  
  // 데이터 상태
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [isWishlisted, setIsWishlisted] = useState(false);
  
  // 로딩 상태 (초기값 true)
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!slug) return;
    setLoading(true);

    try {
      // 1. 해커톤 기본 정보 로드
      const { data: hData, error } = await supabase
        .from('hackathons')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;

      if (hData) {
        // 2. 자동 상태 업데이트 (종료일 확인)
        const isEndedDate = new Date(hData.end_date) < new Date();
        let currentStatus = hData.status;

        if (isEndedDate && hData.status !== '종료됨') {
          await supabase.from('hackathons').update({ status: '종료됨' }).eq('id', hData.id);
          currentStatus = '종료됨';
        }

        setData({ ...hData, status: currentStatus });

        // 3. 찜하기 상태 확인
        if (user) {
          const { data: wData } = await supabase
            .from('hackathon_wishlist')
            .select('*')
            .eq('user_id', user.id)
            .eq('hackathon_id', hData.id)
            .single();
          setIsWishlisted(!!wData);
        }
      }
    } catch (err) {
      console.error("Failed to fetch hackathon detail:", err);
    } finally {
      setLoading(false);
    }
  }, [slug, user]);

  useEffect(() => {
    // 인증 시스템 초기화 완료 후 데이터 로드
    if (isInitialized) {
      fetchDetail();
    }
  }, [isInitialized, fetchDetail]);

  const handleWishlist = async () => {
    if (!user) return alert("로그인이 필요한 기능입니다.");
    if (!data) return;

    try {
      if (isWishlisted) {
        await supabase.from('hackathon_wishlist').delete().eq('user_id', user.id).eq('hackathon_id', data.id);
        const nextCount = Math.max(0, data.participant_count - 1);
        await supabase.from('hackathons').update({ participant_count: nextCount }).eq('id', data.id);
        setData({ ...data, participant_count: nextCount });
        setIsWishlisted(false);
      } else {
        await supabase.from('hackathon_wishlist').insert([{ user_id: user.id, hackathon_id: data.id }]);
        const nextCount = data.participant_count + 1;
        await supabase.from('hackathons').update({ participant_count: nextCount }).eq('id', data.id);
        setData({ ...data, participant_count: nextCount });
        setIsWishlisted(true);
      }
    } catch (err) {
      alert("찜하기 처리 중 오류가 발생했습니다.");
    }
  };

  /* --- 로딩 가드 --- */
  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Hackathon...</p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto p-20 text-center">
        <h2 className="text-2xl font-bold text-slate-900">해커톤을 찾을 수 없습니다.</h2>
        <Link href="/hackathons" className="mt-4 inline-block text-blue-600 font-bold hover:underline">목록으로 돌아가기</Link>
      </div>
    );
  }

  const isEnded = data.status === '종료됨';
  const tabs = ["Overview", "Evaluation", "Schedule", "Prize", "Teams", "Submit", "Leaderboard"];

  return (
    <main className="bg-white min-h-screen pb-20">
      {/* Header Section */}
      <header className="bg-slate-50 border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider ${
                  isEnded ? 'bg-slate-200 text-slate-500' : 'bg-blue-600 text-white'
                }`}>
                  {data.status}
                </span>
                <span className="text-sm font-bold text-slate-400 italic">
                  🔥 {data.participant_count}명의 챌린저가 찜했습니다
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                {data.title}
              </h1>
              <div className="flex items-center gap-4 text-slate-500 font-semibold text-sm">
                <span className="flex items-center gap-1.5">📅 {data.start_date} ~ {data.end_date}</span>
              </div>
            </div>

            <button 
              onClick={handleWishlist}
              className={`px-8 py-4 rounded-2xl font-black text-lg transition-all flex items-center gap-2 shadow-sm ${
                isWishlisted 
                  ? 'bg-yellow-400 text-black hover:bg-yellow-500' 
                  : 'bg-white border border-slate-200 text-slate-900 hover:border-blue-600 hover:text-blue-600'
              }`}
            >
              {isWishlisted ? '✅ 찜한 해커톤' : '⭐️ 찜하기'}
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="sticky top-16 bg-white/80 backdrop-blur-md border-b border-slate-100 z-40">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-1 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-5 text-sm font-bold whitespace-nowrap transition-all border-b-2 ${
                  activeTab === tab 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <article className="max-w-6xl mx-auto px-6 mt-12">
        <div className="bg-white border border-slate-100 rounded-3xl p-8 md:p-12 shadow-sm min-h-[500px]">
          
          {/* Content by Tabs */}
          {activeTab === 'Overview' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> 대회 개요
              </h2>
              <div className="text-lg text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                {data.overview || "등록된 개요 정보가 없습니다."}
              </div>
            </div>
          )}

          {activeTab === 'Evaluation' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> 평가 방식
              </h2>
              <div className="text-lg text-slate-600 leading-relaxed font-medium">
                {data.evaluation || "평가 방식이 공지되지 않았습니다."}
              </div>
            </div>
          )}

          {activeTab === 'Schedule' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> 상세 일정
              </h2>
              <div className="text-lg text-slate-600 leading-relaxed font-medium">
                {data.schedule || "일정 정보가 없습니다."}
              </div>
            </div>
          )}

          {activeTab === 'Prize' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span> 상금 및 혜택
              </h2>
              <div className="text-lg text-slate-600 leading-relaxed font-medium italic">
                {data.prize || "상금 정보가 없습니다."}
              </div>
            </div>
          )}

          {activeTab === 'Teams' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <HackathonTeams 
                hackathonId={data.id} 
                hackathonTitle={data.title} 
                isEnded={isEnded} 
              />
            </div>
          )}

          {activeTab === 'Submit' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <HackathonSubmit 
                hackathonId={data.id} 
                isEnded={isEnded} 
              />
            </div>
          )}

          {activeTab === 'Leaderboard' && (
            <div className="animate-in fade-in slide-in-from-bottom-2">
              <HackathonLeaderboard 
                hackathonId={data.id} 
              />
            </div>
          )}
        </div>
      </article>
    </main>
  );
}