export default function Loading() {
  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6">
      <div className="h-10 w-48 bg-gray-200 animate-pulse rounded" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-64 bg-gray-200 animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  );
}