export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded-xl w-48" />
      <div className="h-14 bg-gray-200 rounded-xl" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-36 bg-gray-200 rounded-xl" />
      ))}
    </div>
  );
}
