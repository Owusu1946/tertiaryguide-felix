"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { FlyerLightbox } from "./FlyerLightbox";
import {
  extractYouTubeVideoId,
  youtubeModalEmbedUrl,
  youtubePreviewEmbedUrl,
} from "@/lib/adVideo";
import {
  pauseInViewVideo,
  playInViewVideo,
  useInView,
} from "@/hooks/use-in-view";
import { trackAdAnalytics } from "@/lib/ad-analytics-client";

type Ad = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  ctaText?: string;
  ctaLink?: string;
};

/** How long each slide stays before auto-advancing (video needs more time to be seen). */
const SLIDE_MS_IMAGE = 6_000;
const SLIDE_MS_VIDEO = 18_000;

const fallbackAds: Ad[] = [
  {
    id: "1",
    title: "Apply Faster to Top Universities",
    description: "Get instant access to admission forms before deadlines close.",
    imageUrl: "/hero/KNUST.png",
    ctaText: "Apply Now",
    ctaLink: "/university-forms",
  },
  {
    id: "2",
    title: "WASSCE Checker Offer",
    description: "Buy checker codes instantly and receive via email.",
    imageUrl: "/hero/UENR.png",
    ctaText: "Buy Now",
    ctaLink: "/wassce-checker",
  },
  {
    id: "3",
    title: "Scholarship Alerts",
    description: "Never miss a scholarship opportunity again.",
    imageUrl: "/hero/UHAS.png",
    ctaText: "Join Free",
    ctaLink: "/signup",
  },
];

export type AdsSectionProps = {
  /** When set with description, show this single ad instead of DB / fallbacks. */
  title?: string;
  description?: string;
  imageUrl?: string;
  ctaText?: string;
  ctaLink?: string;
};

function isTrackedAdId(id?: string) {
  return Boolean(id && /^[a-f0-9]{24}$/i.test(id));
}

export function AdsSection({
  title,
  description,
  imageUrl,
  ctaText,
  ctaLink,
}: AdsSectionProps = {}) {
  const [index, setIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const [dbAds, setDbAds] = useState<Ad[] | null>(null);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const modalVideoRef = useRef<HTMLVideoElement | null>(null);

  const hasLegacyOverride =
    title != null &&
    title !== "" &&
    description != null &&
    description !== "";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (hasLegacyOverride) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ads");
        const data = (await res.json()) as { ok?: boolean; ads?: unknown };
        if (cancelled || !data?.ok || !Array.isArray(data.ads)) {
          if (!cancelled) setDbAds(null);
          return;
        }
        const next: Ad[] = data.ads.map(
          (a: {
            id: string;
            title: string;
            description?: string;
            imageUrl: string;
            videoUrl?: string | null;
            ctaText?: string;
            ctaLink: string;
          }) => ({
            id: a.id,
            title: a.title,
            description: a.description ?? "",
            imageUrl: a.imageUrl,
            videoUrl: a.videoUrl || undefined,
            ctaText: a.ctaText ?? "Learn more",
            ctaLink: a.ctaLink || "/",
          }),
        );
        if (!cancelled) {
          setDbAds(next.length > 0 ? next : null);
        }
      } catch {
        if (!cancelled) setDbAds(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasLegacyOverride]);

  const effectiveItems: Ad[] = useMemo(() => {
    if (hasLegacyOverride) {
      return [
        {
          id: "home",
          title: title!,
          description: description!,
          imageUrl,
          ctaText: ctaText ?? "Learn more",
          ctaLink: ctaLink ?? "/",
        },
      ];
    }
    if (dbAds && dbAds.length > 0) {
      return dbAds;
    }
    return fallbackAds;
  }, [
    hasLegacyOverride,
    title,
    description,
    imageUrl,
    ctaText,
    ctaLink,
    dbAds,
  ]);

  const currentAd = useMemo(
    () => effectiveItems[index] ?? effectiveItems[0] ?? null,
    [effectiveItems, index],
  );

  useEffect(() => {
    if (closed || !currentAd || !isTrackedAdId(currentAd.id)) return;
    trackAdAnalytics({
      kind: "ad",
      assetId: currentAd.id,
      type: "impression",
      placement: "homepage",
    });
  }, [closed, currentAd?.id]);

  const youtubeId = useMemo(
    () => extractYouTubeVideoId(currentAd?.videoUrl),
    [currentAd?.videoUrl],
  );

  const { ref: previewContainerRef, inView: mediaInView } = useInView<HTMLDivElement>({
    enabled: Boolean(!closed && currentAd?.videoUrl),
    threshold: 0.15,
    rootMargin: "120px 0px 120px 0px",
  });

  useEffect(() => {
    setIndex(0);
  }, [hasLegacyOverride, effectiveItems.length, dbAds?.length]);

  const openVideoModal = useCallback(() => {
    const el = previewVideoRef.current;
    if (el) pauseInViewVideo(el);
    setVideoModalOpen(true);
    if (isTrackedAdId(currentAd?.id)) {
      trackAdAnalytics({
        kind: "ad",
        assetId: currentAd!.id,
        type: "view",
        placement: "homepage",
      });
    }
  }, [currentAd]);

  const closeVideoModal = useCallback(() => {
    setVideoModalOpen(false);
    requestAnimationFrame(() => {
      const el = previewVideoRef.current;
      if (!el) return;
      el.muted = true;
      void playInViewVideo(el).catch(() => undefined);
    });
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (videoModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [videoModalOpen]);

  useEffect(() => {
    if (!videoModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeVideoModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [videoModalOpen, closeVideoModal]);

  useEffect(() => {
    setVideoModalOpen(false);
    setImageLightboxOpen(false);
  }, [index]);

  // Direct file URL: play muted when the ad appears / is scrolled to
  useEffect(() => {
    if (closed || !currentAd?.videoUrl || youtubeId) return;
    const v = previewVideoRef.current;
    if (videoModalOpen) {
      if (v) pauseInViewVideo(v);
      return;
    }
    if (!v) return;

    const tryPlay = () => {
      v.muted = true;
      void playInViewVideo(v).catch(() => undefined);
    };

    if (mediaInView) {
      tryPlay();
      v.addEventListener("canplay", tryPlay);
      v.addEventListener("loadeddata", tryPlay);
      return () => {
        v.removeEventListener("canplay", tryPlay);
        v.removeEventListener("loadeddata", tryPlay);
      };
    }

    pauseInViewVideo(v);
  }, [
    closed,
    currentAd?.id,
    currentAd?.videoUrl,
    youtubeId,
    videoModalOpen,
    mediaInView,
  ]);

  // Modal: full direct video with sound after user opened via click
  useEffect(() => {
    if (!videoModalOpen || youtubeId) return;
    const v = modalVideoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    const p = v.play();
    p.catch(() => {
      v.muted = true;
      v.play().catch(() => {
        // still blocked; user can use native controls
      });
    });
    return () => {
      v.pause();
    };
  }, [videoModalOpen, currentAd?.id, currentAd?.videoUrl, youtubeId]);

  // Auto-rotate: longer when the current slide is video so it can be watched
  useEffect(() => {
    if (closed || effectiveItems.length <= 1) return;
    if (videoModalOpen || imageLightboxOpen) return;
    const isVideo = Boolean(currentAd?.videoUrl);
    const delay = isVideo ? SLIDE_MS_VIDEO : SLIDE_MS_IMAGE;
    const t = setInterval(() => {
      setIndex((prev) => (prev + 1) % effectiveItems.length);
    }, delay);
    return () => clearInterval(t);
  }, [
    closed,
    effectiveItems.length,
    index,
    currentAd?.id,
    currentAd?.videoUrl,
    videoModalOpen,
    imageLightboxOpen,
  ]);

  const next = () => {
    setIndex((prev) => (prev + 1) % effectiveItems.length);
  };

  const prev = () => {
    setIndex((prev) => (prev - 1 + effectiveItems.length) % effectiveItems.length);
  };

  const closeAd = () => {
    setClosed(true);
  };

  if (closed) return null;

  if (!currentAd) return null;

  const ad = currentAd;
  const hasCarousel = effectiveItems.length > 1;

  return (
    <section className="w-full py-8">
      <div className="mx-auto max-w-6xl px-4 md:px-8 lg:px-10">

        {/* Ad Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#007AFF] to-[#005FCC] text-white shadow-lg">

          {/* Close Button */}
          <button
            onClick={closeAd}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/20 p-2 hover:bg-white/30"
            type="button"
            aria-label="Dismiss ad"
          >
            <X className="h-4 w-4 text-white" />
          </button>

          <div
            className={`grid min-w-0 grid-cols-1 gap-6 p-5 sm:p-6 md:grid-cols-2 md:items-center md:gap-8 md:p-10 ${
              hasCarousel ? "pb-16 sm:pb-14 md:pb-16" : ""
            }`}
          >

            {/* Text */}
            <div className="min-w-0 flex flex-col justify-center space-y-3 sm:space-y-4">
              <h2 className="text-lg font-semibold leading-tight sm:text-xl md:text-2xl">
                {ad.title}
              </h2>

              <p className="line-clamp-6 text-sm leading-relaxed text-white/85 sm:line-clamp-none md:text-base">
                {ad.description}
              </p>

              <a
                href={ad.ctaLink ?? "/"}
                onClick={() => {
                  if (isTrackedAdId(ad.id)) {
                    trackAdAnalytics({
                      kind: "ad",
                      assetId: ad.id,
                      type: "click",
                      placement: "homepage",
                    });
                  }
                }}
                className="inline-flex w-fit min-h-[44px] items-center justify-center rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#007AFF] transition hover:scale-[1.02] active:scale-[0.98]"
              >
                {ad.ctaText}
              </a>
            </div>

            {/* Media: object-contain so logos / posters are not cropped; aspect box for video */}
            <div className="flex min-h-0 w-full min-w-0 items-stretch justify-center md:max-h-none md:justify-end">
              {ad.videoUrl ? (
                <button
                  type="button"
                  onClick={openVideoModal}
                  className="group relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/20 bg-black/30 text-left shadow-md ring-1 ring-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  <div
                    ref={previewContainerRef}
                    className="relative aspect-video w-full overflow-hidden bg-black/40"
                  >
                    {youtubeId ? (
                      <iframe
                        key={ad.id}
                        title="Ad video preview"
                        src={
                          mediaInView && !videoModalOpen
                            ? youtubePreviewEmbedUrl(youtubeId)
                            : "about:blank"
                        }
                        className="pointer-events-none absolute inset-0 h-full w-full border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    ) : (
                      <video
                        key={ad.id}
                        ref={previewVideoRef}
                        src={ad.videoUrl}
                        className="pointer-events-none h-full w-full object-contain"
                        muted
                        loop
                        playsInline
                        preload={mediaInView ? "auto" : "metadata"}
                        poster={ad.imageUrl || undefined}
                      />
                    )}
                  </div>
                  <span className="pointer-events-none absolute bottom-2 right-2 z-[1] flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1.5 text-[11px] font-medium text-white/95 shadow-sm backdrop-blur-sm">
                    <Maximize2 className="h-3.5 w-3.5 opacity-90" aria-hidden />
                    Expand
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (isTrackedAdId(ad.id)) {
                      trackAdAnalytics({
                        kind: "ad",
                        assetId: ad.id,
                        type: "view",
                        placement: "homepage",
                      });
                    }
                    setImageLightboxOpen(true);
                  }}
                  className="group relative flex w-full max-w-xl items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-2 text-left sm:p-3"
                  aria-label={`View ${ad.title} flyer`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ad.imageUrl || "/og-image.jpg"}
                    alt={ad.title}
                    className="max-h-[min(42vh,320px)] w-full object-contain object-center sm:max-h-80 md:max-h-96"
                    loading="lazy"
                  />
                  <span className="pointer-events-none absolute bottom-2 right-2 z-[1] flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1.5 text-[11px] font-medium text-white/95 shadow-sm backdrop-blur-sm">
                    <Maximize2 className="h-3.5 w-3.5 opacity-90" aria-hidden />
                    View post
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Controls (multi-ad carousel only) — padded card body above avoids overlap */}
          {hasCarousel && (
            <div className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 px-2 sm:bottom-3 sm:gap-3">
              <button
                type="button"
                onClick={prev}
                className="rounded-full bg-white/20 p-2.5 transition hover:bg-white/30"
                aria-label="Previous ad"
              >
                <ChevronLeft className="h-4 w-4 text-white" />
              </button>

              <div className="flex items-center gap-1.5">
                {effectiveItems.map((item, i) => (
                  <div
                    key={item.id}
                    className={`h-1.5 rounded-full transition-all sm:h-2 ${
                      i === index
                        ? "w-3 bg-white sm:w-4"
                        : "w-1.5 bg-white/40 sm:w-2"
                    }`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={next}
                className="rounded-full bg-white/20 p-2.5 transition hover:bg-white/30"
                aria-label="Next ad"
              >
                <ChevronRight className="h-4 w-4 text-white" />
              </button>
            </div>
          )}
        </div>
      </div>

      {imageLightboxOpen && (ad.imageUrl || "/og-image.jpg") && (
        <FlyerLightbox
          src={ad.imageUrl || "/og-image.jpg"}
          alt={ad.title}
          onClose={() => setImageLightboxOpen(false)}
        />
      )}

      {mounted &&
        videoModalOpen &&
        ad.videoUrl &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${ad.title} — full video`}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6"
          onClick={closeVideoModal}
        >
          <div
            className="relative w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeVideoModal}
              className="absolute -right-0 -top-0 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/20 sm:-right-1 sm:-top-1"
              aria-label="Close video"
            >
              <X className="h-5 w-5" />
            </button>
            {youtubeId ? (
              <iframe
                key={`yt-modal-${ad.id}`}
                title={`${ad.title} — YouTube`}
                src={youtubeModalEmbedUrl(youtubeId)}
                className="aspect-video w-full max-h-[85vh] min-h-[12rem] rounded-2xl border border-white/10 bg-black shadow-2xl sm:max-h-[min(90vh,56rem)]"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <video
                key={`modal-${ad.id}`}
                ref={modalVideoRef}
                src={ad.videoUrl}
                className="w-full max-h-[85vh] rounded-2xl border border-white/10 bg-black object-contain shadow-2xl sm:max-h-[min(90vh,56rem)]"
                controls
                playsInline
                preload="auto"
              />
            )}
          </div>
        </div>,
          document.body,
        )}
    </section>
  );
}
