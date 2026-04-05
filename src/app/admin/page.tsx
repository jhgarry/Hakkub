'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

type AdminTab = 'hackathons' | 'submissions' | 'users' | 'stats';

export default function AdminPage() {
  const { user, isInitialized } = useAuth();
  const router = useRouter();
  
  // UI 상태
  const [activeTab, setActiveTab] = useState<AdminTab>('hackathons');
  const [loading, setLoading] = useState(true);
  const [selectedHackathonId, setSelectedHackathonId] = useState<string>('');
  
  // 데이터 상태
  const [hackathons, setHackathons] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [teamsForGrading, setTeamsForGrading] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalTeams: 0, totalHackathons: 0 });

  // 해커톤 생성 폼 상태 (태그 필드 포함)
  const [newHackathon, setNewHackathon] = useState({
    title: '', 
    slug: '', 
    status: '예정', 
    start_date: '', 
    end_date: '',
    overview: '', 
    evaluation: '', 
    schedule: '', 
    prize: '',
    allowed_extensions: '.zip',
    tags_raw: '' // 입력을 위한 임시 문자열 필드
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: hData } = await supabase.from('hackathons').select('*').order('created_at', { ascending: false });
      const { data: uData } = await supabase.from('profiles').select('*').order('points', { ascending: false });
      const { data: sData } = await supabase.from('hackathon_submissions').select('*, hackathons(title), profiles(nickname), hackathon_teams(name)');
      
      if (hData) setHackathons(hData);
      if (uData) setUsers(uData);
      if (sData) setSubmissions(sData);

      const { count: teamCount } = await supabase.from('hackathon_teams').select('id', { count: 'exact', head: true });

      setStats({
        totalUsers: uData?.length || 0,
        totalTeams: teamCount || 0,
        totalHackathons: hData?.length || 0
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    
    if (!user?.is_admin) {
      alert("관리자 권한이 필요합니다.");
      router.push('/');
      return;
    }

    fetchData();
  }, [isInitialized, user, router, fetchData]);

  /* -------------------------------------------------------------------------- */
  /* 1. 해커톤 관리 로직                                                          */
  /* -------------------------------------------------------------------------- */

  const handleCreateHackathon = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 태그 문자열을 배열로 변환 (공백 제거)
    const tagsArray = newHackathon.tags_raw
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag !== '');

    const { tags_raw, ...submitData } = newHackathon; // tags_raw는 제외하고 보냄

    const { error } = await supabase.from('hackathons').insert([
      { ...submitData, tags: tagsArray }
    ]);

    if (error) {
      alert("등록 실패: " + error.message);
    } else {
      alert("신규 해커톤이 등록되었습니다.");
      setNewHackathon({ 
        title: '', slug: '', status: '예정', start_date: '', end_date: '', 
        overview: '', evaluation: '', schedule: '', prize: '', allowed_extensions: '.zip', tags_raw: ''
      });
      fetchData();
    }
  };

  const toggleHackathonStatus = async (id: string, currentStatus: string) => {
  let nextStatus = '진행중';
  
  // 예정 -> 진행중 / 진행중 -> 종료됨 / 종료됨 -> 예정 순으로 순환
  if (currentStatus === '예정') nextStatus = '진행중';
  else if (currentStatus === '진행중') nextStatus = '마감';
  else if (currentStatus === '마감') nextStatus = '예정';

  const { error } = await supabase
    .from('hackathons')
    .update({ status: nextStatus })
    .eq('id', id);

  if (error) {
    alert("상태 변경 실패: " + error.message);
  } else {
    // 상태 변경 후 데이터를 즉시 다시 불러와 UI에 반영
    await fetchData();
  }
};

  /* -------------------------------------------------------------------------- */
  /* 2. 채점 및 포인트 정산 로직 (복구됨)                                           */
  /* -------------------------------------------------------------------------- */

  const fetchTeamsForGrading = useCallback(async (hId: string) => {
    setSelectedHackathonId(hId);
    if (!hId) return;
    const { data } = await supabase
      .from('hackathon_teams')
      .select('*, leader:profiles!leader_id(nickname)')
      .eq('hackathon_id', hId)
      .order('created_at', { ascending: true });
    if (data) setTeamsForGrading(data);
  }, []);

  const handleUpdateTeamPoints = async (teamId: string, newPoints: number) => {
    const { error } = await supabase.from('hackathon_teams').update({ points: newPoints }).eq('id', teamId);
    if (!error) fetchTeamsForGrading(selectedHackathonId);
  };

  const handleDistributePoints = async (hId: string) => {
    if (!confirm("해당 해커톤의 모든 팀 포인트를 팀원들에게 1/n로 분배하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    const { error } = await supabase.rpc('distribute_team_points', { target_hackathon_id: hId });
    if (error) alert("분배 실패: " + error.message);
    else {
      alert("정산이 완료되었습니다.");
      fetchData();
      fetchTeamsForGrading(hId);
    }
  };

  const updatePoints = async (userId: string, amount: number) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    await supabase.from('profiles').update({ points: targetUser.points + amount }).eq('id', userId);
    fetchData();
  };

  /* -------------------------------------------------------------------------- */
  /* 3. 렌더링 가드                                                               */
  /* -------------------------------------------------------------------------- */

  if (!isInitialized || loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Admin Initializing</p>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
        </div>
      </div>
    );
  }

  return (
    <main className="bg-white min-h-screen text-slate-900 pb-20">
      {/* Header */}
      <header className="bg-slate-900 text-white py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <p className="text-blue-400 text-xs font-black uppercase tracking-widest mb-2">System Console</p>
            <h1 className="text-4xl font-extrabold tracking-tight">Hacker Hub <span className="text-slate-500">Admin</span></h1>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-slate-400 text-[10px] font-black uppercase">Admin User</p>
              <p className="font-bold">{user?.nickname}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 -mt-8">
        {/* Navigation Tabs */}
        <nav className="flex gap-2 p-2 bg-white border border-slate-200 rounded-2xl shadow-xl mb-12 overflow-x-auto no-scrollbar">
          {[
            { id: 'hackathons', l: '🏟️ 해커톤 관리' },
            { id: 'submissions', l: '📁 제출물 & 채점' },
            { id: 'users', l: '👥 유저 관리' },
            { id: 'stats', l: '📊 인사이트' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-6 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {tab.l}
            </button>
          ))}
        </nav>

        {/* [TAB 1] Hackathons Management */}
        {activeTab === 'hackathons' && (
          <div className="grid lg:grid-cols-3 gap-10 animate-in fade-in slide-in-from-bottom-2">
            <div className="lg:col-span-1 space-y-6">
              <section className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                <h2 className="text-xl font-black mb-6 uppercase text-slate-400 tracking-tighter">Create New Event</h2>
                <form onSubmit={handleCreateHackathon} className="space-y-4">
                  <input required className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 ring-blue-500 outline-none" placeholder="해커톤 제목" value={newHackathon.title} onChange={e => setNewHackathon({...newHackathon, title: e.target.value})} />
                  <input required className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 ring-blue-500 outline-none" placeholder="URL 슬러그 (영문)" value={newHackathon.slug} onChange={e => setNewHackathon({...newHackathon, slug: e.target.value})} />
                  <div className="grid grid-cols-2 gap-2">
                    <input required type="date" className="p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm" value={newHackathon.start_date} onChange={e => setNewHackathon({...newHackathon, start_date: e.target.value})} />
                    <input required type="date" className="p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm" value={newHackathon.end_date} onChange={e => setNewHackathon({...newHackathon, end_date: e.target.value})} />
                  </div>
                  <textarea required className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm" placeholder="대회 개요" rows={2} value={newHackathon.overview} onChange={e => setNewHackathon({...newHackathon, overview: e.target.value})} />
                  <textarea required className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm" placeholder="평가 방식" rows={2} value={newHackathon.evaluation} onChange={e => setNewHackathon({...newHackathon, evaluation: e.target.value})} />
                  <textarea required className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm" placeholder="상금 및 혜택" rows={2} value={newHackathon.prize} onChange={e => setNewHackathon({...newHackathon, prize: e.target.value})} />
                  
                  {/* 멀티 태그 입력란 */}
                  <input className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-2 ring-blue-500 outline-none" placeholder="태그 (쉼표로 구분: AI, WEB, Java)" value={newHackathon.tags_raw} onChange={e => setNewHackathon({...newHackathon, tags_raw: e.target.value})} />
                  
                  <input required className="w-full p-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm" placeholder="허용 확장자 (.zip, .pdf)" value={newHackathon.allowed_extensions} onChange={e => setNewHackathon({...newHackathon, allowed_extensions: e.target.value})} />
                  
                  <button className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">PUBLISH HACKATHON</button>
                </form>
              </section>
            </div>
            
            <div className="lg:col-span-2 space-y-4">
  {hackathons.map(h => (
    <div key={h.id} className="bg-white border border-slate-100 p-6 rounded-3xl flex justify-between items-center hover:bg-slate-50 transition-colors group">
      <div>
        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{h.title}</h3>
        <p className="text-xs font-medium text-slate-400 mt-1">{h.start_date} ~ {h.end_date}</p>
      </div>
      <div className="flex items-center gap-3">
        {/* 현재 상태 표시 배지 */}
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
          h.status === '마감' ? 'bg-red-50 text-red-500' : 
          h.status === '진행중' ? 'bg-green-50 text-green-500' : 
          'bg-blue-50 text-blue-500'
        }`}>
          {h.status}
        </span>
        
        {/* 상태 전환 버튼: 클릭 시 다음 단계로 변경 */}
        <button 
          onClick={() => toggleHackathonStatus(h.id, h.status)} 
          className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-[10px] hover:bg-blue-600 transition-all shadow-lg shadow-slate-200 active:scale-95"
        >
          {h.status === '예정' ? '시작하기' : h.status === '진행중' ? '종료하기' : '되돌리기'}
        </button>
      </div>
    </div>
  ))}
</div>
          </div>
        )}

        {/* [TAB 2] Submissions & Team Grading (복구된 기능) */}
        {activeTab === 'submissions' && (
          <div className="space-y-12 animate-in fade-in">
            {/* 채점 대시보드 */}
            <section className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl">
              <div className="flex flex-col md:flex-row md:items-center gap-6 mb-10">
                <h2 className="text-2xl font-black italic uppercase text-yellow-400">Team Point Grading</h2>
                <select 
                  className="p-3 bg-white/10 border border-white/20 rounded-xl font-bold text-sm text-white outline-none"
                  value={selectedHackathonId}
                  onChange={(e) => fetchTeamsForGrading(e.target.value)}
                >
                  <option value="" className="text-slate-900">대회 선택</option>
                  {hackathons.map(h => <option key={h.id} value={h.id} className="text-slate-900">{h.title}</option>)}
                </select>
                {selectedHackathonId && (
                  <button onClick={() => handleDistributePoints(selectedHackathonId)} className="md:ml-auto px-6 py-3 bg-blue-500 text-white rounded-xl font-black text-xs hover:bg-blue-400 transition-all shadow-lg shadow-blue-500/20">🏁 FINALIZE & DISTRIBUTE (1/N)</button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamsForGrading.map(team => (
                  <div key={team.id} className="bg-white/5 border border-white/10 p-6 rounded-2xl flex justify-between items-center group hover:bg-white/10 transition-colors">
                    <div>
                      <p className="font-bold text-lg">{team.name}</p>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Leader: {team.leader?.nickname}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-500 mb-1">SCORE</span>
                        <input 
                          type="number" 
                          className="w-24 p-2 bg-white/10 border border-white/20 rounded-lg font-black text-center text-white focus:ring-2 ring-yellow-400 outline-none" 
                          defaultValue={team.points} 
                          onBlur={(e) => handleUpdateTeamPoints(team.id, parseInt(e.target.value) || 0)} 
                        />
                      </div>
                      {team.points_distributed ? 
                        <span className="bg-blue-500/20 text-blue-400 text-[9px] font-black px-2 py-1 rounded border border-blue-500/30">DISTRIBUTED</span> : 
                        <span className="bg-yellow-500/20 text-yellow-400 text-[9px] font-black px-2 py-1 rounded border border-yellow-500/30">PENDING</span>
                      }
                    </div>
                  </div>
                ))}
                {selectedHackathonId && teamsForGrading.length === 0 && <p className="col-span-full text-center py-10 text-slate-500 font-bold">참여 팀이 없습니다.</p>}
              </div>
            </section>

            {/* 제출물 목록 */}
            <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-lg">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-100 font-black text-[10px] uppercase text-slate-400">
                  <tr>
                    <th className="p-6">Hackathon</th>
                    <th className="p-6">Team / Author</th>
                    <th className="p-6">Project Title</th>
                    <th className="p-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(s => (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="p-6 text-sm font-bold text-blue-600">{s.hackathons?.title}</td>
                      <td className="p-6">
                        <p className="text-sm font-bold">{s.hackathon_teams?.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">{s.profiles?.nickname}</p>
                      </td>
                      <td className="p-6 text-sm font-medium">{s.project_title}</td>
                      <td className="p-6 text-right">
                        <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/submissions/${s.file_url}`} target="_blank" className="inline-block px-4 py-2 bg-slate-900 text-white rounded-lg text-[10px] font-black hover:bg-blue-600 transition-all">DOWNLOAD</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* [TAB 3] User Management */}
        {activeTab === 'users' && (
          <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden shadow-lg animate-in fade-in">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100 font-black text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="p-6">Hacker Name</th>
                  <th className="p-6">Total Points</th>
                  <th className="p-6 text-right">Modify</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs">👤</div>
                        <span className="text-sm font-bold">{u.nickname} {u.is_admin && <span className="ml-2 bg-yellow-400 text-[8px] px-1.5 py-0.5 rounded text-black">ADMIN</span>}</span>
                      </div>
                    </td>
                    <td className="p-6 font-black text-blue-600">{u.points.toLocaleString()} PTS</td>
                    <td className="p-6 text-right space-x-2">
                      <button onClick={() => updatePoints(u.id, 100)} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-xl text-[10px] font-black hover:bg-green-600 hover:text-white transition-all">+100</button>
                      <button onClick={() => updatePoints(u.id, -100)} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-[10px] font-black hover:bg-red-600 hover:text-white transition-all">-100</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* [TAB 4] Insights/Stats */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-in zoom-in-95">
            {[
              { label: 'Total Hackers', value: stats.totalUsers, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active Teams', value: stats.totalTeams, color: 'text-slate-900', bg: 'bg-slate-50' },
              { label: 'Events Hosted', value: stats.totalHackathons, color: 'text-yellow-600', bg: 'bg-yellow-50' }
            ].map(stat => (
              <div key={stat.label} className={`${stat.bg} p-12 rounded-[3.5rem] flex flex-col items-center justify-center border border-white shadow-sm`}>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">{stat.label}</p>
                <p className={`text-7xl font-black ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}