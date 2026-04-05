'use client';

import Link from 'next/link';

interface HackathonProps {
  slug: string;
  title: string;
  status: '진행중' | '마감' | '예정' | '종료됨';
  tags: string[] | null;
  startDate: string;
  endDate: string;
  participants: number;
}

export default function HackathonCard({ 
  slug, 
  title, 
  status, 
  tags, 
  startDate, 
  endDate, 
  participants 
}: HackathonProps) {
  
  // 상태별 스타일 지정
  const getStatusStyles = (status: string) => {
    switch (status) {
      case '진행중':
        return 'bg-blue-600 text-white';
      case '예정':
        return 'bg-yellow-400 text-black';
      case '마감':
      case '종료됨':
        return 'bg-slate-100 text-slate-400';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <Link 
      href={`/hackathons/${slug}`} 
      className="group block bg-white border border-slate-100 rounded-3xl p-7 transition-all duration-300 hover:border-blue-500 hover:shadow-[0_20px_50px_rgba(37,99,235,0.1)] h-full flex flex-col"
    >
      {/* 상단: 상태 및 참여자 수 */}
      <div className="flex justify-between items-center mb-6">
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusStyles(status)}`}>
          {status}
        </span>
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="text-xs font-bold">👤 {participants.toLocaleString()}</span>
        </div>
      </div>

      {/* 중단: 제목 */}
      <h3 className="text-xl font-bold text-slate-900 mb-4 leading-snug group-hover:text-blue-600 transition-colors line-clamp-2 min-h-[3.5rem] tracking-tight">
        {title}
      </h3>

      {/* 하단: 태그 목록 */}
      <div className="flex flex-wrap gap-1.5 mb-8">
        {tags && tags.length > 0 ? (
          tags.slice(0, 3).map((tag) => (
            <span 
              key={tag} 
              className="text-[10px] font-extrabold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-md group-hover:text-blue-500 group-hover:bg-blue-50 transition-colors"
            >
              #{tag.toUpperCase()}
            </span>
          ))
        ) : (
          <span className="text-[10px] font-bold text-slate-300 italic">#GENERAL</span>
        )}
        {tags && tags.length > 3 && (
          <span className="text-[10px] font-bold text-slate-300">+{tags.length - 3}</span>
        )}
      </div>

      {/* 푸터: 기간 정보 */}
      <div className="mt-auto pt-5 border-t border-slate-50 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-300 uppercase tracking-tighter mb-0.5">Event Period</span>
          <span className="text-[12px] font-bold text-slate-500 tracking-tight">
            {startDate} — {endDate}
          </span>
        </div>
        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition-all">
          <span className="text-sm font-bold">→</span>
        </div>
      </div>
    </Link>
  );
}