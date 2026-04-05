'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const { user, isInitialized } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // UI 상태 관리
  const [isCampDropdownOpen, setIsCampDropdownOpen] = useState(false);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNoti, setLoadingNoti] = useState(true);

  // 알림 데이터 가져오기
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoadingNoti(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setNotifications(data);
    setLoadingNoti(false);
  }, [user]);

  // 실시간 알림 및 채팅 감지 로직
  useEffect(() => {
    if (!user || !isInitialized) return;

    fetchNotifications();

    const channel = supabase
      .channel(`navbar-realtime-${user.id}`)
      // 1. 일반 알림 감지
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications', 
        filter: `user_id=eq.${user.id}` 
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      // 2. 채팅 메시지 감지 -> 알림화
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages' 
      }, async (payload) => {
        if (payload.new.sender_id === user.id) return;

        const { data: part } = await supabase
          .from('chat_participants')
          .select('id')
          .eq('room_id', payload.new.room_id)
          .eq('user_id', user.id)
          .single();

        if (part) {
          const { data: sender } = await supabase.from('profiles').select('nickname').eq('id', payload.new.sender_id).single();
          const chatNoti = {
            id: `chat-${payload.new.id}`,
            content: `${sender?.nickname || '시스템'}님으로부터 새 메시지가 도착했습니다.`,
            link: `/profile/mails?room=${payload.new.room_id}`,
            is_read: false,
            created_at: payload.new.created_at
          };
          setNotifications(prev => [chatNoti, ...prev]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, isInitialized, fetchNotifications]);

  const handleNotiClick = async (noti: any) => {
    if (typeof noti.id === 'number') {
      await supabase.from('notifications').update({ is_read: true }).eq('id', noti.id);
    }
    setNotifications(prev => prev.map(n => n.id === noti.id ? { ...n, is_read: true } : n));
    setIsNotiOpen(false);
    router.push(noti.link);
  };

  // 인증 시스템 초기화 전에는 아무것도 렌더링하지 않거나 최소한의 로고만 표시 (로딩 문제 해결)
  if (!isInitialized) {
    return (
      <nav className="h-16 border-b border-slate-100 bg-white sticky top-0 z-[100]">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center">
          <div className="text-2xl font-black text-blue-600 tracking-tighter">해껍</div>
        </div>
      </nav>
    );
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <nav className="border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-md z-[100] transition-all">
      <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
        
        {/* 왼쪽 로고 및 메인 메뉴 */}
        <div className="flex items-center gap-12">
          <Link href="/" className="text-2xl font-black text-slate-900 tracking-tighter hover:text-blue-600 transition-colors">
            해껍
          </Link>
          
          <div className="hidden md:flex gap-8 text-[13px] font-bold text-slate-500 items-center">
            <Link 
              href="/hackathons" 
              className={`hover:text-slate-900 transition-colors ${pathname.startsWith('/hackathons') ? 'text-blue-600' : ''}`}
            >
              해커톤
            </Link>

            {/* 팀원 모집 드롭다운 */}
            <div 
              className="relative py-5 group"
              onMouseEnter={() => setIsCampDropdownOpen(true)}
              onMouseLeave={() => setIsCampDropdownOpen(false)}
            >
              <button className={`flex items-center gap-1.5 hover:text-slate-900 transition-colors ${pathname === '/camp' || pathname === '/teamboard' ? 'text-blue-600' : ''}`}>
                팀원 모집
                <span className={`text-[8px] transition-transform duration-300 ${isCampDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
              
              {isCampDropdownOpen && (
                <div className="absolute top-full left-0 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <Link href="/camp" className="block px-5 py-4 hover:bg-slate-50 border-b border-slate-50 transition-colors">
                    <p className="text-slate-900 font-bold">🏕️ 팀 찾기 / 만들기</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">나만의 팀을 구성해보세요</p>
                  </Link>
                  <Link href="/teamboard" className="block px-5 py-4 hover:bg-slate-50 transition-colors">
                    <p className="text-slate-900 font-bold">📋 모집 게시판</p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">등록된 공고를 확인하세요</p>
                  </Link>
                </div>
              )}
            </div>

            <Link 
              href="/rankings" 
              className={`hover:text-slate-900 transition-colors ${pathname === '/rankings' ? 'text-blue-600' : ''}`}
            >
              랭킹
            </Link>
          </div>
        </div>

        {/* 오른쪽 유저 유틸리티 */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* 알림함 드롭다운 */}
              <div className="relative">
                <button 
                  onClick={() => setIsNotiOpen(!isNotiOpen)}
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border border-slate-100 transition-all hover:bg-slate-50 relative ${unreadCount > 0 ? 'bg-yellow-50' : 'bg-white'}`}
                >
                  <span className="text-lg">🔔</span>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {isNotiOpen && (
                  <div className="absolute top-full right-0 mt-4 w-80 bg-white border border-slate-100 rounded-2xl shadow-2xl shadow-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                      <span className="font-bold text-xs text-slate-400 uppercase tracking-widest">Recent Notifications</span>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div 
                            key={n.id} 
                            onClick={() => handleNotiClick(n)}
                            className={`p-5 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-blue-50/30' : ''}`}
                          >
                            <p className="text-[13px] font-semibold text-slate-800 leading-snug">{n.content}</p>
                            <p className="text-[10px] text-slate-400 mt-2 font-medium uppercase tracking-tight">{new Date(n.created_at).toLocaleTimeString()}</p>
                          </div>
                        ))
                      ) : (
                        <div className="p-12 text-center text-slate-300 font-bold text-xs uppercase tracking-widest italic">
                          Everything is clear
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 마이팀 버튼 */}
              <Link 
                href="/myteams" 
                className={`px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all border ${
                  pathname.startsWith('/myteams') 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' 
                    : 'bg-white text-slate-600 border-slate-100 hover:bg-slate-50'
                }`}
              >
                🚩 마이팀
              </Link>

              {/* 내 정보 버튼 (원형 프로필 느낌) */}
              <Link 
                href="/profile" 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 text-white font-black text-xs hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
              >
                {user.nickname.substring(0, 2).toUpperCase()}
              </Link>
            </>
          ) : (
            <Link 
              href="/login" 
              className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[13px] font-black hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 hover:shadow-blue-200"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}