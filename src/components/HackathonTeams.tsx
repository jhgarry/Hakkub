'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Props {
  hackathonId: string;
  hackathonTitle: string;
  isEnded: boolean;
}

export default function HackathonTeams({ hackathonId, hackathonTitle, isEnded }: Props) {
  const { user, isInitialized } = useAuth();
  
  // 데이터 상태
  const [teams, setTeams] = useState<any[]>([]);
  const [myLedTeams, setMyLedTeams] = useState<any[]>([]);
  const [isAlreadyJoined, setIsAlreadyJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 모달 상태
  const [modalMode, setModalMode] = useState<'choice' | 'precaution' | 'new' | 'existing' | 'confirm_individual' | null>(null);

  // [수정] 폼 상태 확장: 포지션 및 연락 링크 추가
  const [formData, setFormData] = useState({ 
    name: '', 
    description: '', 
    is_recruiting: true,
    recruiting_positions: '',
    contact_link: ''
  });

  const fetchTeams = useCallback(async () => {
    if (!hackathonId) return;
    const { data } = await supabase
      .from('hackathon_teams')
      .select('*, leader:profiles!leader_id(nickname, points)')
      .eq('hackathon_id', hackathonId)
      .order('created_at', { ascending: false });
    if (data) setTeams(data);
  }, [hackathonId]);

  const checkUserStatus = useCallback(async () => {
    if (!user || !hackathonId) return;
    const { data } = await supabase
      .from('hackathon_participants')
      .select('*')
      .eq('hackathon_id', hackathonId)
      .eq('user_id', user.id)
      .single();
    setIsAlreadyJoined(!!data);
  }, [user, hackathonId]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchTeams(), checkUserStatus()]);
      setLoading(false);
    };
    if (isInitialized) init();
  }, [isInitialized, fetchTeams, checkUserStatus]);

  /* --- 팀 생성 및 참가 로직 --- */
  const handleCreateAction = async (isIndividual: boolean = false) => {
    if (!user) return;
    
    const teamPayload = isIndividual ? {
      name: `${user.nickname}의 개인 팀`,
      description: '개인 참가 팀입니다.',
      max_members: 1,
      is_recruiting: false,
      recruiting_positions: 'N/A',
      contact_link: 'Private'
    } : { ...formData, max_members: 5 };

    try {
      const { data: room } = await supabase.from('chat_rooms').insert({}).select().single();
      if (!room) throw new Error("Chat initialization failed");

      const { data: team, error: teamErr } = await supabase.from('hackathon_teams').insert([{
        ...teamPayload, 
        hackathon_id: hackathonId, 
        leader_id: user.id, 
        chat_room_id: room.id
      }]).select().single();

      if (team) {
        await supabase.from('team_members').insert([{ team_id: team.id, user_id: user.id, role: '팀장' }]);
        await supabase.from('hackathon_participants').insert([{ hackathon_id: hackathonId, user_id: user.id }]);
        await supabase.from('chat_participants').insert([{ room_id: room.id, user_id: user.id }]);
        alert("성공적으로 팀이 생성되어 참가되었습니다.");
        window.location.reload();
      }
    } catch (e) {
      alert("팀 생성 중 오류가 발생했습니다.");
    }
  };

  const fetchMyLedTeams = async () => {
    if (!user) return;
    const { data } = await supabase.from('hackathon_teams').select('*').eq('leader_id', user.id);
    setMyLedTeams(data || []);
    setModalMode('existing');
  };

  const sendInviteToTeam = async (targetTeam: any) => {
    if (!targetTeam.chat_room_id) return alert("채팅방이 없는 팀입니다.");
    await supabase.from('chat_messages').insert([{
      room_id: targetTeam.chat_room_id,
      sender_id: user.id,
      content: `📢 [해커톤 초대] 우리 팀을 "${hackathonTitle}" 대회에 초대합니다!`,
      metadata: { type: 'team_invite', team_id: targetTeam.id, team_name: targetTeam.name, hackathon_id: hackathonId }
    }]);
    alert("팀 채팅방으로 초대 메시지가 발송되었습니다.");
    setModalMode(null);
  };

  // 로딩 가드
  if (!isInitialized || loading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      
      {/* 1. 상단 액션 버튼 영역 */}
      {!isEnded && !isAlreadyJoined && (
        <div className="flex flex-col md:flex-row gap-4">
          <button 
            onClick={() => setModalMode('choice')}
            className="flex-1 bg-blue-600 text-white py-5 rounded-2xl font-bold text-lg hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-3"
          >
            <span className="text-2xl">👥</span> 팀 생성 또는 기존 팀 초대
          </button>
          <button 
            onClick={() => setModalMode('confirm_individual')}
            className="flex-1 bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-black transition-all flex items-center justify-center gap-3"
          >
            <span className="text-2xl">👤</span> 개인 참가하기
          </button>
        </div>
      )}

      {/* 이미 참여 중일 때 알림 */}
      {isAlreadyJoined && (
        <div className="bg-blue-50 border border-blue-100 p-8 rounded-3xl flex items-center gap-6">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg shadow-blue-200">✓</div>
          <div>
            <p className="font-extrabold text-blue-900 text-lg">참여 중인 해커톤입니다</p>
            <p className="text-sm text-blue-600 font-medium opacity-80">마이팀 페이지에서 프로젝트 워크스페이스를 확인하세요.</p>
          </div>
        </div>
      )}

      {/* 2. 참여 팀 목록 그리드 */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">참여 팀 목록</h3>
            <span className="bg-slate-100 text-slate-500 text-xs px-2.5 py-1 rounded-full font-bold">{teams.length}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(t => (
            <div key={t.id} className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-sm hover:shadow-xl hover:border-blue-500/30 transition-all group">
              <h4 className="text-xl font-bold text-slate-800 mb-6 truncate group-hover:text-blue-600 transition-colors">{t.name}</h4>
              <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-yellow-400 rounded-xl flex items-center justify-center text-sm shadow-sm">👑</div>
                  <span className="text-sm font-bold text-slate-600">{t.leader?.nickname}</span>
                </div>
                <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{t.leader?.points} PTS</span>
              </div>
            </div>
          ))}
          {teams.length === 0 && (
            <div className="col-span-full py-24 text-center border-2 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50">
              <p className="text-slate-400 font-bold">아직 참여 중인 팀이 없습니다.</p>
              <p className="text-xs text-slate-300 mt-1 uppercase tracking-widest font-black">Waiting for challengers</p>
            </div>
          )}
        </div>
      </section>

      {/* --- 모달 시스템 --- */}
      {modalMode && (
        <div className="fixed inset-0 bg-slate-900/60 z-[400] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-10 relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button onClick={() => setModalMode(null)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors text-2xl">✕</button>
            
            {/* 1. 선택 단계 */}
            {modalMode === 'choice' && (
              <div className="py-4">
                <div className="mb-10">
                  <h2 className="text-3xl font-black text-slate-900 mb-3 uppercase italic tracking-tighter">Team Formation</h2>
                  <p className="text-sm text-slate-500 font-medium">기존 팀과 함께 참여하거나 새로운 팀을 생성하세요.</p>
                </div>
                <div className="space-y-4">
                  <button 
                    onClick={fetchMyLedTeams}
                    className="w-full py-6 bg-blue-600 text-white rounded-2xl font-black text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20"
                  >
                    기존 팀 초대하기
                  </button>
                  <button 
                    onClick={() => setModalMode('precaution')}
                    className="w-full py-6 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl font-black text-xl hover:bg-slate-50 transition-all"
                  >
                    새로 팀 만들기
                  </button>
                </div>
              </div>
            )}

            {/* 2. 유의사항 단계 */}
            {modalMode === 'precaution' && (
              <div className="py-4">
                <div className="mb-10">
                  <h2 className="text-3xl font-black text-slate-900 mb-3 uppercase italic tracking-tighter">Warning</h2>
                  <p className="text-sm text-slate-500 font-medium">생성 전 다음 사항을 숙지해주세요.</p>
                </div>
                <div className="space-y-4 mb-10">
                  {[
                    "팀 생성 즉시 해당 해커톤의 공식 참여자로 등록됩니다.",
                    "팀장은 팀원 관리 및 최종 프로젝트 제출의 의무를 가집니다.",
                    "부적절한 팀명 혹은 소개 사용 시 강제 탈퇴될 수 있습니다."
                  ].map((text, i) => (
                    <div key={i} className="flex gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-bold text-slate-600 leading-relaxed">
                      <span className="text-blue-600">0{i+1}.</span> {text}
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setModalMode('new')}
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xl hover:bg-blue-600 transition-all"
                >
                  확인했습니다
                </button>
              </div>
            )}

            {/* 3. 새 팀 만들기 입력 (지시하신 상세 폼 병합) */}
            {modalMode === 'new' && (
              <div className="py-4">
                <h2 className="text-3xl font-black text-slate-900 mb-8 uppercase italic tracking-tighter">Start New Team</h2>
                <form onSubmit={(e) => { e.preventDefault(); handleCreateAction(); }} className="space-y-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Team Name *</label>
                    <input required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none transition-all" placeholder="창의적인 팀 이름을 입력하세요" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Description *</label>
                    <textarea required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none transition-all" rows={3} placeholder="팀의 목표와 분위기를 설명해주세요" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Seeking Positions (Optional)</label>
                    <input className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none transition-all" placeholder="예: 프론트엔드, AI 엔지니어" value={formData.recruiting_positions} onChange={e => setFormData({...formData, recruiting_positions: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Contact Link (Optional)</label>
                    <input className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none transition-all" placeholder="오픈카톡 또는 이메일" value={formData.contact_link} onChange={e => setFormData({...formData, contact_link: e.target.value})} />
                  </div>
                  <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-xl mt-4 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">
                    게시하기
                  </button>
                </form>
              </div>
            )}

            {/* 4. 기존 팀 초대 리스트 */}
            {modalMode === 'existing' && (
              <div className="py-4">
                <h2 className="text-3xl font-black text-slate-900 mb-8 uppercase italic tracking-tighter">Invite My Team</h2>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                  {myLedTeams.map(t => (
                    <div key={t.id} className="flex justify-between items-center p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] hover:border-blue-500/50 transition-all group">
                      <span className="font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{t.name}</span>
                      <button 
                        onClick={() => sendInviteToTeam(t)} 
                        className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-blue-600 transition-all"
                      >
                        초대 발송
                      </button>
                    </div>
                  ))}
                  {myLedTeams.length === 0 && (
                    <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      관제 중인 팀이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. 개인 참가 확인 */}
            {modalMode === 'confirm_individual' && (
              <div className="text-center py-6">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-4xl mx-auto mb-8 shadow-inner">🙋‍♂️</div>
                <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tighter leading-tight">개인으로 참가하시겠습니까?</h2>
                <p className="text-slate-500 text-sm font-medium mb-10 leading-relaxed">
                  나중에 다른 팀원을 모집할 수 없는<br/>
                  <span className="text-blue-600 font-black">1인 팀</span>으로 자동 등록됩니다.
                </p>
                <div className="flex gap-4">
                  <button onClick={() => setModalMode(null)} className="flex-1 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100">취소</button>
                  <button onClick={() => handleCreateAction(true)} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black">확인했습니다</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}