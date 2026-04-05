'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function PublicProfilePage() {
  const { slug } = useParams(); // 유저의 ID
  const { user: currentUser, isInitialized } = useAuth();
  
  const [profile, setProfile] = useState<any>(null);
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPublicData = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    
    try {
      // 1. 프로필 정보 조회
      const { data: pData } = await supabase
        .from('profiles')
        .select('id, nickname, points')
        .eq('id', slug)
        .single();

      if (pData) {
        setProfile(pData);
        
        // 2. 참여 해커톤 정보 조회
        const { data: hData } = await supabase
          .from('hackathon_participants')
          .select('hackathons(title, slug)')
          .eq('user_id', slug);
        if (hData) setHackathons(hData.map(d => d.hackathons));

        // 3. 친구 여부 확인
        if (currentUser) {
          const { data: fData } = await supabase
            .from('friends')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('friend_id', slug)
            .single();
          setIsFriend(!!fData);
        }
      }
    } catch (error) {
      console.error("Public profile load error:", error);
    } finally {
      setLoading(false);
    }
  }, [slug, currentUser]);

  useEffect(() => {
    if (isInitialized) {
      fetchPublicData();
    }
  }, [isInitialized, fetchPublicData]);

  /* --- 로딩 가드: 인증 초기화 및 데이터 로딩 중일 때 --- */
  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 bg-white">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Searching Profile</p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] bg-white">
        <p className="text-xl font-bold text-slate-900">사용자를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const handleAddFriend = async () => {
    if (!currentUser) return alert("로그인이 필요합니다.");
    if (currentUser.id === slug) return alert("자기 자신은 친구로 추가할 수 없습니다.");

    const { error } = await supabase
      .from('friends')
      .insert([{ user_id: currentUser.id, friend_id: slug }]);

    if (error) {
      alert("이미 친구이거나 오류가 발생했습니다.");
    } else {
      alert(`${profile.nickname}님이 친구 목록에 추가되었습니다!`);
      setIsFriend(true);
    }
  };


  return (
    <main className="bg-white min-h-screen">
      {/* 상단 배경 장식 */}
      <div className="h-32 bg-slate-50 border-b border-slate-100"></div>

      <div className="max-w-4xl mx-auto px-6 -mt-16">
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-slate-200/40 relative">
          
          {/* 프로필 헤더 섹션 */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16">
            <div className="flex items-center gap-8">
              {/* 아바타 (노랑 포인트) */}
              <div className="w-28 h-28 bg-yellow-400 rounded-[2rem] flex items-center justify-center text-4xl shadow-lg shadow-yellow-200">
                👤
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[11px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                    Hacker Profile
                  </span>
                  {isFriend && (
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      • Connection
                    </span>
                  )}
                </div>
                <h1 className="text-5xl font-extrabold text-slate-900 tracking-tighter">
                  {profile.nickname}
                </h1>
                <p className="text-slate-400 font-medium mt-2 flex items-center gap-2">
                  <span className="text-blue-600">⚡</span> 누적 포인트 {profile.points.toLocaleString()} P
                </p>
              </div>
            </div>

            {/* 친구 추가 액션 버튼 (파랑 포인트) */}
            <button 
              onClick={handleAddFriend}
              disabled={isFriend || currentUser?.id === slug}
              className={`px-10 py-4 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${
                isFriend 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-slate-900 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-200 active:scale-95'
              }`}
            >
              {isFriend ? '이미 친구입니다' : (
                <>
                  <span className="text-lg">➕</span>
                  친구 추가하기
                </>
              )}
            </button>
          </div>

          {/* 활동 내역 섹션 (가독성 중심) */}
          <section>
            <div className="flex items-center gap-3 mb-8">
              <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">Participated Hackathons</h2>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hackathons.map((h, idx) => (
                <div 
                  key={idx} 
                  className="group p-6 border border-slate-100 bg-slate-50/50 rounded-2xl flex items-center justify-between hover:bg-white hover:border-blue-500 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center border border-slate-200 text-lg group-hover:scale-110 transition-transform">
                      🏆
                    </div>
                    <span className="font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                      {h.title}
                    </span>
                  </div>
                  <span className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    →
                  </span>
                </div>
              ))}
              
              {hackathons.length === 0 && (
                <div className="col-span-full py-16 text-center border border-dashed border-slate-200 rounded-3xl">
                  <p className="text-slate-400 font-medium">아직 참여한 해커톤 내역이 없습니다.</p>
                </div>
              )}
            </div>
          </section>
        </div>
        
        {/* 하단 푸터 링크 */}
        <div className="mt-12 text-center pb-20">
          <button 
            onClick={() => window.history.back()}
            className="text-sm font-bold text-slate-400 hover:text-slate-900 transition-colors"
          >
            ← 이전 페이지로 돌아가기
          </button>
        </div>
      </div>
    </main>
  );
}