import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <div className="text-9xl font-bold text-gray-200">404</div>
      <h2 className="text-2xl font-semibold">요청하신 페이지를 찾을 수 없습니다.</h2>
      <p className="text-gray-500">데이터가 삭제되었거나 잘못된 경로입니다.</p>
      <Link href="/" className="px-6 py-2 bg-gray-900 text-white rounded-lg">
        메인으로 돌아가기
      </Link>
    </div>
  );
}