import { TRUST_PIPELINE } from "@/lib/marketing/testmain-content";

export function TrustPipelineSection() {
  return (
    <section className="border-y hairline bg-ink text-paper">
      <div className="container-luxe py-20">
        <div className="max-w-2xl">
          <p className="eyebrow !text-brass-soft">Privacy &amp; trust</p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            Your photos stay yours — from upload to delete.
          </h2>
          <p className="mt-4 text-paper/70">
            Before you share a portrait, you should know exactly what happens
            next. This is the same flow you see on{" "}
            <span className="text-paper">/start</span>.
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_PIPELINE.map((item, i) => (
            <li
              key={item.step}
              className="rounded-2xl border border-paper/15 bg-ink-soft/60 p-6"
            >
              <div className="font-display text-3xl text-brass-soft/80">
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 className="mt-3 font-display text-xl">{item.step}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/65">
                {item.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
