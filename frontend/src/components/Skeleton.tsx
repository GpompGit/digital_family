// =============================================================================
// Skeleton.tsx — Loading Skeleton Components
// =============================================================================
//
// WHAT ARE SKELETON SCREENS?
// Instead of showing "Loading..." text, skeleton screens show gray pulsing
// shapes that approximate the layout of the content that's loading.
// This gives users a visual hint of what's coming and feels much faster
// than a blank page or a loading spinner.
//
// Think of it like seeing the outline of a newspaper before the text appears.
//
// HOW TO USE:
//   <SkeletonDocumentList count={5} />   ← shows 5 fake document cards
//   <SkeletonDocumentDetail />           ← shows a fake document detail page
//   <SkeletonLine width="w-3/4" />       ← shows a single pulsing line
//
// The "animate-pulse" Tailwind class makes elements gently fade in and out,
// creating the classic skeleton loading effect.
// =============================================================================

// A single pulsing rectangle — the building block for all skeletons
export function SkeletonLine({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`${width} ${height} bg-gray-200 rounded animate-pulse`} />;
}

// A skeleton that looks like a document card (matches DashboardPage list items)
export function SkeletonDocumentCard() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine width="w-2/3" height="h-5" />
          <div className="flex gap-3">
            <SkeletonLine width="w-20" height="h-5" />
            <SkeletonLine width="w-24" height="h-3" />
            <SkeletonLine width="w-16" height="h-3" />
            <SkeletonLine width="w-20" height="h-3" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Multiple document card skeletons (for the document list while loading)
export function SkeletonDocumentList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonDocumentCard key={i} />
      ))}
    </div>
  );
}

// A skeleton that looks like the document detail page (PDF preview + metadata)
export function SkeletonDocumentDetail() {
  return (
    <div className="max-w-lg mx-auto">
      <SkeletonLine width="w-16" height="h-4" />
      <div className="bg-white rounded-xl shadow-sm p-6 mt-4">
        {/* PDF thumbnail placeholder */}
        <div className="flex justify-center mb-5">
          <div className="w-[280px] h-[360px] bg-gray-200 rounded-lg animate-pulse" />
        </div>
        {/* Title and category */}
        <SkeletonLine width="w-3/4" height="h-6" />
        <div className="mt-2 mb-4">
          <SkeletonLine width="w-24" height="h-5" />
        </div>
        {/* Metadata rows */}
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex justify-between">
              <SkeletonLine width="w-24" height="h-4" />
              <SkeletonLine width="w-32" height="h-4" />
            </div>
          ))}
        </div>
        {/* Action buttons */}
        <div className="mt-6 space-y-2">
          <SkeletonLine width="w-full" height="h-10" />
          <div className="grid grid-cols-2 gap-2">
            <SkeletonLine width="w-full" height="h-10" />
            <SkeletonLine width="w-full" height="h-10" />
          </div>
        </div>
      </div>
    </div>
  );
}
