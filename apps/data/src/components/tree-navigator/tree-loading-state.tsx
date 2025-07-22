export function TreeLoadingState() {
  return (
    <div className="p-4">
      <div className="animate-pulse space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}