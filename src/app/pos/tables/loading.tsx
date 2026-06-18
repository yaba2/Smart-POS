export default function Loading() {
  return (
    <div className="h-full overflow-auto p-4 md:p-6 animate-pulse">
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-xl h-16" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="bg-gray-200 rounded-2xl h-[130px]" />
        ))}
      </div>
    </div>
  );
}
