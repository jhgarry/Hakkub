'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function CreateTeamForm() {
  const { user, isInitialized } = useAuth();
  const router = useRouter();

  // 폼 데이터 상태
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_recruiting: true,
    recruiting_positions: '',
    contact_link: ''
  });

  // 로딩 및 제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. 인증 초기화 가드
  // 인증 정보가 확인될 때까지 폼 작성을 대기시킵니다.
  if (!isInitialized) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Initialising Form</p>
      </div>
    );
  }

  // 2. 비로그인 유저 접근 제어
  if (!user) {
    return (
      <div className="bg-white border border-slate-100 rounded-3xl p-10 shadow-sm text-center">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">로그인이 필요합니다</h3>
        <p className="text-sm text-slate-400 mb-6 font-medium">팀을 만들기 위해 먼저 로그인해주세요.</p>
        <button 
          onClick={() => router.push('/login')}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all"
        >
          로그인 페이지로 이동
        </button>
      </div>
    );
  }

  // 3. 팀 생성 로직 (DB 트랜잭션 시뮬레이션)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.description.trim()) {
      return alert("필수 정보를 모두 입력해주세요.");
    }

    setIsSubmitting(true);

    try {
      // Step A: 전용 채팅방 생성
      const { data: room, error: roomErr } = await supabase
        .from('chat_rooms')
        .insert({})
        .select()
        .single();
      if (roomErr) throw roomErr;

      // Step B: 팀 생성 (채팅방 ID 연결)
      const { data: team, error: teamErr } = await supabase
        .from('hackathon_teams')
        .insert([{
          name: formData.name,
          description: formData.description,
          is_recruiting: formData.is_recruiting,
          recruiting_positions: formData.recruiting_positions,
          contact_link: formData.contact_link,
          leader_id: user.id,
          chat_room_id: room.id
        }])
        .select()
        .single();
      if (teamErr) throw teamErr;

      // Step C: team_members에 팀장 등록
      const { error: memberErr } = await supabase
        .from('team_members')
        .insert([{
          team_id: team.id,
          user_id: user.id,
          role: '팀장'
        }]);
      if (memberErr) throw memberErr;

      // Step D: 채팅방 참여자로 등록
      await supabase.from('chat_participants').insert([{
        room_id: room.id,
        user_id: user.id
      }]);

      alert("🎉 새로운 팀이 생성되었습니다!");
      router.push('/myteams'); // 생성 후 마이팀 페이지로 이동

    } catch (error: any) {
      console.error(error);
      alert("팀 생성 중 오류가 발생했습니다: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-slate-200/50 sticky top-24">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-xl shadow-sm shadow-yellow-200">
          🚀
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">팀 만들기</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 팀명 입력 */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Team Name *</label>
          <input 
            type="text" 
            required
            disabled={isSubmitting}
            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-600 transition-all outline-none"
            placeholder="창의적인 팀 이름을 입력하세요"
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>

        {/* 소개 입력 */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Description *</label>
          <textarea 
            required
            rows={4}
            disabled={isSubmitting}
            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-medium placeholder:text-slate-300 focus:ring-2 focus:ring-blue-600 transition-all outline-none resize-none leading-relaxed"
            placeholder="팀의 목표와 분위기를 팀원들에게 알려주세요"
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
        </div>

        {/* 모집 여부 체크 */}
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="relative flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              id="recruiting-form" 
              checked={formData.is_recruiting}
              disabled={isSubmitting}
              className="w-6 h-6 rounded-lg border-2 border-slate-200 checked:bg-blue-600 checked:border-blue-600 transition-all cursor-pointer appearance-none"
              onChange={(e) => setFormData({...formData, is_recruiting: e.target.checked})}
            />
            {formData.is_recruiting && <span className="absolute left-1.5 text-white text-xs font-bold pointer-events-none">✓</span>}
          </div>
          <label htmlFor="recruiting-form" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
            지금 바로 팀원 모집을 시작합니다
          </label>
        </div>

        {/* 포지션 입력 (선택) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Positions (Optional)</label>
          <input 
            type="text" 
            disabled={isSubmitting}
            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-600 transition-all outline-none"
            placeholder="예: 프론트엔드 1명, 디자이너 1명"
            onChange={(e) => setFormData({...formData, recruiting_positions: e.target.value})}
          />
        </div>

        {/* 연락 링크 입력 */}
        <div>
          <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Contact Link</label>
          <input 
            type="text" 
            disabled={isSubmitting}
            className="w-full p-4 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-600 transition-all outline-none"
            placeholder="카카오톡 오픈프로필 혹은 이메일"
            onChange={(e) => setFormData({...formData, contact_link: e.target.value})}
          />
        </div>

        {/* 제출 버튼 */}
        <button 
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-5 rounded-[1.5rem] font-extrabold text-lg transition-all shadow-lg active:scale-[0.98] ${
            isSubmitting 
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
            : 'bg-blue-600 text-white hover:bg-slate-900 hover:shadow-blue-500/20'
          }`}
        >
          {isSubmitting ? '팀 생성 중...' : '새로운 팀 게시하기'}
        </button>
      </form>
      
      <p className="mt-6 text-center text-[11px] font-medium text-slate-400">
        팀을 생성하면 해당 팀의 <span className="text-slate-900 font-bold underline">팀장</span>으로 자동 등록됩니다.
      </p>
    </div>
  );
}