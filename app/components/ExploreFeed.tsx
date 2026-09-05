"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  BadgeCheck,
  Compass,
  Eye,
  Heart,
  Loader2,
  Maximize2,
  MessageCircle,
  Play,
  SendHorizontal,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { postTypeLabel, type ExplorePostType } from "@/lib/explore/types";
import { OptimizedImage } from "@/app/components/OptimizedImage";
import { ResponsiveMediaImg } from "@/app/components/ResponsiveMediaImg";
import { FlyerLightbox } from "@/app/components/FlyerLightbox";
import {
  IMAGE_SIZES,
  SRCSET_WIDTHS,
  imageAlt,
} from "@/lib/cloudinary-image";
import {
  pauseInViewVideo,
  playInViewVideo,
  useInView,
} from "@/hooks/use-in-view";
import {
  getStoredUserEmail,
  getStoredUserName,
  signInRedirectHref,
} from "@/lib/client-auth";
import { trackAdAnalytics } from "@/lib/ad-analytics-client";

type MediaLightbox =
  | { type: "image"; url: string; alt: string }
  | { type: "video"; url: string; alt: string };

type ExploreMedia = { type: "image" | "video"; url: string };

type ExplorePost = {
  id: string;
  authorName: string;
  authorAvatar: string | null;
  authorType: string;
  postType: ExplorePostType;
  body: string;
  media: ExploreMedia[];
  featuredSchool: {
    id: string;
    name: string;
    slug: string | null;
    logoSrc: string | null;
    deadline: string | null;
  } | null;
  isSponsored: boolean;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  likedByMe: boolean;
  createdAt: string;
  publishedAt: string | null;
};

type ExploreComment = {
  id: string;
  userName: string;
  userAvatar: string;
  userEmail: string;
  text: string;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

type MediaShape = "portrait" | "landscape" | "square";

function mediaShapeFromRatio(width: number, height: number): MediaShape {
  if (!width || !height) return "portrait";
  const ratio = width / height;
  if (ratio < 0.86) return "portrait";
  if (ratio > 1.2) return "landscape";
  return "square";
}

function mediaFrameClass(compact: boolean, shape: MediaShape) {
  if (compact) return "aspect-square";
  if (shape === "landscape") return "aspect-video";
  return "h-[min(52dvh,460px)]";
}

function ExploreVideo({
  src,
  compact = false,
  onOpen,
  pauseAutoplay = false,
}: {
  src: string;
  compact?: boolean;
  onOpen?: () => void;
  pauseAutoplay?: boolean;
}) {
  const [shape, setShape] = useState<MediaShape>("portrait");
  const [muted, setMuted] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const userPausedRef = useRef(false);
  const mutedRef = useRef(true);
  const { ref: inViewRef, inView } = useInView<HTMLDivElement>({
    threshold: 0.35,
    rootMargin: "40px 0px 40px 0px",
  });

  userPausedRef.current = userPaused;
  mutedRef.current = muted;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = () => {
      if (userPausedRef.current || pauseAutoplay) return;
      video.muted = mutedRef.current;
      void playInViewVideo(video).catch(() => {
        video.muted = true;
        mutedRef.current = true;
        setMuted(true);
        void playInViewVideo(video).catch(() => undefined);
      });
    };

    if (inView && !userPaused && !pauseAutoplay) {
      tryPlay();
      video.addEventListener("canplay", tryPlay);
      video.addEventListener("loadeddata", tryPlay);
      return () => {
        video.removeEventListener("canplay", tryPlay);
        video.removeEventListener("loadeddata", tryPlay);
      };
    }

    pauseInViewVideo(video);
    if (!inView) setUserPaused(false);
  }, [inView, userPaused, src, pauseAutoplay]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.muted = muted;
  }, [muted]);

  function toggleMute(e: React.MouseEvent) {
    e.stopPropagation();
    const video = videoRef.current;
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (!video) return;
    video.muted = next;
    if (
      !next &&
      video.paused &&
      !userPausedRef.current &&
      inView &&
      !pauseAutoplay
    ) {
      void playInViewVideo(video).catch(() => {
        video.muted = true;
        mutedRef.current = true;
        setMuted(true);
      });
    }
  }

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      userPausedRef.current = false;
      setUserPaused(false);
      video.muted = mutedRef.current;
      void playInViewVideo(video).catch(() => undefined);
    } else {
      userPausedRef.current = true;
      setUserPaused(true);
      pauseInViewVideo(video);
    }
  }

  return (
    <div
      ref={inViewRef}
      className={`relative w-full overflow-hidden bg-black ${mediaFrameClass(compact, shape)}`}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload={inView ? "auto" : "metadata"}
        onClick={togglePlay}
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          setShape(mediaShapeFromRatio(video.videoWidth, video.videoHeight));
        }}
        className="absolute inset-0 h-full w-full cursor-pointer object-cover object-center"
      />
      {userPaused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/45 text-white shadow-lg">
            <Play className="h-7 w-7 pl-0.5" fill="currentColor" />
          </span>
        </div>
      )}
      {onOpen ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="absolute bottom-2.5 left-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70"
          aria-label="Open video fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={toggleMute}
        className="absolute bottom-2.5 right-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70"
        aria-label={muted ? "Unmute video" : "Mute video"}
      >
        {muted ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function ExploreImage({
  src,
  alt,
  compact = false,
  onOpen,
}: {
  src: string;
  alt: string;
  compact?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative block w-full overflow-hidden bg-white ${
        compact ? "aspect-square" : ""
      }`}
    >
      <ResponsiveMediaImg
        src={src}
        alt={alt}
        sizes={compact ? IMAGE_SIZES.exploreCompact : IMAGE_SIZES.explore}
        widths={SRCSET_WIDTHS.feed}
        widthHint={compact ? 480 : 800}
        className={
          compact
            ? "absolute inset-0 h-full w-full object-contain object-center"
            : "block h-auto w-full object-contain object-center"
        }
      />
    </button>
  );
}

function ExploreVideoLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!mounted) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    void video.play().catch(() => {
      video.muted = true;
      setMuted(true);
      void video.play().catch(() => undefined);
    });
  }, [src, muted, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      className="fixed inset-0 z-[200] flex flex-col bg-black"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        <p className="min-w-0 truncate text-sm font-medium text-white/90">
          {alt}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/25"
            aria-label="Close video"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-0 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          autoPlay
          loop
          className="max-h-full max-w-full object-contain"
        />
      </div>
    </div>,
    document.body,
  );
}

export function ExploreFeed({
  embedded = false,
  variant = "tab",
}: {
  embedded?: boolean;
  variant?: "tab" | "page";
}) {
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [openCommentsId, setOpenCommentsId] = useState<string | null>(null);
  const [comments, setComments] = useState<ExploreComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [lightbox, setLightbox] = useState<MediaLightbox | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const commentInputRef = useRef<HTMLInputElement | null>(null);
  const viewedIds = useRef<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!openCommentsId) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      commentInputRef.current?.focus({ preventScroll: false });
    }, 180);
    return () => {
      document.body.style.overflow = prev;
      window.clearTimeout(focusTimer);
    };
  }, [openCommentsId]);

  const loadFeed = useCallback(async (cursor?: string | null) => {
    const email = getStoredUserEmail();
    const params = new URLSearchParams({ limit: "12" });
    if (email) params.set("email", email);
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`/api/explore/posts?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load feed");
    return data as { posts: ExplorePost[]; nextCursor: string | null };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setLoading(true);
        setError(null);
        const data = await loadFeed();
        if (cancelled) return;
        setPosts(data.posts);
        setNextCursor(data.nextCursor);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load Explore");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [loadFeed]);

  const recordView = useCallback((postId: string) => {
    if (viewedIds.current.has(postId)) return;
    viewedIds.current.add(postId);
    trackAdAnalytics({
      kind: "explore",
      assetId: postId,
      type: "impression",
      placement: "explore",
    });
    trackAdAnalytics({
      kind: "explore",
      assetId: postId,
      type: "view",
      placement: "explore",
    });
    void fetch(`/api/explore/posts/${postId}/view`, { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.viewCount === "number") {
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId ? { ...p, viewCount: data.viewCount } : p,
            ),
          );
        }
      })
      .catch(() => undefined);
  }, []);

  const postNodeRef = useCallback(
    (node: HTMLElement | null, postId: string) => {
      if (!node) return;
      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                const id = (entry.target as HTMLElement).dataset.postId;
                if (id) recordView(id);
              }
            }
          },
          { threshold: 0.55 },
        );
      }
      node.dataset.postId = postId;
      observerRef.current.observe(node);
    },
    [recordView],
  );

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await loadFeed(nextCursor);
      setPosts((prev) => [...prev, ...data.posts]);
      setNextCursor(data.nextCursor);
    } catch {
      // keep existing feed
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleLike(post: ExplorePost) {
    const email = getStoredUserEmail();
    if (!email) {
      window.location.href = signInRedirectHref("/?tab=explore");
      return;
    }

    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likeCount: p.likedByMe
                ? Math.max(0, p.likeCount - 1)
                : p.likeCount + 1,
            }
          : p,
      ),
    );

    try {
      const res = await fetch(`/api/explore/posts/${post.id}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, likedByMe: data.liked, likeCount: data.likeCount }
            : p,
        ),
      );
    } catch {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    }
  }

  async function openComments(postId: string) {
    setOpenCommentsId(postId);
    setCommentText("");
    setCommentsLoading(true);
    try {
      const res = await fetch(`/api/explore/posts/${postId}/comments`);
      const data = await res.json();
      if (res.ok) setComments(data.comments || []);
      else setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!openCommentsId || !commentText.trim() || commentBusy) return;
    const email = getStoredUserEmail();
    if (!email) {
      window.location.href = signInRedirectHref("/?tab=explore");
      return;
    }

    setCommentBusy(true);
    try {
      const res = await fetch(`/api/explore/posts/${openCommentsId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          userName: getStoredUserName() || email.split("@")[0],
          userAvatar:
            typeof window !== "undefined"
              ? window.localStorage.getItem("tg_user_avatar") ||
                "/hero/avatar.png"
              : "/hero/avatar.png",
          text: commentText.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to comment");
      setComments((prev) => [...prev, data.comment]);
      setCommentText("");
      setPosts((prev) =>
        prev.map((p) =>
          p.id === openCommentsId
            ? { ...p, commentCount: p.commentCount + 1 }
            : p,
        ),
      );
    } catch {
      // leave composer open
    } finally {
      setCommentBusy(false);
    }
  }

  // On the homepage mid-page section, hide when empty.
  // In the Explore tab view, always show (with empty state).
  if (!embedded && !loading && !error && posts.length === 0) {
    return null;
  }

  return (
    <>
      <section
        id="explore"
        className={
          embedded
            ? "relative scroll-mt-24 bg-[#F7F9FC] pb-0 md:bg-transparent"
            : "relative mt-4 scroll-mt-24 overflow-hidden md:mt-5"
        }
      >
        {!embedded && (
          <>
            <div className="absolute inset-0 bg-gradient-to-b from-[#F4F8FF] via-[#F8FAFC] to-white" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#BFDBFE] to-transparent" />
          </>
        )}

        <div
          className={
            embedded
              ? variant === "page"
                ? "relative mx-auto max-w-xl px-3 pb-4 pt-3 sm:px-4 md:max-w-none md:px-3 md:pb-5 md:pt-3"
                : "relative mx-auto max-w-xl px-3 pb-4 pt-3 sm:px-4 sm:pt-4"
              : "relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12 md:px-10 md:py-14"
          }
        >
          {!embedded && (
            <div className="mx-auto max-w-2xl text-center">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#007AFF]">
                <Compass className="h-3.5 w-3.5" />
                Explore
              </p>
              <h2 className="mt-2 text-balance text-2xl font-semibold leading-tight tracking-tight text-[#252525] md:text-3xl">
                Opportunities & resources
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[#666] md:text-base">
                Updates from schools, flyers, deadlines, and sponsored tips — all
                in one place.
              </p>
            </div>
          )}

          {embedded && (
            <div
              className={
                variant === "page" ? "mb-4 px-1 md:hidden" : "mb-4 px-1"
              }
            >
              <h2 className="text-lg font-semibold tracking-tight text-[#252525]">
                Latest updates
              </h2>
              <p className="text-xs text-[#64748B]">
                Flyers, deadlines, and school news
              </p>
            </div>
          )}

          <div className={embedded ? "" : "mx-auto mt-8 max-w-xl sm:mt-10"}>
            {loading ? (
              <div
                className={
                  variant === "page"
                    ? "flex flex-col items-center justify-center gap-3 rounded-2xl bg-white py-16"
                    : "flex flex-col items-center justify-center gap-3 rounded-3xl border border-[#E8EEF5] bg-white/80 py-16 shadow-sm"
                }
              >
                <Loader2 className="h-6 w-6 animate-spin text-[#007AFF]" />
                <p className="text-sm text-[#6B7280]">Loading updates…</p>
              </div>
            ) : error ? (
              <div
                className={
                  variant === "page"
                    ? "rounded-2xl bg-red-50 px-5 py-8 text-center text-sm text-red-700"
                    : "rounded-3xl border border-red-100 bg-red-50 px-5 py-8 text-center text-sm text-red-700"
                }
              >
                {error}
              </div>
            ) : posts.length === 0 ? (
              <div
                className={
                  variant === "page"
                    ? "rounded-2xl bg-white px-5 py-14 text-center"
                    : "rounded-3xl border border-dashed border-[#Dbeafe] bg-white px-5 py-14 text-center shadow-sm"
                }
              >
                <Compass className="mx-auto h-8 w-8 text-[#007AFF]/50" />
                <p className="mt-3 text-base font-semibold text-[#1E1E1E]">
                  Nothing to explore yet
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-[#6B7280]">
                  Opportunities, school updates, and resources will show up here
                  soon.
                </p>
              </div>
            ) : (
              <div className={variant === "page" ? "space-y-4" : "space-y-5"}>
                {posts.map((post) => (
                  <article
                    key={post.id}
                    ref={(node) => postNodeRef(node, post.id)}
                    className={
                      variant === "page"
                        ? "overflow-hidden rounded-2xl bg-white"
                        : "overflow-hidden rounded-[28px] border border-[#E8EEF5] bg-white shadow-[0_10px_32px_rgba(15,23,42,0.05)]"
                    }
                  >
                    <header className="flex items-start gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#EFF6FF] ring-2 ring-white shadow-sm">
                        {post.authorAvatar ? (
                          <OptimizedImage
                            src={post.authorAvatar}
                            alt=""
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#007AFF]">
                            {post.authorName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="truncate text-sm font-semibold text-[#1E1E1E]">
                            {post.authorName}
                          </p>
                          {post.isSponsored && (
                            <span className="rounded-md bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                              Sponsored
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] text-[#6B7280]">
                          <span className="font-medium text-[#007AFF]">
                            {postTypeLabel(post.postType)}
                          </span>
                          <span className="mx-1.5 text-[#D1D5DB]">·</span>
                          {timeAgo(post.publishedAt || post.createdAt)}
                        </p>
                      </div>
                    </header>

                    {post.body && (
                      <p className="mt-3 whitespace-pre-wrap px-4 text-sm leading-relaxed text-[#1E1E1E] sm:px-5">
                        {post.body}
                      </p>
                    )}

                    {post.media.length > 0 && (
                      <div
                        className={`mt-3 overflow-hidden ${
                          post.media.length === 1
                            ? ""
                            : "grid grid-cols-2 gap-px bg-[#E8EEF5]"
                        }`}
                      >
                        {post.media.slice(0, 4).map((m, i) => {
                          const alt = imageAlt(
                            post.body,
                            `${post.authorName} ${postTypeLabel(post.postType)}`,
                          );
                          const openMedia = () => {
                            trackAdAnalytics({
                              kind: "explore",
                              assetId: post.id,
                              type: "click",
                              placement: "explore",
                            });
                            setLightbox({
                              type: m.type,
                              url: m.url,
                              alt,
                            });
                          };
                          return m.type === "video" ? (
                            <ExploreVideo
                              key={`${post.id}-media-${i}`}
                              src={m.url}
                              compact={post.media.length > 1}
                              onOpen={openMedia}
                              pauseAutoplay={lightbox?.type === "video"}
                            />
                          ) : (
                            <ExploreImage
                              key={`${post.id}-media-${i}`}
                              src={m.url}
                              alt={alt}
                              compact={post.media.length > 1}
                              onOpen={openMedia}
                            />
                          );
                        })}
                      </div>
                    )}

                    {post.featuredSchool && (
                      <div className="px-4 pt-3 sm:px-5">
                        <Link
                          href={
                            post.featuredSchool.slug
                              ? `/apply/school/${encodeURIComponent(post.featuredSchool.slug)}`
                              : `/university-forms/${post.featuredSchool.id}`
                          }
                          onClick={() =>
                            trackAdAnalytics({
                              kind: "explore",
                              assetId: post.id,
                              type: "click",
                              placement: "explore",
                            })
                          }
                          className="flex items-center gap-3 rounded-2xl border border-[#E8EEF5] bg-[#F8FBFF] px-3 py-2.5 transition hover:border-[#BFDBFE]"
                        >
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-[#E5E7EB]">
                            {post.featuredSchool.logoSrc ? (
                              <OptimizedImage
                                src={post.featuredSchool.logoSrc}
                                alt={`${post.featuredSchool.name} logo`}
                                fill
                                sizes="40px"
                                className="object-contain p-1"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 truncate text-sm font-semibold text-[#111827]">
                              <span className="truncate">{post.featuredSchool.name}</span>
                              <BadgeCheck
                                className="h-3.5 w-3.5 shrink-0 text-[#007AFF]"
                                fill="currentColor"
                                stroke="white"
                              />
                            </p>
                            {post.featuredSchool.deadline && (
                              <p className="text-xs text-[#DC2626]">
                                Deadline{" "}
                                {new Date(
                                  post.featuredSchool.deadline,
                                ).toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                            )}
                          </div>
                        </Link>
                      </div>
                    )}

                    <div className="mt-1 flex items-center justify-between gap-1 px-2 py-1.5 sm:px-3">
                      <button
                        type="button"
                        onClick={() => void toggleLike(post)}
                        className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium transition active:scale-[0.98] ${
                          post.likedByMe
                            ? "text-[#F91880]"
                            : "text-[#64748B] hover:bg-[#F91880]/8 hover:text-[#F91880]"
                        }`}
                      >
                        <Heart
                          className={`h-[17px] w-[17px] ${
                            post.likedByMe ? "fill-current" : ""
                          }`}
                        />
                        <span className="tabular-nums">{post.likeCount}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void openComments(post.id)}
                        className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium text-[#64748B] transition hover:bg-[#007AFF]/8 hover:text-[#007AFF] active:scale-[0.98]"
                      >
                        <MessageCircle className="h-[17px] w-[17px]" />
                        <span className="tabular-nums">{post.commentCount}</span>
                      </button>
                      <span className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium text-[#94A3B8]">
                        <Eye className="h-[17px] w-[17px]" />
                        <span className="tabular-nums">{post.viewCount}</span>
                      </span>
                    </div>
                  </article>
                ))}

                {nextCursor && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => void loadMore()}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-semibold text-[#1E1E1E] shadow-sm hover:bg-[#F9FAFB] disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#007AFF]" />
                      ) : (
                        "Load more"
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {portalReady &&
        openCommentsId &&
        createPortal(
          <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 sm:items-center sm:p-4">
            <button
              type="button"
              className="absolute inset-0"
              aria-label="Close comments"
              onClick={() => setOpenCommentsId(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Comments"
              className="relative flex max-h-[min(88dvh,640px)] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white text-[#1E1E1E] shadow-2xl sm:max-h-[80vh] sm:rounded-3xl"
              style={{
                paddingBottom: "max(0px, env(safe-area-inset-bottom))",
              }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#EFEFEF] px-4 py-3">
                <h3 className="text-base font-semibold text-[#111827]">
                  Comments
                </h3>
                <button
                  type="button"
                  onClick={() => setOpenCommentsId(null)}
                  className="rounded-full bg-gray-100 p-2 text-[#4B5563] hover:bg-gray-200 hover:text-[#111827]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3">
              {commentsLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-[#007AFF]" />
                </div>
              ) : comments.length === 0 ? (
                <p className="py-10 text-center text-sm text-[#4B5563]">
                  No comments yet. Start the conversation.
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-100">
                      <OptimizedImage
                        src={c.userAvatar || "/hero/avatar.png"}
                        alt=""
                        fill
                        sizes="32px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 rounded-2xl bg-[#F3F4F6] px-3 py-2">
                      <p className="text-xs font-semibold text-[#111827]">
                        {c.userName}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-snug text-[#111827]">
                        {c.text}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

              <form
                onSubmit={(e) => void submitComment(e)}
                className="flex shrink-0 items-center gap-2 border-t border-[#EFEFEF] bg-white px-3 py-3"
              >
                <input
                  ref={commentInputRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                  enterKeyHint="send"
                  className="min-w-0 flex-1 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-base text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#007AFF] focus:bg-white sm:text-sm"
                />
                <button
                  type="submit"
                  disabled={commentBusy || !commentText.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#007AFF] text-white disabled:opacity-40"
                >
                  {commentBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <SendHorizontal className="h-4 w-4" />
                  )}
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {lightbox?.type === "image" && (
        <FlyerLightbox
          src={lightbox.url}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}

      {lightbox?.type === "video" && (
        <ExploreVideoLightbox
          src={lightbox.url}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
