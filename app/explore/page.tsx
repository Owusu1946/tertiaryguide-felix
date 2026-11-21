import type { Metadata } from "next";
import { Header } from "@/app/components/Header";
import { Footer } from "@/app/components/Footer";
import { ExploreFeed } from "@/app/components/ExploreFeed";
import { ExploreDesktopShell } from "@/app/components/ExploreSideNav";
import { getSiteUrl } from "@/lib/site-url";

const title = "Explore scholarships, deadlines and school news";
const description =
  "Browse scholarships, admission updates, and deadline reminders from TertiaryGuide. Optimized for fast loading on mobile.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/explore" },
  openGraph: {
    title: `${title} | TertiaryGuide`,
    description,
    type: "website",
    url: "/explore",
    siteName: "TertiaryGuide",
  },
  twitter: {
    card: "summary_large_image",
    title: `${title} | TertiaryGuide`,
    description,
  },
  robots: { index: true, follow: true },
};

export default function ExplorePage() {
  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${siteUrl}/explore`,
    isPartOf: {
      "@type": "WebSite",
      name: "TertiaryGuide",
      url: siteUrl,
    },
  };

  return (
    <div className="bg-[#F7F9FC]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Header />
      <ExploreDesktopShell>
        <ExploreFeed embedded variant="page" />
      </ExploreDesktopShell>
      <Footer />
    </div>
  );
}
