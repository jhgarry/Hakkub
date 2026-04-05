'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <h2 className="text-2xl font-bold text-red-600">문제가 발생했습니다!</h2>
      {/* <p className="text-gray-500">{error.message || "알 수 없는 오류가 발생했습니다."}</p> */}
      <p className="text-gray-500">{"시스템 관리자에게 문의하세요."}</p>
      <button
        onClick={() => reset()}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        다시 시도하기
      </button>
    </div>
  );
}