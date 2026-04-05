'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function CampPage() {
  const { user, isInitialized } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // 데이터 상태
  const [activeHackathons, setActiveHackathons] = useState<any[]>([]);
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true); // 초기값 true

  // 생성 및 수정 관련 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPrecautionOpen, setIsPrecautionOpen] = useState(false); // 유의사항
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_recruiting: true,
    recruiting_positions: '',
    contact_link: ''
  });

  /* -------------------------------------------------------------------------- */
  /* 1. 데이터 로드 로직                                                           */
  /* -------------------------------------------------------------------------- */

  const fetchHackathons = useCallback(async () => {
    const { data } = await supabase.from('hackathons').select('slug, title').eq('status', '진행중');
    if (data) setActiveHackathons(data);
  }, []);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    const slugs = searchParams.getAll('hackathon');
    
    try {
      let query = supabase
        .from('hackathon_teams')
        .select('*, leader:profiles!leader_id(nickname, points), hackathon:hackathons(id, title, slug)')
        .order('created_at', { ascending: false });

      if (slugs.length > 0) {
        // 선택된 해커톤 슬러그들에 해당하는 ID들을 먼저 조회
        const { data: hData } = await supabase.from('hackathons').select('id').in('slug', slugs);
        if (hData) {
          query = query.in('hackathon_id', hData.map(h => h.id));
        }
      }

      const { data } = await query;
      if (data) setTeams(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (isInitialized) {
      fetchHackathons();
      fetchTeams();
    }
  }, [isInitialized, fetchHackathons, fetchTeams]);

  /* -------------------------------------------------------------------------- */
  /* 2. 핸들러 함수                                                               */
  /* -------------------------------------------------------------------------- */

  const handleApplyToTeam = async (targetTeam: any) => {
    if (!user) return alert("로그인이 필요합니다.");
    const { data: existingReq } = await supabase.from('join_requests').select('*').eq('user_id', user.id).eq('team_id', targetTeam.id).single();
    if (existingReq) return alert("이미 이 팀에 합류 신청을 보냈습니다.");

    try {
      const { data: roomId } = await supabase.rpc('get_existing_1to1_room', { uid1: user.id, uid2: targetTeam.leader_id });
      let targetRoomId = roomId;
      if (!targetRoomId) {
        const { data: newRoom } = await supabase.from('chat_rooms').insert({}).select().single();
        if (newRoom) {
          await supabase.from('chat_participants').insert([{ room_id: newRoom.id, user_id: user.id }, { room_id: newRoom.id, user_id: targetTeam.leader_id }]);
          targetRoomId = newRoom.id;
        }
      }
      await supabase.from('chat_messages').insert([{
        room_id: targetRoomId, sender_id: user.id,
        content: `👋 [캠프 신청] 안녕하세요! '${targetTeam.name}' 팀에 합류하고 싶어 신청을 남겼습니다.`,
        metadata: { type: 'join_request', sender_id: user.id, sender_nickname: user.nickname, team_id: targetTeam.id, team_name: targetTeam.name, hackathon_id: targetTeam.hackathon_id }
      }]);
      await supabase.from('join_requests').insert([{ user_id: user.id, team_id: targetTeam.id, hackathon_id: targetTeam.hackathon_id }]);
      alert("팀장님에게 합류 신청 메시지를 전송했습니다!");
      setSelectedTeam(null);
    } catch (err) { alert("처리 중 오류가 발생했습니다."); }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const { data: room } = await supabase.from('chat_rooms').insert({}).select().single();
      if (!room) throw new Error();
      const { data: team } = await supabase.from('hackathon_teams').insert([{
        ...formData,
        leader_id: user.id,
        chat_room_id: room.id
      }]).select().single();
      
      if (team) {
        await supabase.from('team_members').insert([{ team_id: team.id, user_id: user.id, role: '팀장' }]);
        await supabase.from('chat_participants').insert([{ room_id: room.id, user_id: user.id }]);
        alert("새로운 팀이 생성되었습니다!");
        setIsCreateModalOpen(false);
        fetchTeams();
      }
    } catch (err) { alert("팀 생성 중 오류 발생"); }
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    const { error } = await supabase.from('hackathon_teams').update(formData).eq('id', selectedTeam.id);
    if (!error) {
      alert("모집글이 수정되었습니다.");
      setIsEditing(false);
      setSelectedTeam(null);
      fetchTeams();
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 3. 로딩 가드                                                                 */
  /* -------------------------------------------------------------------------- */

  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Scanning Teams...</p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
      </div>
    );
  }

  return (
    <main className="bg-white min-h-screen">
      {/* Hero Section */}
      <section className="bg-slate-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
                Recruitment <span className="text-blue-600">Camp</span>
              </h1>
              <p className="text-lg text-slate-500 font-medium max-w-xl">
                혁신적인 프로젝트를 함께 완성할 동료를 찾고 계신가요?<br />
                검색 필터를 활용해 당신의 기술 스택에 맞는 팀을 찾아보세요.
              </p>
            </div>
            <button 
              onClick={() => {
                setFormData({ name: '', description: '', is_recruiting: true, recruiting_positions: '', contact_link: '' });
                setIsPrecautionOpen(true);
              }}
              className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all shadow-lg shadow-slate-200"
            >
              🚀 새로운 팀 만들기
            </button>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-12">
          <button 
            onClick={() => setShowFilter(!showFilter)}
            className={`px-6 py-3 rounded-xl border font-bold text-sm transition-all ${
              showFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            {showFilter ? '필터 닫기' : '🔍 해커톤별 필터링'}
          </button>
          {searchParams.has('hackathon') && (
            <button 
              onClick={() => router.push('/camp')}
              className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors"
            >
              필터 초기화 ✕
            </button>
          )}
        </div>

        {showFilter && (
          <div className="bg-slate-50 rounded-3xl p-8 mb-12 border border-slate-100 animate-in fade-in slide-in-from-top-2">
            <p className="text-sm font-bold text-slate-900 mb-6 uppercase tracking-wider">관심 있는 해커톤을 선택하세요</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {activeHackathons.map(h => (
                <label key={h.slug} className={`flex items-center gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedSlugs.includes(h.slug) ? 'bg-white border-blue-600 shadow-md' : 'bg-white border-transparent hover:border-slate-200'
                }`}>
                  <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={selectedSlugs.includes(h.slug)} onChange={() => {
                    setSelectedSlugs(prev => prev.includes(h.slug) ? prev.filter(s => s !== h.slug) : [...prev, h.slug])
                  }} />
                  <span className="font-bold text-sm text-slate-700">{h.title}</span>
                </label>
              ))}
            </div>
            <button 
              onClick={() => {
                const params = new URLSearchParams();
                selectedSlugs.forEach(s => params.append('hackathon', s));
                router.push(`/camp?${params.toString()}`);
                setShowFilter(false);
              }}
              className="w-full md:w-auto px-12 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-blue-600 transition-all"
            >
              선택한 해커톤 팀 조회하기
            </button>
          </div>
        )}

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {teams.map((team) => (
            <div 
              key={team.id} 
              onClick={() => {
                setSelectedTeam(team);
                setIsEditing(false);
                setFormData({
                  name: team.name,
                  description: team.description,
                  is_recruiting: team.is_recruiting,
                  recruiting_positions: team.recruiting_positions || '',
                  contact_link: team.contact_link || ''
                });
              }}
              className="group bg-white border border-slate-200 p-8 rounded-[2rem] hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/5 transition-all cursor-pointer flex flex-col h-full relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-6">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                  team.is_recruiting ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {team.is_recruiting ? 'Recruiting' : 'Closed'}
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400 uppercase mb-2">
                {team.hackathon?.title || '자유 주제 팀'}
              </span>
              <h3 className="text-xl font-bold text-slate-900 mb-4 group-hover:text-blue-600 transition-colors flex-1">
                {team.name}
              </h3>
              <div className="pt-6 border-t border-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px]">👤</div>
                  <span className="text-xs font-bold text-slate-500">{team.leader?.nickname}</span>
                </div>
                <span className="text-[10px] font-black text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">VIEW DETAILS →</span>
              </div>
            </div>
          ))}
        </div>

        {teams.length === 0 && (
          <div className="py-32 text-center border-2 border-dashed border-slate-100 rounded-[3rem]">
            <p className="text-slate-300 font-bold">조회된 팀이 없습니다.</p>
          </div>
        )}
      </div>

      {/* [Modal] Team Details / Edit */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-slate-900/60 z-[400] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-10 relative shadow-2xl animate-in zoom-in-95">
            <button onClick={() => setSelectedTeam(null)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors text-2xl">✕</button>
            
            {isEditing ? (
              <form onSubmit={handleUpdateTeam} className="space-y-6">
                <h2 className="text-2xl font-black text-slate-900 mb-8">모집글 수정</h2>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Team Name</label>
                    <input required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Description</label>
                    <textarea required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none" rows={4} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Recruiting Positions (Optional)</label>
                    <input className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none" value={formData.recruiting_positions} onChange={e => setFormData({...formData, recruiting_positions: e.target.value})} />
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl">
                    <input type="checkbox" id="edit-rec-check" className="w-5 h-5 accent-blue-600" checked={formData.is_recruiting} onChange={e => setFormData({...formData, is_recruiting: e.target.checked})} />
                    <label htmlFor="edit-rec-check" className="font-bold text-sm text-blue-900">현재 팀원을 모집 중으로 표시</label>
                  </div>
                </div>
                <div className="flex gap-3 pt-6">
                  <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all">저장하기</button>
                  <button type="button" onClick={() => setIsEditing(false)} className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold">취소</button>
                </div>
              </form>
            ) : (
              <>
                <div className="mb-10">
                  <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase mb-3 inline-block">
                    {selectedTeam.hackathon?.title || '자유 주제 팀'}
                  </span>
                  <h2 className="text-4xl font-extrabold text-slate-900 leading-tight">{selectedTeam.name}</h2>
                </div>
                
                <div className="space-y-8 mb-12">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 bg-slate-50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Leader</p>
                      <p className="font-bold text-slate-900">{selectedTeam.leader?.nickname}</p>
                    </div>
                    <div className="p-5 bg-slate-50 rounded-2xl">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Seeking</p>
                      <p className="font-bold text-blue-600">{selectedTeam.recruiting_positions || '전체'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase mb-3">About our Squad</p>
                    <p className="text-slate-600 leading-relaxed font-medium whitespace-pre-wrap">{selectedTeam.description}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {selectedTeam.leader_id === user?.id ? (
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="w-full py-5 bg-yellow-400 text-black rounded-2xl font-black text-lg hover:bg-yellow-500 transition-all"
                    >
                      ✏️ 모집 내용 수정하기
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleApplyToTeam(selectedTeam)}
                      className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black text-lg hover:bg-blue-700 transition-all"
                    >
                      🤝 팀 합류 신청하기
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* [Modal] Creation Precaution */}
      {isPrecautionOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[500] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 relative animate-in zoom-in-95 shadow-2xl">
            <h2 className="text-2xl font-black text-slate-900 mb-6 uppercase italic">Important Notice</h2>
            <div className="space-y-4 text-sm font-medium text-slate-500 leading-relaxed mb-10">
              <p className="p-4 bg-slate-50 rounded-xl border-l-4 border-yellow-400 text-slate-700">
                1. 팀 생성 시 본인이 자동으로 <b>팀장</b>으로 지정됩니다.
              </p>
              <p className="p-4 bg-slate-50 rounded-xl border-l-4 border-blue-400 text-slate-700">
                2. 팀장은 팀원을 관리하고 프로젝트 결과물을 제출할 책임이 있습니다.
              </p>
              <p className="p-4 bg-slate-50 rounded-xl border-l-4 border-slate-900 text-slate-700">
                3. 부적절한 팀명이나 허위 정보 작성 시 서비스 이용이 제한될 수 있습니다.
              </p>
            </div>
            <button 
              onClick={() => { setIsPrecautionOpen(false); setIsCreateModalOpen(true); }}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
            >
              확인했습니다
            </button>
          </div>
        </div>
      )}

      {/* [Modal] Create Team Form */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-[400] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] p-10 relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 text-2xl">✕</button>
            <h2 className="text-3xl font-black text-slate-900 mb-8 uppercase italic tracking-tighter">Start New Team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Team Name *</label>
                <input required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none" placeholder="창의적인 팀 이름을 입력하세요" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Description *</label>
                <textarea required className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none" rows={3} placeholder="팀의 목표와 분위기를 설명해주세요" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Seeking Positions (Optional)</label>
                <input className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none" placeholder="예: 프론트엔드, AI 엔지니어" value={formData.recruiting_positions} onChange={e => setFormData({...formData, recruiting_positions: e.target.value})} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-black text-slate-400 uppercase ml-1">Contact Link (Optional)</label>
                <input className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold focus:ring-2 ring-blue-500 outline-none" placeholder="오픈카톡 또는 이메일" value={formData.contact_link} onChange={e => setFormData({...formData, contact_link: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xl mt-4 hover:bg-blue-600 transition-all shadow-xl shadow-slate-200">
                게시하기
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}