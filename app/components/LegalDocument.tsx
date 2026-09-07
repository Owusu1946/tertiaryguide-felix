import Link from "next/link";
import { Footer } from "./Footer";
import { Header } from "./Header";

export type LegalSection = {
  id: string;
  title: string;
  content: React.ReactNode;
};

export function LegalDocument({
  title,
  description,
  updated,
  sections,
}: {
  title: string;
  description: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-white text-[#1F2933]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-10">
        <Header />
        <main className="pb-20 pt-8 md:pt-12">
          <header className="max-w-3xl border-b border-[#E5E7EB] pb-10">
            <p className="mb-3 text-xs font-semibold uppercase text-[#6B7280]">Legal</p>
            <h1 className="text-3xl font-semibold text-[#111827] sm:text-4xl md:text-5xl">{title}</h1>
            <p className="mt-5 text-base leading-7 text-[#4B5563] md:text-lg">{description}</p>
            <p className="mt-5 text-sm text-[#6B7280]">Last updated: {updated}</p>
          </header>

          <div className="mt-10 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <p className="mb-3 text-xs font-semibold uppercase text-[#6B7280]">On this page</p>
              <nav aria-label={`${title} sections`} className="space-y-1 border-l border-[#E5E7EB]">
                {sections.map((section) => (
                  <Link key={section.id} href={`#${section.id}`} className="block border-l border-transparent py-1.5 pl-4 text-sm text-[#4B5563] transition hover:border-[#111827] hover:text-[#111827]">
                    {section.title}
                  </Link>
                ))}
              </nav>
            </aside>

            <article className="min-w-0 max-w-3xl space-y-12">
              {sections.map((section) => (
                <section key={section.id} id={section.id} className="scroll-mt-28">
                  <h2 className="text-xl font-semibold text-[#111827] md:text-2xl">{section.title}</h2>
                  <div className="mt-4 space-y-4 text-[15px] leading-7 text-[#4B5563] [&_a]:font-medium [&_a]:text-[#111827] [&_a]:underline [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-[#1F2933] [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
                    {section.content}
                  </div>
                </section>
              ))}
            </article>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
