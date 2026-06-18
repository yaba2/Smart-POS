export default function AdminLoading() {
  return (
    <div className="flex-1 p-4 md:p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-gray-200 rounded-lg" />
      <div className="h-4 w-32 bg-gray-100 rounded" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-2xl border border-gray-200" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-2xl border border-gray-200 mt-4" />
    </div>
  );
}
