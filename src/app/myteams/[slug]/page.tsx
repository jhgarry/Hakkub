'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function TeamWorkspaceDetail() {
  const { slug: teamId } = useParams();
  const { user, isInitialized } = useAuth();
  const router = useRouter();

  // 데이터 상태
  const [team, setTeam] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'teammates' | 'chats' | 'board'>('teammates');
  const [loading, setLoading] = useState(true);

  // 채팅 상태
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // 게시판 상태
  const [posts, setPosts] = useState<any[]>([]);
  const [boardView, setBoardView] = useState<'list' | 'create' | 'detail'>('list');
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [postForm, setPostForm] = useState({ title: '', content: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  /* -------------------------------------------------------------------------- */
  /* 1. 데이터 페칭                                                               */
  /* -------------------------------------------------------------------------- */
  const fetchTeamData = useCallback(async () => {
    if (!teamId) return;
    const { data } = await supabase
      .from('hackathon_teams')
      .select('*, hackathons(title)')
      .eq('id', teamId)
      .single();
    if (data) setTeam(data);
  }, [teamId]);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from('team_members')
      .select('*, profiles(id, nickname, points)')
      .eq('team_id', teamId);
    if (data) setMembers(data);
  }, [teamId]);

  const fetchPosts = useCallback(async () => {
    const { data } = await supabase
      .from('team_posts')
      .select('*, profiles:author_id(nickname)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });
    if (data) setPosts(data);
  }, [teamId]);

  const fetchMessages = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profiles:sender_id(nickname)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchTeamData(), fetchMembers(), fetchPosts()]);
      setLoading(false);
    };
    // 인증 시스템이 초기화된 후 데이터 로드
    if (isInitialized && user) init();
    else if (isInitialized && !user) {
      alert("로그인이 필요한 서비스입니다.");
      router.push('/login');
    }
  }, [isInitialized, user, fetchTeamData, fetchMembers, fetchPosts, router]);

  /* -------------------------------------------------------------------------- */
  /* 2. 실시간 채팅 구독                                                          */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (!team?.chat_room_id) return;

    fetchMessages(team.chat_room_id);

    const channel = supabase
      .channel(`team-chat-${team.chat_room_id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages', 
        filter: `room_id=eq.${team.chat_room_id}` 
      }, () => {
        fetchMessages(team.chat_room_id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [team?.chat_room_id, fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !team?.chat_room_id) return;
    const content = newMessage;
    setNewMessage('');
    await supabase.from('chat_messages').insert([{ room_id: team.chat_room_id, sender_id: user?.id, content }]);
  };

  const sendSystemMessage = async (content: string) => {
    if (team?.chat_room_id) {
      await supabase.from('chat_messages').insert([{ room_id: team.chat_room_id, sender_id: null, content: `📢 [시스템] ${content}` }]);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 3. 팀원 관리 기능                                                            */
  /* -------------------------------------------------------------------------- */
  const handleDelegate = async (targetId: string, nickname: string) => {
    if (!confirm(`${nickname}님에게 팀장을 위임하시겠습니까?`)) return;
    const { error } = await supabase.from('hackathon_teams').update({ leader_id: targetId }).eq('id', teamId);
    if (!error) {
      await sendSystemMessage(`팀장이 ${nickname}님으로 변경되었습니다.`);
      fetchTeamData();
    }
  };

  const handleKick = async (targetId: string, nickname: string) => {
    if (!confirm(`${nickname}님을 팀에서 추방하시겠습니까?`)) return;
    const { error } = await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', targetId);
    if (!error) {
      await supabase.from('chat_participants').delete().eq('room_id', team.chat_room_id).eq('user_id', targetId);
      await sendSystemMessage(`${nickname}님이 팀에서 제외되었습니다.`);
      fetchMembers();
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 4. 게시판 로직                                                               */
  /* -------------------------------------------------------------------------- */
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postForm.title.trim()) return alert("제목을 입력하세요.");

    let fileUrl = null;
    let fileName = null;

    if (selectedFile) {
      fileName = selectedFile.name;
      const { data: up } = await supabase.storage.from('team_boards').upload(`${teamId}/${Date.now()}_${fileName}`, selectedFile);
      if (up) fileUrl = up.path;
    }

    const { error } = await supabase.from('team_posts').insert([{
      team_id: teamId, author_id: user?.id, title: postForm.title, content: postForm.content, file_url: fileUrl, file_name: fileName
    }]);

    if (!error) {
      setPostForm({ title: '', content: '' });
      setSelectedFile(null);
      setBoardView('list');
      fetchPosts();
    }
  };

  /* -------------------------------------------------------------------------- */
  /* 5. 로딩 가드                                                                 */
  /* -------------------------------------------------------------------------- */
  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Synchronizing Workspace</p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
      </div>
    );
  }

  const isLeader = team?.leader_id === user?.id;

  return (
    <main className="bg-slate-50 min-h-screen text-slate-900 pb-20">
      {/* 1. Header Area */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <nav className="flex items-center gap-2 text-xs font-bold text-slate-400 mb-6 uppercase tracking-widest">
                <Link href="/myteams" className="hover:text-blue-600 transition-colors">My Teams</Link>
                <span>/</span>
                <span className="text-slate-900">Workspace</span>
              </nav>
              <div className="flex items-center gap-3 mb-4">
                {team?.hackathons ? (
                  <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                    🏆 {team.hackathons.title}
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                    🏳️ 자유 주제 팀
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">{team?.name}</h1>
              <p className="text-slate-500 mt-3 font-medium max-w-2xl leading-relaxed">{team?.description}</p>
            </div>
            
            <div className="flex gap-2">
              <div className="bg-slate-50 border border-slate-100 px-6 py-3 rounded-2xl">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">My Role</p>
                <p className="font-bold text-slate-900 flex items-center gap-2">
                  {isLeader ? <span className="text-yellow-500">👑 팀장</span> : <span className="text-blue-600">👤 팀원</span>}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Content */}
      <div className="max-w-7xl mx-auto px-6 mt-10">
        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit mb-8 shadow-sm">
          {[
            { id: 'teammates', label: '팀원 관리', icon: '🤝' },
            { id: 'chats', label: '팀 채팅', icon: '💬' },
            { id: 'board', label: '공지 게시판', icon: '📋' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-8 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id 
                ? 'bg-slate-900 text-white shadow-lg' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content Panels */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 min-h-[600px] overflow-hidden">
          
          {/* Teammates Section */}
          {activeTab === 'teammates' && (
            <div className="p-10">
              <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
                Team Members <span className="text-slate-300 font-medium text-sm">({members.length})</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((m) => {
                  const isMe = m.profiles.id === user?.id;
                  const isTargetLeader = m.profiles.id === team?.leader_id;
                  return (
                    <div key={m.id} className="p-6 border border-slate-100 bg-slate-50 rounded-3xl flex flex-col transition-all hover:border-blue-200">
                      <div className="flex items-center gap-4 mb-6">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-inner ${
                          isTargetLeader ? 'bg-yellow-400 text-white' : 'bg-white text-slate-400'
                        }`}>
                          {isTargetLeader ? '👑' : '👤'}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{m.role}</p>
                          <p className="font-bold text-slate-900 truncate">
                            {m.profiles.nickname} {isMe && <span className="text-xs font-medium text-slate-400 ml-1">(Me)</span>}
                          </p>
                        </div>
                      </div>
                      
                      {isLeader && !isMe && (
                        <div className="mt-auto pt-4 border-t border-slate-200/50 flex gap-2">
                          <button onClick={() => handleDelegate(m.profiles.id, m.profiles.nickname)} className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-white border border-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all">위임</button>
                          <button onClick={() => handleKick(m.profiles.id, m.profiles.nickname)} className="flex-1 py-2 rounded-xl text-[11px] font-bold bg-white border border-slate-200 hover:border-red-500 hover:text-red-600 transition-all">추방</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Chats Section (Modern Message Interface) */}
          {activeTab === 'chats' && (
            <div className="flex flex-col h-[650px]">
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-10 space-y-6 bg-slate-50/50">
                {messages.map((m, idx) => {
                  const isMe = m.sender_id === user?.id;
                  const isSystem = m.sender_id === null;
                  return (
                    <div key={idx} className={`flex ${isSystem ? 'justify-center' : isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] group`}>
                        {!isSystem && !isMe && (
                          <p className="text-[11px] font-bold text-slate-400 mb-1.5 ml-1">{m.profiles?.nickname}</p>
                        )}
                        <div className={`p-4 rounded-2xl text-sm font-medium shadow-sm ${
                          isSystem 
                          ? 'bg-slate-200 text-slate-500 text-xs px-6 py-2 rounded-full' 
                          : isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                        }`}>
                          {m.content}
                        </div>
                        {!isSystem && (
                          <p className={`text-[9px] font-bold text-slate-300 mt-1.5 ${isMe ? 'text-right mr-1' : 'text-left ml-1'}`}>
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-6 bg-white border-t border-slate-100">
                <form onSubmit={sendMessage} className="flex gap-3 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-200 focus-within:border-blue-500 transition-all">
                  <input 
                    className="flex-1 bg-transparent px-4 py-2 text-sm font-medium outline-none placeholder-slate-400" 
                    placeholder="팀원들에게 메시지를 남겨보세요..." 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                  />
                  <button type="submit" className="bg-slate-900 text-white px-8 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-600 transition-all">
                    전송
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Board Section (Modern Sidebar Layout) */}
          {activeTab === 'board' && (
            <div className="flex h-[650px]">
              {/* Board Sidebar */}
              <aside className="w-72 border-r border-slate-100 flex flex-col p-6">
                <button 
                  onClick={() => setBoardView('create')} 
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all mb-8"
                >
                  새 포스트 작성
                </button>
                
                <div className="flex-1 overflow-y-auto space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Recent Posts</p>
                  {posts.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => { setSelectedPost(p); setBoardView('detail'); }}
                      className={`w-full text-left p-4 rounded-2xl transition-all ${
                        selectedPost?.id === p.id && boardView === 'detail' 
                        ? 'bg-slate-900 text-white shadow-md' 
                        : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <h4 className="text-sm font-bold truncate mb-1">{p.title}</h4>
                      <p className={`text-[10px] font-medium ${selectedPost?.id === p.id && boardView === 'detail' ? 'text-slate-400' : 'text-slate-300'}`}>
                        {new Date(p.created_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
                
                <button 
                  onClick={() => setBoardView('list')} 
                  className="mt-4 py-3 text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors"
                >
                  전체 목록 보기
                </button>
              </aside>

              {/* Board Main Viewer */}
              <div className="flex-1 bg-slate-50/30 overflow-y-auto p-12">
                {boardView === 'list' && (
                  <div className="max-w-3xl mx-auto space-y-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-8">전체 게시글</h3>
                    {posts.map(p => (
                      <div 
                        key={p.id} 
                        onClick={() => { setSelectedPost(p); setBoardView('detail'); }} 
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div>
                          <h4 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{p.title}</h4>
                          <p className="text-[11px] text-slate-400 mt-1 font-medium">BY {p.profiles?.nickname} • {new Date(p.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className="text-slate-200 text-xl group-hover:text-blue-600 transition-colors">→</span>
                      </div>
                    ))}
                    {posts.length === 0 && (
                      <div className="text-center py-20 text-slate-300 font-bold uppercase tracking-widest italic">Board is Empty</div>
                    )}
                  </div>
                )}

                {boardView === 'create' && (
                  <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4">
                    <h3 className="text-2xl font-bold text-slate-900 mb-8 tracking-tight">Create Publication</h3>
                    <form onSubmit={handlePostSubmit} className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 ml-1">Title</label>
                        <input required className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 transition-all" placeholder="포스트 제목을 입력하세요" value={postForm.title} onChange={e => setPostForm({...postForm, title: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 ml-1">Content</label>
                        <textarea required className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl font-medium text-sm outline-none focus:border-blue-500 transition-all" rows={8} placeholder="공유할 내용을 작성하세요..." value={postForm.content} onChange={e => setPostForm({...postForm, content: e.target.value})} />
                      </div>
                      <div className="bg-white p-6 rounded-3xl border border-dashed border-slate-300 flex flex-col items-center justify-center gap-2">
                        <p className="text-[10px] font-black text-slate-400 uppercase">Attach Project Files</p>
                        <input type="file" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="text-xs font-bold text-slate-500" />
                      </div>
                      <div className="flex gap-3">
                        <button type="submit" className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all">Publish Post</button>
                        <button type="button" onClick={() => setBoardView('list')} className="px-8 py-4 text-sm font-bold text-slate-400">Cancel</button>
                      </div>
                    </form>
                  </div>
                )}

                {boardView === 'detail' && selectedPost && (
                  <div className="max-w-3xl mx-auto animate-in fade-in">
                    <div className="mb-12 border-b border-slate-100 pb-8">
                      <h3 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">{selectedPost.title}</h3>
                      <div className="flex items-center gap-4 mt-6">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-400 text-xs">👤</div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{selectedPost.profiles?.nickname}</p>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{new Date(selectedPost.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="text-lg text-slate-600 leading-relaxed whitespace-pre-wrap mb-12 font-medium">
                      {selectedPost.content}
                    </div>
                    {selectedPost.file_url && (
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">📎</span>
                          <span className="font-bold text-slate-700 text-sm truncate max-w-xs">{selectedPost.file_name}</span>
                        </div>
                        <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/team_boards/${selectedPost.file_url}`} target="_blank" className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-600 transition-all">Download</a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}