export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-xl w-40" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 bg-gray-200 rounded-xl" />
        <div className="h-14 bg-gray-200 rounded-xl" />
      </div>
      <div className="h-48 bg-gray-200 rounded-xl" />
      <div className="h-36 bg-gray-200 rounded-xl" />
    </div>
  );
}
