# 해껍
**개발자들을 위한 해커톤 커뮤니티 플랫폼**

해껍은 혁신적인 아이디어를 가진 개발자들이 팀을 구성하고, 해커톤에 참여하며, 실시간으로 소통하고 성장할 수 있는 최적의 환경을 제공합니다.

![Next.js](https://img.shields.io/badge/Next.js-14+-000000?style=for-the-badge&logo=nextdotjs)
![Supabase](https://img.shields.io/badge/Supabase-DB%20%26%20Auth-3ECF8E?style=for-the-badge&logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-Modern_UI-38B2AC?style=for-the-badge&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Type-3178C6?style=for-the-badge&logo=typescript)

---

## ✨ 핵심 기능 (Key Features)

### 🏟️ 해커톤 매니지먼트
- **해커톤 탐색**: 진행 중, 예정, 종료된 대회를 필터링하여 확인.
- **찜하기 시스템**: 관심 있는 해커톤을 저장하고 참여 인원 통계에 실시간 반영.
- **프로젝트 제출**: 팀장 전용 제출 창구 기능.

### 🏕️ 팀 빌딩 및 모집 (Camp)
- **팀원 모집 게시판**: 해커톤별/자유 주제별 팀원 모집 공고글 관리.
- **합류 신청 프로세스**: 닉네임 검색과 친구 목록을 활용한 간편한 초대 및 합류 승인 시스템.
- **개인 참가**: 1인 팀 구성을 통한 즉시 참여 지원.

### 💬 커뮤니케이션 & 협업
- **실시간 채팅**: Supabase Realtime을 이용한 1:1 대화 및 팀 단체 채팅.
- **마이팀 워크스페이스**: 팀 전용 게시판(파일 첨부 지원), 팀원 관리(위임/추방).
- **실시간 알림**: 새로운 메시지 및 팀 초대/합류 신청 알림 제공.

### 🏆 랭킹 및 프로필
- **명예의 전당**: 개인 포인트 및 해커톤 팀 점수 기반의 랭킹 시스템.
- **공개 프로필**: 타 사용자의 활동 내역 및 포인트를 확인하고 친구 추가 가능.

### 🛠️ 관리자 대시보드 (Admin)
- **이벤트 운영**: 해커톤 등록, 진행 상태 제어, 허용 확장자 설정.
- **포인트 정산**: 팀 점수 부여 및 해커톤 종료 시 팀원들에게 1/N 자동 포인트 분배 로직.

---

## 🎨 디자인 시스템 (UI/UX)
- **Modern & Minimalist**: 가독성을 최우선으로 한 깔끔하고 밝은 화이트 테마.
- **Point Colors**: 
  - 🔵 **Blue**: 주요 액션 및 신뢰감 형성.
  - ⚫ **Black**: 텍스트 명시성 및 무게감.
  - 🟡 **Yellow**: 주목이 필요한 알림 및 강조 포인트.
- **Responsive**: 모바일과 데스크톱 모두에 최적화된 유동적인 레이아웃.

---

## 🛠️ 기술 스택 (Tech Stack)

| Category | Tech |
| :--- | :--- |
| **Frontend** | Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion |
| **Backend/BaaS** | Supabase (PostgreSQL, Auth, Realtime, Storage) |
| **Deployment** | Vercel |
| **State Management** | React Context API (Auth Context) |

---

## ⚙️ 시작하기 (Getting Started)

### 1. 환경 변수 설정
프로젝트 루트에 `.env.local` 파일을 생성하고 Supabase 정보를 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. 패키지 설치 및 실행
```bash
npm install
npm run dev
```

---

## 📂 프로젝트 구조 (Structure)

```text
src/
├── app/                  # Next.js App Router (Pages)
│   ├── admin/            # 관리자 페이지
│   ├── hackatons/        # 해커톤 목록 및 상세
│   ├── myteams/          # 팀 워크스페이스
│   ├── profile/          # 마이페이지 및 메시지함
│   └── rankings/         # 랭킹 시스템
├── components/           # 재사용 가능한 UI 컴포넌트
├── context/              # AuthContext (인증 및 상태 가드)
├── lib/                  # Supabase 클라이언트 설정
└── types/                # 공통 타입 정의
```

---

## 🔒 보안 및 최적화
- **Auth Initialization Guard**: 페이지 로드 시 인증 세션 확인 전 본문 렌더링을 차단하여 보안 및 사용자 경험 최적화.
- **Row Level Security (RLS)**: 데이터베이스 수준에서의 접근 제어를 통한 사용자 데이터 보호.
- **Optimistic UI**: 메시지 전송 시 즉각적인 피드백을 위한 낙관적 업데이트 적용.

---

## 👨‍💻 제작 (Author)
- **jhgarry** - [프로필](https://github.com/jhgarry)
-  이 프로젝트는 Google AI Studio를 사용하여 제작하였습니다.
---

**해껍**과 함께 당신의 개발 여정을 시작해 보세요! 🚀
