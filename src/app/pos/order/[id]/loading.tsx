export default function Loading() {
  return (
    <div className="flex h-full animate-pulse">
      {/* Menu panel skeleton */}
      <div className="flex-1 flex flex-col p-4 gap-3">
        <div className="h-10 bg-gray-200 rounded-xl w-2/3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 flex-1">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-gray-200 rounded-xl h-24" />
          ))}
        </div>
      </div>
      {/* Order panel skeleton */}
      <div className="w-80 border-l border-gray-100 p-4 flex flex-col gap-3">
        <div className="h-8 bg-gray-200 rounded-xl" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-200 rounded-xl" />
        ))}
        <div className="mt-auto h-12 bg-gray-300 rounded-xl" />
      </div>
    </div>
  );
}
