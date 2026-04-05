'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function MailboxPage() {
  const { user, isInitialized } = useAuth();
  
  // UI 및 데이터 상태
  const [view, setView] = useState<'friends' | 'chats'>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [chatRooms, setChatRooms] = useState<any[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [acceptedMessageIds, setAcceptedMessageIds] = useState<string[]>([]);
  
  // 검색 및 로딩 상태
  const [searchNickname, setSearchNickname] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  /* -------------------------------------------------------------------------- */
  /* 1. 데이터 페칭 로직                                                           */
  /* -------------------------------------------------------------------------- */

  const fetchFriends = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('friends')
      .select('friend:profiles!friend_id(*)')
      .eq('user_id', user.id);
    if (data) setFriends(data.map(f => f.friend));
  }, [user]);

  const fetchChatRooms = useCallback(async () => {
    if (!user) return;
    const { data: participations } = await supabase
      .from('chat_participants')
      .select('room_id')
      .eq('user_id', user.id);
    
    if (participations) {
      const roomsWithPartner = await Promise.all(participations.map(async (item: any) => {
        const { data: participants } = await supabase
          .from('chat_participants')
          .select('profiles(id, nickname)')
          .eq('room_id', item.room_id);
        
        const partnerInfo = participants?.find((p: any) => p.profiles.id !== user.id);
        let nickname = '알 수 없는 유저';
        if (partnerInfo && partnerInfo.profiles) {
          const p = partnerInfo.profiles as any;
          nickname = Array.isArray(p) ? p[0]?.nickname : p.nickname;
        }
        return { id: item.room_id, partnerNickname: nickname };
      }));
      setChatRooms(roomsWithPartner);
    }
  }, [user]);

  const fetchMessages = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*, profiles:sender_id(id, nickname)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, []);

  // 초기 로드: 인증이 완료된 후 데이터 페칭 시작
  useEffect(() => {
    const initData = async () => {
      if (isInitialized && user) {
        setLoading(true);
        await Promise.all([fetchFriends(), fetchChatRooms()]);
        setLoading(false);
      } else if (isInitialized && !user) {
        setLoading(false);
      }
    };
    initData();
  }, [isInitialized, user, fetchFriends, fetchChatRooms]);

  /* -------------------------------------------------------------------------- */
  /* 2. 실시간 채팅 구독 및 액션                                                   */
  /* -------------------------------------------------------------------------- */

  useEffect(() => {
    if (!activeRoomId) return;
    fetchMessages(activeRoomId);

    const channel = supabase
      .channel(`room-${activeRoomId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages', 
        filter: `room_id=eq.${activeRoomId}` 
      }, () => fetchMessages(activeRoomId))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRoomId, fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeRoomId || !user) return;
    const content = newMessage;
    setNewMessage('');
    await supabase.from('chat_messages').insert([{ room_id: activeRoomId, sender_id: user.id, content }]);
  };

  const handleSearchUsers = async () => {
    if (!searchNickname.trim()) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, nickname')
      .ilike('nickname', `%${searchNickname}%`)
      .not('id', 'eq', user?.id)
      .limit(5);
    setSearchResults(data || []);
  };

  const addFriend = async (friendId: string) => {
    const { error } = await supabase.from('friends').insert([{ user_id: user.id, friend_id: friendId }]);
    if (error) alert("이미 친구이거나 추가할 수 없습니다.");
    else {
      alert("친구로 추가되었습니다!");
      fetchFriends();
      setSearchResults([]);
      setSearchNickname('');
    }
  };

  const startChat = async (friendId: string) => {
    const { data: existingRoomId } = await supabase.rpc('get_existing_1to1_room', { uid1: user?.id, uid2: friendId });
    if (existingRoomId) {
      setActiveRoomId(existingRoomId);
    } else {
      const { data: newRoom } = await supabase.from('chat_rooms').insert({}).select().single();
      if (newRoom) {
        await supabase.from('chat_participants').insert([{ room_id: newRoom.id, user_id: user?.id }, { room_id: newRoom.id, user_id: friendId }]);
        setActiveRoomId(newRoom.id);
        fetchChatRooms();
      }
    }
    setView('chats');
  };

  const handleAcceptJoin = async (meta: any, messageId: string) => {
  // 이미 처리 중인 경우 방지
  if (acceptedMessageIds.includes(messageId)) return;
  if (!confirm(`${meta.sender_nickname}님을 수락하시겠습니까?`)) return;

  try {
    // 1. 팀원으로 추가
    await supabase.from('team_members').insert([{ team_id: meta.team_id, user_id: meta.sender_id, role: '팀원' }]);
    
    // 2. 해커톤 참여 정보 업데이트
    if (meta.hackathon_id) {
      await supabase.from('hackathon_participants').insert([{ user_id: meta.sender_id, hackathon_id: meta.hackathon_id }]);
    }
    
    // [추가] 성공 시 해당 메시지 ID를 수락 완료 목록에 넣음
    setAcceptedMessageIds(prev => [...prev, messageId]);
    
    alert("팀 합류 처리가 완료되었습니다.");

    // 시스템 메시지 발송 (선택 사항)
    if (activeRoomId) {
      await supabase.from('chat_messages').insert([{
        room_id: activeRoomId,
        sender_id: user?.id,
        content: `🎊 [시스템] ${user?.nickname}님이 ${meta.sender_nickname}님의 합류 신청을 수락했습니다.`
      }]);
    }
  } catch (e) {
    alert("이미 처리되었거나 오류가 발생했습니다.");
  }
};

  /* -------------------------------------------------------------------------- */
  /* 3. 로딩 가드                                                                 */
  /* -------------------------------------------------------------------------- */

  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-white">
        <div className="w-12 h-12 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Opening Mailbox...</p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] bg-white">
        <p className="text-xl font-bold text-slate-900 mb-6">로그인이 필요한 페이지입니다.</p>
        <Link href="/login" className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">로그인 하러가기</Link>
      </div>
    );
  }

  return (
    <main className="flex h-[calc(100vh-64px)] bg-white overflow-hidden text-slate-900">
      {/* 1. Sidebar (Search & Lists) */}
      <aside className="w-80 md:w-96 border-r border-slate-100 bg-slate-50/50 flex flex-col">
        {/* View Toggle */}
        <div className="p-6 bg-white border-b border-slate-100">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setView('friends')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${view === 'friends' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              친구 목록
            </button>
            <button 
              onClick={() => setView('chats')}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${view === 'chats' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
            >
              채팅방
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {view === 'friends' ? (
            <>
              {/* User Search */}
              <div className="space-y-3">
                <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">유저 검색</p>
                <div className="flex gap-2">
                  <input 
                    className="flex-1 px-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:ring-2 ring-blue-500/20 outline-none transition-all"
                    placeholder="닉네임 입력..."
                    value={searchNickname}
                    onChange={e => setSearchNickname(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchUsers()}
                  />
                  <button onClick={handleSearchUsers} className="px-4 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors">검색</button>
                </div>
                {searchResults.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    {searchResults.map(u => (
                      <div key={u.id} className="flex justify-between items-center p-3 border-b border-slate-50 last:border-none">
                        <span className="text-sm font-bold">{u.nickname}</span>
                        <button onClick={() => addFriend(u.id)} className="text-[10px] font-bold text-blue-600 hover:underline">친구 추가</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Friends List */}
              <div className="space-y-3">
                <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">나의 친구 ({friends.length})</p>
                {friends.map(f => (
                  <div key={f.id} className="group flex justify-between items-center p-4 bg-white border border-slate-200 rounded-2xl hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/5 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-xs">👤</div>
                      <span className="text-sm font-bold">{f.nickname}</span>
                    </div>
                    <button 
                      onClick={() => startChat(f.id)}
                      className="px-3 py-1.5 bg-slate-50 text-slate-900 rounded-lg text-[11px] font-bold hover:bg-blue-600 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                    >
                      채팅하기
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">열린 대화함</p>
              {chatRooms.map(room => (
                <div 
                  key={room.id}
                  onDoubleClick={() => setActiveRoomId(room.id)}
                  className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                    activeRoomId === room.id 
                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">💬</span>
                    <div>
                      <p className="font-bold text-sm">{room.partnerNickname}</p>
                      <p className={`text-[10px] font-medium ${activeRoomId === room.id ? 'text-blue-100' : 'text-slate-400'}`}>Double click to open</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* 2. Main Chat Area */}
      <section className="flex-1 flex flex-col bg-white relative">
        {activeRoomId ? (
          <>
            {/* Chat Header */}
            <header className="p-6 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-400 rounded-xl flex items-center justify-center text-xl shadow-sm">💬</div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Active Stream</h2>
                  <p className="text-xs text-slate-400 font-medium">연결됨 • 실시간 업데이트 중</p>
                </div>
              </div>
              <button onClick={() => setActiveRoomId(null)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </header>

            {/* Messages Container */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-50/30">
              {messages.map((m: any, idx) => {
                const isMe = m.sender_id === user?.id;
                const senderData = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
                const isJoinRequest = (m as any).metadata?.type === 'join_request';

                return (
                  <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    <div className={`flex items-start gap-3 max-w-[80%] ${isMe ? 'flex-row-reverse' : ''}`}>
                      {!isMe && (
                        <Link href={`/profile/${m.sender_id}`} className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-sm shadow-sm hover:ring-2 ring-blue-500 transition-all shrink-0">
                          👤
                        </Link>
                      )}
                      
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && <span className="text-[11px] font-bold text-slate-400 mb-1.5 ml-1">{senderData?.nickname || 'Unknown'}</span>}
                        <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed shadow-sm ${
                          isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                        }`}>
                          {m.content}
                          
                          {/* Join Request UI - 채팅 메시지 매핑 내부 */}
{isJoinRequest && !isMe && (
  <div className="mt-4 p-4 bg-slate-900 rounded-xl text-white space-y-3">
    <p className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Join Request</p>
    <p className="text-xs font-bold">{m.metadata.sender_nickname} ({m.metadata.sender_points || 0} pts)</p>
    <button 
      // [수정 포인트] 상태에 따른 비활성화 및 문구 변경
      disabled={acceptedMessageIds.includes(m.id)}
      onClick={() => handleAcceptJoin(m.metadata, m.id)} 
      className={`w-full py-2.5 rounded-lg text-[11px] font-black transition-all shadow-lg ${
        acceptedMessageIds.includes(m.id)
          ? 'bg-slate-700 text-slate-400 cursor-not-allowed shadow-none'
          : 'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20'
      }`}
    >
      {acceptedMessageIds.includes(m.id) ? '수락 완료' : '수락하기'}
    </button>
  </div>
)}
                        </div>
                        <span className="text-[9px] text-slate-300 mt-1.5 font-bold uppercase">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input Area */}
            <form onSubmit={sendMessage} className="p-6 bg-white border-t border-slate-100">
              <div className="relative flex items-center">
                <input 
                  className="flex-1 p-4 pr-32 bg-slate-50 border-none rounded-2xl font-bold text-sm outline-none focus:ring-2 ring-blue-500/10 placeholder-slate-300 transition-all" 
                  placeholder="메시지를 입력하세요..." 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)} 
                />
                <button className="absolute right-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-black transition-all">
                  SEND
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-100 p-10">
            <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center text-5xl mb-8">📫</div>
            <h3 className="text-2xl font-black text-slate-200 uppercase tracking-tighter">Your Mailbox is Ready</h3>
            <p className="text-slate-300 font-bold mt-2">왼쪽 리스트에서 대화방을 선택해 주세요.</p>
          </div>
        )}
      </section>
    </main>
  );
}