export function Skeleton({ className = "", light = false }: { className?: string; light?: boolean }) {
  return <div className={`${light ? "skeleton-light" : "skeleton"} ${className}`} />
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="bg-white rounded-3xl overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}
          className={`flex items-center gap-4 px-5 py-4 ${i < count - 1 ? "border-b border-gray-100" : ""}`}>
          <Skeleton light className="w-8 h-8 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton light className="h-3.5 w-2/3" />
            <Skeleton light className="h-3 w-1/3" />
          </div>
          <Skeleton light className="h-4 w-16 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-white rounded-3xl px-5 py-6 space-y-3 ${className}`}>
      <Skeleton light className="h-4 w-1/3" />
      <Skeleton light className="h-8 w-2/3" />
      <Skeleton light className="h-3 w-1/2" />
    </div>
  )
}
