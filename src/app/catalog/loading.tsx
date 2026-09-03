export default function Loading() {
  return (
    <section className="container-luxe py-16">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-cream" />
      <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded bg-cream/70" />
      <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="aspect-[3/4] animate-pulse rounded-2xl bg-cream/60"
          />
        ))}
      </div>
    </section>
  );
}
