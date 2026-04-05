'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, isInitialized, login, logout } = useAuth();
  const router = useRouter();

  // 상태 관리
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [nickname, setNickname] = useState('');
  const [myHackathons, setMyHackathons] = useState<any[]>([]);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [loading, setLoading] = useState(true);

  // 데이터 통합 페칭
  const fetchProfileData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. 찜한 해커톤
      const { data: wishData } = await supabase
        .from('hackathon_wishlist')
        .select('hackathons(*)')
        .eq('user_id', user.id);
      if (wishData) setWishlist(wishData.map(d => d.hackathons));

      // 2. 참여 중인 해커톤
      const { data: hData } = await supabase
        .from('hackathon_participants')
        .select('hackathons(id, title, slug, status)')
        .eq('user_id', user.id);
      if (hData) setMyHackathons(hData.map((item: any) => item.hackathons));

      // 3. 소속된 팀 (내가 리더인 팀 우선 조회)
      const { data: tData } = await supabase
        .from('hackathon_teams')
        .select('*, hackathons(title)')
        .or(`leader_id.eq.${user.id}`);
      if (tData) setMyTeams(tData);

      setNickname(user.nickname || '');
    } catch (error) {
      console.error("Profile load error:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isInitialized) {
      fetchProfileData();
    }
  }, [isInitialized, fetchProfileData]);

  // 팀원 정보 조회
  const handleTeamClick = async (team: any) => {
    setSelectedTeam(team);
    const { data } = await supabase
      .from('team_members')
      .select('role, profiles(id, nickname)')
      .eq('team_id', team.id);
    if (data) setTeamMembers(data);
  };

  // 닉네임 수정
  const handleUpdateNickname = async () => {
    if (!nickname || nickname === user.nickname) return;
    setIsUpdating(true);
    const { error } = await supabase.from('profiles').update({ nickname }).eq('id', user.id);
    if (error) {
      alert("이미 존재하는 닉네임이거나 오류가 발생했습니다.");
    } else {
      alert("닉네임이 성공적으로 변경되었습니다.");
      login({ ...user, nickname });
    }
    setIsUpdating(false);
  };

  // 친구 추가
  const addFriend = async (friendId: string) => {
    const { error } = await supabase.from('friends').insert([{ user_id: user.id, friend_id: friendId }]);
    if (error) alert("이미 친구이거나 오류가 발생했습니다.");
    else alert("친구 목록에 추가되었습니다.");
  };

  // 팀 채팅 시작
  const startTeamChat = async () => {
    if (!selectedTeam) return;
    const { data: room } = await supabase.from('chat_rooms').insert({}).select().single();
    if (room) {
      const participants = teamMembers.map(m => ({ room_id: room.id, user_id: m.profiles.id }));
      participants.push({ room_id: room.id, user_id: user.id });
      await supabase.from('chat_participants').insert(participants);
      router.push(`/profile/mails?room=${room.id}`);
    }
  };

  // 로그아웃
  const handleLogoutClick = async () => {
    if (confirm("정말로 로그아웃 하시겠습니까?")) {
      await logout();
      router.push('/');
    }
  };

  /* --- 로딩 가드 --- */
  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Profile</p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-20 text-center">
        <p className="text-slate-400 mb-4">로그인이 필요한 페이지입니다.</p>
        <Link href="/login" className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold">로그인하러 가기</Link>
      </div>
    );
  }

  return (
    <main className="bg-slate-50 min-h-screen pb-20">
      {/* Top Section: Header & Quick Actions */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">마이 페이지</h1>
            <p className="text-sm text-slate-400 font-medium mt-1">개인 정보 및 활동 내역을 관리하세요.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/profile/mails" className="px-5 py-2.5 bg-yellow-400 text-black rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2">
              <span>📧</span> 메일함 확인
            </Link>
            <button 
              onClick={handleLogoutClick}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-all"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col lg:flex-row gap-10">
        
        {/* Left Column: Info & Lists */}
        <div className="flex-1 space-y-8">
          
          {/* User Info Card */}
          <section className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">My Nickname</label>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-2 ring-blue-500/20 transition-all"
                    value={nickname} 
                    onChange={e => setNickname(e.target.value)} 
                  />
                  <button 
                    onClick={handleUpdateNickname} 
                    disabled={isUpdating}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:bg-slate-200"
                  >
                    {isUpdating ? '변경 중...' : '변경'}
                  </button>
                </div>
              </div>
              <div className="md:w-px h-12 bg-slate-100 hidden md:block"></div>
              <div className="text-right">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Points</p>
                <p className="text-4xl font-black text-slate-900 leading-none">
                  {user.points?.toLocaleString()} <span className="text-blue-600 text-xl italic">P</span>
                </p>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Hackathons List */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-blue-600">🏆</span> 참여 중인 해커톤
              </h3>
              <div className="space-y-3">
                {myHackathons.map(h => (
                  <Link key={h.id} href={`/hackathons/${h.slug}`} className="block p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-blue-300 hover:bg-white transition-all">
                    <p className="font-bold text-slate-800 text-sm truncate">{h.title}</p>
                    <span className="text-[10px] font-bold text-blue-500 uppercase mt-1 inline-block">{h.status}</span>
                  </Link>
                ))}
                {myHackathons.length === 0 && <p className="text-center py-6 text-slate-300 text-sm font-medium">참여한 대회가 없습니다.</p>}
              </div>
            </div>

            {/* My Teams List */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <span className="text-blue-600">🤝</span> 내 팀 목록
              </h3>
              <div className="space-y-3">
                {myTeams.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => handleTeamClick(t)} 
                    className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                      selectedTeam?.id === t.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200'
                    }`}
                  >
                    <p className="font-bold text-sm truncate">{t.name}</p>
                    <p className={`text-[10px] mt-1 font-medium ${selectedTeam?.id === t.id ? 'text-blue-100' : 'text-slate-400'}`}>
                      {t.hackathons?.title || '자유주제'}
                    </p>
                  </div>
                ))}
                {myTeams.length === 0 && <p className="text-center py-6 text-slate-300 text-sm font-medium">소속된 팀이 없습니다.</p>}
              </div>
            </div>
          </div>

          {/* Wishlist Section */}
          <section className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <span className="text-yellow-500">⭐️</span> 찜한 해커톤
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {wishlist.map(h => (
                <Link key={h.id} href={`/hackathons/${h.slug}`} className="p-4 bg-yellow-50/50 border border-yellow-100 rounded-2xl hover:bg-yellow-50 hover:shadow-sm transition-all">
                  <p className="font-bold text-slate-800 text-sm truncate">{h.title}</p>
                </Link>
              ))}
              {wishlist.length === 0 && <p className="col-span-full py-6 text-slate-300 text-sm font-medium">찜한 대회가 없습니다.</p>}
            </div>
          </section>
        </div>

        {/* Right Column: Team Details Sidebar */}
        <aside className="lg:w-96">
          {selectedTeam ? (
            <div className="bg-slate-900 text-white rounded-[2rem] p-8 sticky top-28 shadow-xl overflow-hidden relative">
              {/* Decoration */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-600 rounded-full blur-3xl opacity-20"></div>

              <h3 className="text-xl font-bold mb-8 flex items-center justify-between relative z-10">
                Team Details
                <span className="text-[10px] bg-blue-600 px-2 py-1 rounded text-white uppercase tracking-widest">Active</span>
              </h3>
              
              <div className="space-y-4 mb-10 relative z-10">
                {teamMembers.map((m, idx) => (
                  <div key={idx} className="flex justify-between items-center p-4 bg-white/5 border border-white/10 rounded-2xl transition-all hover:bg-white/10">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-blue-400 uppercase mb-0.5 tracking-tighter">{m.role}</p>
                      <p className="font-bold text-sm truncate">{m.profiles.nickname}</p>
                    </div>
                    {m.profiles.id !== user.id && (
                      <button 
                        onClick={() => addFriend(m.profiles.id)} 
                        className="ml-4 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black hover:bg-blue-500 transition-colors shrink-0 shadow-lg shadow-blue-600/20"
                      >
                        친구 추가
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button 
                onClick={startTeamChat} 
                className="w-full py-4 bg-yellow-400 text-black rounded-2xl font-black text-sm hover:bg-yellow-300 hover:shadow-lg hover:shadow-yellow-400/20 transition-all relative z-10"
              >
                💬 팀원들과 대화하기
              </button>
            </div>
          ) : (
            <div className="h-full min-h-[400px] border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center p-10 text-center bg-white/50">
              <span className="text-4xl mb-4 opacity-20">📂</span>
              <p className="text-slate-400 font-bold text-sm leading-relaxed">
                좌측의 '참여 팀' 목록에서<br />팀을 선택해 정보를 확인하세요.
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}