export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="h-56 animate-pulse rounded-[2rem] bg-secondary/50" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-[1.75rem] bg-secondary/50" />
          <div className="h-24 animate-pulse rounded-[1.75rem] bg-secondary/50" />
          <div className="h-24 animate-pulse rounded-[1.75rem] bg-secondary/50" />
          <div className="h-24 animate-pulse rounded-[1.75rem] bg-secondary/50" />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-48 animate-pulse rounded-[1.75rem] bg-secondary/45" />
        <div className="h-48 animate-pulse rounded-[1.75rem] bg-secondary/45" />
        <div className="h-48 animate-pulse rounded-[1.75rem] bg-secondary/45" />
      </section>
    </div>
  );
}
