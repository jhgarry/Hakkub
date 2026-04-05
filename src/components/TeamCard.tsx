interface TeamProps {
  name: string;
  description: string;
  isRecruiting: boolean;
  positions: string[];
  contactUrl: string;
}

export default function TeamCard({ name, description, isRecruiting, positions, contactUrl }: TeamProps) {
  return (
    <div className="bg-white border rounded-xl p-6 shadow-sm hover:border-blue-300 transition-colors">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-gray-800">{name}</h3>
        {isRecruiting ? (
          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-bold">모집중</span>
        ) : (
          <span className="text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded-full font-bold">모집종료</span>
        )}
      </div>
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{description}</p>
      <div className="flex flex-wrap gap-1 mb-4">
        {positions.map(pos => (
          <span key={pos} className="text-[11px] border border-gray-200 px-2 py-0.5 rounded text-gray-500">{pos}</span>
        ))}
      </div>
      <a 
        href={contactUrl} 
        target="_blank" 
        className="block text-center w-full py-2 bg-gray-50 text-sm font-semibold rounded-lg hover:bg-blue-600 hover:text-white transition"
      >
        연락하기
      </a>
    </div>
  );
}