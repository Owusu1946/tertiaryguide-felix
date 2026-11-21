import { Suspense } from "react";
import type { Metadata } from "next";
import { ServicesSection } from "./components/ServicesSection";
import { ProgramSearchPromo } from "./components/ProgramSearchPromo";
import { FindCompareCoursesSection } from "./components/FindCompareCoursesSection";
import { TestimonialsSection } from "./components/TestimonialsSection";
import { BlogSection } from "./components/BlogSection";
import { FaqSection } from "./components/FaqSection";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { HeroSlider } from "./components/HeroSlider";
import { ApproachingDeadlinesSection } from "./components/ApproachingDeadlinesSection";
import { AdsSection } from "./components/AdsSection";
import { HomeShell } from "./components/HomeShell";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}): Promise<Metadata> {
  const { tab } = await searchParams;
  if (tab === "explore") {
    return {
      title: "Explore scholarships, deadlines and school news",
      description:
        "Browse scholarships, admission updates, and deadline reminders from TertiaryGuide.",
      alternates: { canonical: "/explore" },
      openGraph: {
        url: "/explore",
        title: "Explore scholarships, deadlines and school news | TertiaryGuide",
      },
    };
  }
  return {
    alternates: { canonical: "/" },
  };
}

function HomeTabContent() {
  return (
    <>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-3 md:gap-8 md:px-10 md:py-4">
        <HeroSlider />
      </div>

      <FindCompareCoursesSection />

      <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-10">
        <ApproachingDeadlinesSection />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 md:px-10">
        <AdsSection />
      </div>

      <ServicesSection />
      <ProgramSearchPromo />
      <TestimonialsSection />
      <BlogSection />
      <FaqSection />
    </>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Header />

      <Suspense fallback={<div className="min-h-[40vh] animate-pulse bg-white" />}>
        <HomeShell homeContent={<HomeTabContent />} />
      </Suspense>

      <Footer />
    </div>
  );
}
