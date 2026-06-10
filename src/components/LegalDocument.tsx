import Link from "next/link";
import type { LegalSection } from "@/lib/legal";

export function LegalDocument({
  title,
  intro,
  lastUpdated,
  sections,
  relatedHref,
  relatedLabel,
}: {
  title: string;
  intro: string;
  lastUpdated: string;
  sections: LegalSection[];
  relatedHref?: string;
  relatedLabel?: string;
}) {
  return (
    <article className="max-w-3xl">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 text-sm text-stone-soft">Last updated: {lastUpdated}</p>
      <p className="mt-6 text-lg leading-relaxed text-stone">{intro}</p>

      <div className="mt-14 space-y-12">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="font-display text-2xl text-ink">{s.title}</h2>
            <div className="mt-4 space-y-4 text-sm leading-relaxed text-stone">
              {s.paragraphs.map((p) => (
                <p key={p.slice(0, 48)}>{p}</p>
              ))}
              {s.list && (
                <ul className="list-disc space-y-2 pl-5">
                  {s.list.map((item) => (
                    <li key={item.slice(0, 48)}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}
      </div>

      {relatedHref && relatedLabel && (
        <p className="mt-14 border-t hairline pt-8 text-sm text-stone">
          See also{" "}
          <Link href={relatedHref} className="text-brass hover:text-ink">
            {relatedLabel}
          </Link>
          .
        </p>
      )}
    </article>
  );
}
