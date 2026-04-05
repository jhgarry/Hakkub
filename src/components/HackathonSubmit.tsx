'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function HackathonSubmit({ hackathonId, isEnded }: any) {
  const { user, isInitialized } = useAuth();
  
  // 데이터 상태
  const [myTeam, setMyTeam] = useState<any>(null);
  const [hackathonConfig, setHackathonConfig] = useState<any>(null);
  const [projectTitle, setProjectTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  
  // 로딩 상태 (초기값 true)
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user || !hackathonId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // 1. 해커톤 설정(확장자 등) 로드
      const { data: hConfig } = await supabase
        .from('hackathons')
        .select('allowed_extensions')
        .eq('id', hackathonId)
        .single();
      if (hConfig) setHackathonConfig(hConfig);

      // 2. 사용자가 이 해커톤에 팀장으로 참여 중인지 확인
      const { data: teamData } = await supabase
        .from('hackathon_teams')
        .select('*')
        .eq('hackathon_id', hackathonId)
        .eq('leader_id', user.id)
        .single();

      if (teamData) {
        setMyTeam(teamData);
        // 3. 기존 제출물 로드
        const { data: subData } = await supabase
          .from('hackathon_submissions')
          .select('*')
          .eq('hackathon_id', hackathonId)
          .eq('team_id', teamData.id)
          .single();
        
        if (subData) {
          setExistingSubmission(subData);
          setProjectTitle(subData.project_title || '');
          setDescription(subData.description || '');
        }
      }
    } catch (err) {
      console.error("Error fetching submission data:", err);
    } finally {
      setLoading(false);
    }
  }, [user, hackathonId]);

  useEffect(() => {
    // 인증 시스템이 준비되었을 때만 데이터 로드 시작
    if (isInitialized) {
      fetchData();
    }
  }, [isInitialized, fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myTeam || isEnded) return;

    try {
      let fileUrl = existingSubmission?.file_url;
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${hackathonId}/${myTeam.id}_${Date.now()}.${fileExt}`;
        const { data: upData, error: upErr } = await supabase.storage
          .from('submissions')
          .upload(fileName, selectedFile, { upsert: true });
        
        if (upErr) throw upErr;
        fileUrl = upData.path;
      }

      const payload = {
        hackathon_id: hackathonId,
        team_id: myTeam.id,
        user_id: user.id,
        project_title: projectTitle,
        description: description,
        file_url: fileUrl,
        updated_at: new Date()
      };

      const { error } = existingSubmission 
        ? await supabase.from('hackathon_submissions').update(payload).eq('id', existingSubmission.id)
        : await supabase.from('hackathon_submissions').insert([payload]);

      if (error) throw error;

      alert("제출물이 성공적으로 저장되었습니다.");
      fetchData();
      setSelectedFile(null);
    } catch (err: any) {
      alert("처리 중 오류가 발생했습니다: " + err.message);
    }
  };

  /* --- [1] 로딩 가드: 인증 초기화 및 데이터 로딩 확인 --- */
  if (!isInitialized || loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-slate-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Connecting to Workspace</p>
        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">로딩이 오래 걸리면 새로고침을 해 보세요!</p>
      </div>
    );
  }

  /* --- [2] 권한 가드: 팀장이 아닐 경우 --- */
  if (!myTeam) {
    return (
      <div className="max-w-2xl mx-auto p-12 text-center bg-slate-50 border border-slate-100 rounded-[2rem]">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-2xl mx-auto mb-6 shadow-sm">🔒</div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">접근 권한 제한</h3>
        <p className="text-slate-500 font-medium leading-relaxed">
          이 프로젝트의 제출 및 수정은<br />
          <span className="text-blue-600 font-bold">팀장(Leader)</span>만 수행할 수 있습니다.
        </p>
      </div>
    );
  }

  /* --- [3] 메인 제출 UI: 모던 & 밝은 디자인 --- */
  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in duration-500">
      
      {/* 제출 가이드 섹션 (Blue 포인트) */}
      <div className="bg-blue-50 border border-blue-100 p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16"></div>
        <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-[10px] rounded-full">!</span>
          제출 전 가이드라인
        </h3>
        <ul className="space-y-3 text-sm text-blue-800/80 font-medium">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>허용된 파일 확장자: <strong className="text-blue-700 underline decoration-2 underline-offset-4">{hackathonConfig?.allowed_extensions || '.zip'}</strong></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>현재 팀장 <strong className="text-blue-700">{user.nickname}</strong>님으로 로그인되어 있습니다.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>해커톤 종료 전까지 결과물을 자유롭게 수정 및 재업로드할 수 있습니다.</span>
          </li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-2">
        {/* 프로젝트 제목 입력 */}
        <div>
          <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 ml-1">
            Project Title <span className="text-red-500">*</span>
          </label>
          <input 
            required 
            disabled={isEnded} 
            placeholder="프로젝트의 이름을 입력하세요"
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all" 
            value={projectTitle} 
            onChange={e => setProjectTitle(e.target.value)} 
          />
        </div>

        {/* 프로젝트 설명 입력 */}
        <div>
          <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 ml-1">
            Description
          </label>
          <textarea 
            disabled={isEnded} 
            rows={5} 
            placeholder="프로젝트에 대한 간단한 설명을 적어주세요."
            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-medium text-slate-600 outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all resize-none" 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
          />
        </div>

        {/* 파일 업로드 (Modern 드래그 앤 드롭 스타일) */}
        <div>
          <label className="block text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 ml-1">
            Result File Upload <span className="text-red-500">*</span>
          </label>
          <input 
            type="file" 
            id="hack-file" 
            className="hidden" 
            accept={hackathonConfig?.allowed_extensions} 
            onChange={e => setSelectedFile(e.target.files?.[0] || null)} 
          />
          <div 
            onClick={() => !isEnded && document.getElementById('hack-file')?.click()}
            className={`group border-2 border-dashed rounded-[2rem] p-12 text-center transition-all ${
              isEnded 
                ? 'bg-slate-50 border-slate-200 cursor-not-allowed' 
                : 'bg-white border-slate-200 hover:border-blue-500 hover:bg-blue-50/30 cursor-pointer'
            }`}
          >
            <div className="mb-4 text-3xl transition-transform group-hover:scale-110">
              {selectedFile || existingSubmission ? '📄' : '☁️'}
            </div>
            <p className={`font-bold mb-1 ${selectedFile || existingSubmission ? 'text-blue-600' : 'text-slate-900'}`}>
              {selectedFile ? selectedFile.name : existingSubmission ? '기존 제출 파일이 존재합니다' : '파일을 선택하거나 드래그하세요'}
            </p>
            <p className="text-xs text-slate-400 font-medium">
              {selectedFile || existingSubmission ? '클릭하여 파일 변경' : `${hackathonConfig?.allowed_extensions} 형식만 가능`}
            </p>
          </div>
        </div>

        {/* 제출 버튼 (Black & Yellow 포인트) */}
        <div className="pt-4">
          <button 
            type="submit"
            disabled={isEnded} 
            className={`w-full py-5 rounded-[2rem] font-black text-lg shadow-xl transition-all flex items-center justify-center gap-3 ${
              isEnded 
                ? 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed' 
                : existingSubmission 
                  ? 'bg-slate-900 text-white hover:bg-blue-600 active:scale-95' 
                  : 'bg-blue-600 text-white hover:bg-slate-900 active:scale-95'
            }`}
          >
            {isEnded ? (
              <>SESSION ENDED</>
            ) : (
              <>
                {existingSubmission ? '✏️ UPDATE SUBMISSION' : '🚀 SUBMIT PROJECT'}
                {!existingSubmission && <span className="text-yellow-400 text-sm">FREE</span>}
              </>
            )}
          </button>
          {!isEnded && (
            <p className="text-center text-[10px] text-slate-400 mt-4 font-bold uppercase tracking-widest italic">
              제출 시 모든 팀원이 해당 결과물을 공유하게 됩니다
            </p>
          )}
        </div>
      </form>
    </div>
  );
}