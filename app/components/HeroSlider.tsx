"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import React, { useEffect, useState } from "react";
import { partnerSchoolBuyFormsHref } from "@/lib/school-links";

type PartnerSchool = {
  id: string;
  name: string;
  alias: string | null;
  slug: string | null;
  logoSrc: string | null;
};

type HeroSlide = {
  id: string;
  name: string;
  logo: string | null;
  formsHref: string;
};

const heroImages = ["/hero/hero.jpg", "/hero/Banner2.png", "/hero/Banner.png"];
const HERO_SUPPORTING =
  "Explore programmes and apply directly to partner institutions.";

function toSlide(school: PartnerSchool): HeroSlide {
  return {
    id: school.id,
    name: school.alias?.trim() || school.name,
    logo: school.logoSrc,
    formsHref: partnerSchoolBuyFormsHref(school),
  };
}

export function HeroSlider() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/apply/schools", { cache: "no-store" });
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const schools = Array.isArray(data.schools)
          ? (data.schools as PartnerSchool[])
          : [];
        setSlides(schools.map(toSlide));
        setIndex(0);
      } catch {
        if (!cancelled) setSlides([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  const slide = slides[index] ?? null;
  const imageSrc = heroImages[index % heroImages.length];
  const formsHref = slide?.formsHref ?? "/apply";
  const headlineName = slide?.name ?? "Partner schools";

  return (
    <>
      {/* Mobile Hero Slider */}
      <section className="mt-4 flex flex-col gap-5 md:hidden">
        <div className="space-y-3 px-1">
          <p className="inline-flex items-center gap-2 rounded-full border border-gray-50 bg-white px-2.5 py-0.5 text-[10px] font-medium text-[#007AFF] shadow-sm">
            <span className="h-1 w-1 rounded-full bg-[#007AFF]" />
            Your trusted resource to higher education
          </p>
          <h1 className="text-2xl font-semibold leading-tight text-[#252525]">
            {headlineName}
          </h1>
          <p className="text-[13px] leading-relaxed text-[#555555]">
            {HERO_SUPPORTING}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <Link
              href={formsHref}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#007AFF] px-3 py-2.5 text-[13px] font-bold text-white shadow-md shadow-[#007AFF]/20 hover:bg-[#0062CC]"
            >
              <span>Get Forms</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/wassce-checker"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-[13px] font-bold text-[#1E1E1E]"
            >
              <span className="leading-tight text-center">Buy Checkers</span>
            </Link>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl shadow-lg">
          <Image
            src={imageSrc}
            alt={headlineName}
            width={800}
            height={480}
            className="h-48 w-full object-cover"
            priority
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-[#007AFF]/80 via-[#007AFF]/40 to-transparent" />

          {slide && (
            <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-white/95 px-2.5 py-1 shadow-sm border border-white/20">
              {slide.logo ? (
                <Image
                  src={slide.logo}
                  alt={slide.name}
                  width={20}
                  height={20}
                  className="h-5 w-5 rounded-sm object-contain"
                />
              ) : (
                <GraduationCap className="h-4 w-4 text-[#007AFF]" />
              )}
              <span className="text-[10px] font-bold text-[#1E1E1E]">
                Selling {slide.name} forms
              </span>
            </div>
          )}
        </div>

        {slides.length > 0 && (
          <div className="flex items-center justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1 rounded-full transition-all ${
                  i === index ? "w-4 bg-[#007AFF]" : "w-1 bg-[#D1D5DB]"
                }`}
              />
            ))}
          </div>
        )}
      </section>

      {/* Desktop / Tablet Hero Slider */}
      <section className="relative hidden min-h-[360px] items-center overflow-hidden rounded-4xl shadow-xl md:flex md:min-h-[420px] lg:min-h-[480px]">
        <div className="absolute inset-0">
          <Image
            src={imageSrc}
            alt={headlineName}
            fill
            priority
            className="object-cover"
          />
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[45%] bg-gradient-to-r from-[#007AFF]/90 via-[#007AFF]/55 to-transparent" />

        <div className="relative z-10 flex w-full items-center px-6 py-10 text-white md:px-10 md:py-14 lg:px-14">
          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00E0FF]" />
              <span>Featured school</span>
              {slide && (
                <>
                  <span className="h-1 w-1 rounded-full bg-white/50" />
                  <span className="flex items-center gap-2">
                    {slide.logo ? (
                      <Image
                        src={slide.logo}
                        alt={slide.name}
                        width={20}
                        height={20}
                        className="h-5 w-5 rounded-sm object-contain"
                      />
                    ) : (
                      <GraduationCap className="h-4 w-4 text-white" />
                    )}
                    <span>{slide.name}</span>
                  </span>
                </>
              )}
            </div>

            <h1 className="text-3xl font-semibold leading-tight md:text-4xl lg:text-[40px] lg:leading-[1.1]">
              Your trusted resource <br /> to higher education
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-white/85 md:text-base">
              {HERO_SUPPORTING}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href={formsHref}
                className="flex items-center gap-2 rounded-xl bg-[#007AFF] px-6 py-2.5 text-sm font-medium text-white shadow-md shadow-black/20 hover:bg-[#0062CC]"
              >
                <span>Get Forms</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/wassce-checker"
                className="flex items-center gap-2 rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium text-white ring-1 ring-white/40 hover:bg-white/15"
              >
                <span>Buy Wassce Checkers</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {slides.length > 0 && (
            <div className="absolute bottom-6 right-8 flex items-center gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === index ? "w-6 bg-white" : "w-3 bg-white/50"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
