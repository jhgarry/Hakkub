'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function TeamDetailPage() {
  const { user, isInitialized } = useAuth();
  const { slug } = useParams();
  const router = useRouter();
  
  const [team, setTeam] = useState<any>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [isAlreadyJoined, setIsAlreadyJoined] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchDetail = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    
    try {
      // 1. 팀 상세 정보 및 팀장 정보 조회
      const { data, error } = await supabase
        .from('hackathon_teams')
        .select('*, leader:profiles!leader_id(id, nickname, points), hackathon:hackathons(id, title)')
        .eq('id', slug)
        .single();

      if (error) throw error;

      if (data) {
        setTeam(data);
        
        // 2. 로그인 유저인 경우 상태 확인
        if (user) {
          // 이미 합류 신청을 했는지 확인
          const { data: req } = await supabase
            .from('join_requests')
            .select('*')
            .eq('user_id', user.id)
            .eq('team_id', data.id)
            .single();
          setHasApplied(!!req);

          // 이미 이 해커톤에 참여 중인지 확인
          if (data.hackathon_id) {
            const { data: part } = await supabase
              .from('hackathon_participants')
              .select('*')
              .eq('user_id', user.id)
              .eq('hackathon_id', data.hackathon_id)
              .single();
            setIsAlreadyJoined(!!part);
          }
        }
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [slug, user]);

  useEffect(() => {
    if (isInitialized) {
      fetchDetail();
    }
  }, [isInitialized, fetchDetail]);

  const handleApplyToTeam = async () => {
    if (!user) return alert("로그인이 필요합니다.");
    if (user.id === team.leader_id) return alert("본인이 팀장인 팀입니다.");
    if (isAlreadyJoined) return alert("이미 이 해커톤의 다른 팀에 소속되어 있습니다.");
    if (hasApplied) return alert("이미 합류 신청을 보낸 상태입니다.");

    try {
      // 1. 팀장과의 1:1 채팅방 조회 또는 생성
      const { data: roomId } = await supabase.rpc('get_existing_1to1_room', { 
        uid1: user.id, 
        uid2: team.leader_id 
      });

      let targetRoomId = roomId;

      if (!targetRoomId) {
        const { data: newRoom } = await supabase.from('chat_rooms').insert({}).select().single();
        if (newRoom) {
          await supabase.from('chat_participants').insert([
            { room_id: newRoom.id, user_id: user.id },
            { room_id: newRoom.id, user_id: team.leader_id }
          ]);
          targetRoomId = newRoom.id;
        }
      }

      // 2. 채팅 메시지 발송 (메타데이터 포함)
      await supabase.from('chat_messages').insert([{
        room_id: targetRoomId,
        sender_id: user.id,
        content: `👋 [모집 게시판] 안녕하세요! '${team.name}' 팀의 모집 공고를 보고 연락드렸습니다. 팀에 합류하고 싶습니다!`,
        metadata: { 
          type: 'join_request',
          sender_id: user.id,
          sender_nickname: user.nickname,
          sender_points: user.points,
          team_id: team.id,
          team_name: team.name,
          hackathon_id: team.hackathon_id
        }
      }]);

      // 3. 신청 기록 저장
      await supabase.from('join_requests').insert([{
        user_id: user.id,
        team_id: team.id,
        hackathon_id: team.hackathon_id
      }]);

      alert("팀장님에게 합류 신청 메시지가 전송되었습니다! 메일함을 확인해주세요.");
      setHasApplied(true);
    } catch (err) {
      alert("처리 중 오류가 발생했습니다.");
    }
  };

  // 로딩 가드
  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Team Details</p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="max-w-4xl mx-auto p-20 text-center">
        <p className="text-xl font-bold text-slate-400">팀 정보를 찾을 수 없습니다.</p>
        <Link href="/teamboard" className="text-blue-600 underline mt-4 inline-block">목록으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <main className="bg-slate-50 min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* 상단 네비게이션 */}
        <Link 
          href="/teamboard" 
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors mb-8 group"
        >
          <span className="group-hover:-translate-x-1 transition-transform">←</span> BACK TO BOARD
        </Link>

        {/* 메인 카드 컨테이너 */}
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
          
          {/* 헤더 섹션 */}
          <div className="p-10 border-b border-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${team.hackathon ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                {team.hackathon?.title || '자유 주제 팀'}
              </span>
              {team.is_recruiting ? (
                <span className="bg-yellow-400 text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Recruiting</span>
              ) : (
                <span className="bg-slate-200 text-slate-500 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Closed</span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
              {team.name}
            </h1>
            <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-2xl">
              {team.description}
            </p>
          </div>

          <div className="p-10 space-y-12">
            {/* 정보 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* 팀장 정보 */}
              <div className="flex items-center gap-5 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-3xl shadow-sm">
                  👤
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Team Leader</p>
                  <h3 className="text-xl font-bold text-slate-900">{team.leader?.nickname}</h3>
                  <p className="text-sm font-bold text-blue-600">{team.leader?.points.toLocaleString()} pts</p>
                </div>
              </div>

              {/* 모집 포지션 */}
              <div className="flex flex-col justify-center p-6 border border-slate-100 rounded-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Seeking Positions</p>
                <p className="text-xl font-bold text-slate-800">
                  {team.recruiting_positions || '포지션 제한 없음'}
                </p>
              </div>
            </div>

            {/* 연락 방법 섹션 */}
            <div className="space-y-4">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Contact Information</h4>
              <div className="p-6 bg-slate-900 rounded-2xl text-white font-mono text-lg break-all flex items-center justify-between">
                <span>{team.contact_link || '정보가 비공개로 설정되어 있습니다.'}</span>
                <span className="text-yellow-400 text-xs font-black uppercase">Official</span>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="pt-6">
              {user?.id === team.leader_id ? (
                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-center">
                  <p className="text-blue-600 font-bold">당신이 관리하는 팀입니다. 수정은 캠프 페이지에서 가능합니다.</p>
                </div>
              ) : (
                <button 
                  onClick={handleApplyToTeam}
                  disabled={hasApplied || isAlreadyJoined || !team.is_recruiting}
                  className={`w-full py-6 rounded-2xl font-black text-xl transition-all ${
                    hasApplied || isAlreadyJoined || !team.is_recruiting
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/20 active:scale-[0.98]'
                  }`}
                >
                  {isAlreadyJoined 
                    ? '이미 참여 중인 해커톤입니다' 
                    : !team.is_recruiting 
                    ? '모집이 마감된 팀입니다'
                    : hasApplied 
                    ? '합류 신청 완료' 
                    : '🚀 팀 합류 신청하기'
                  }
                </button>
              )}
              <p className="text-center text-xs text-slate-400 font-medium mt-4 italic">
                * 신청 시 팀장과의 1:1 대화방이 생성되며 프로필 정보가 공유됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}