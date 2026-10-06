export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-[26px] bg-(--flow-peach)/45" />
      ))}
    </div>
  );
}
