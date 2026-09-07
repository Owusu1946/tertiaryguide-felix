import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { ensureExploreIndexes, explorePostsCollection } from "@/lib/explore/db";
import {
  EXPLORE_POST_TYPES,
  serializeExplorePost,
  type ExploreFeaturedSchool,
  type ExploreMedia,
  type ExplorePostDoc,
  type ExplorePostType,
} from "@/lib/explore/types";
import { parseOptionalEmail, parseOptionalText } from "@/lib/ad-analytics";
import { notifyAllStudents } from "@/lib/user-notifications-server";

function parseMedia(raw: unknown): ExploreMedia[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const type = (item as { type?: string }).type;
      const url = (item as { url?: string }).url;
      if ((type !== "image" && type !== "video") || typeof url !== "string") {
        return null;
      }
      const trimmed = url.trim();
      if (!trimmed) return null;
      return { type, url: trimmed } as ExploreMedia;
    })
    .filter((m): m is ExploreMedia => Boolean(m))
    .slice(0, 6);
}

function parseFeaturedSchool(raw: unknown): ExploreFeaturedSchool | null {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof (raw as { id?: string }).id === "string"
    ? (raw as { id: string }).id.trim()
    : "";
  const name = typeof (raw as { name?: string }).name === "string"
    ? (raw as { name: string }).name.trim()
    : "";
  if (!id || !name) return null;
  return {
    id,
    name,
    slug:
      typeof (raw as { slug?: string | null }).slug === "string"
        ? (raw as { slug: string }).slug
        : null,
    logoSrc:
      typeof (raw as { logoSrc?: string | null }).logoSrc === "string"
        ? (raw as { logoSrc: string }).logoSrc
        : null,
    deadline:
      typeof (raw as { deadline?: string | null }).deadline === "string"
        ? (raw as { deadline: string }).deadline
        : null,
  };
}

export async function GET() {
  try {
    const db = await getDb();
    await ensureExploreIndexes(db);
    const docs = await explorePostsCollection(db)
      .find({})
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();

    return NextResponse.json({
      ok: true,
      posts: docs.map((doc) =>
        serializeExplorePost(doc, null, { includeAdvertiser: true }),
      ),
    });
  } catch (error) {
    console.error("[admin/explore-posts] GET error", error);
    return NextResponse.json(
      { error: "Failed to load explore posts" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const authorName =
      typeof body.authorName === "string" && body.authorName.trim()
        ? body.authorName.trim()
        : "TertiaryGuide";
    const authorAvatar =
      typeof body.authorAvatar === "string" ? body.authorAvatar.trim() : null;
    const authorTypeRaw = body.authorType;
    const authorType: ExplorePostDoc["authorType"] =
      authorTypeRaw === "partner" || authorTypeRaw === "sponsored"
        ? authorTypeRaw
        : "admin";
    const postTypeRaw =
      typeof body.postType === "string" ? body.postType : "update";
    const postType: ExplorePostType = (
      EXPLORE_POST_TYPES as readonly string[]
    ).includes(postTypeRaw)
      ? (postTypeRaw as ExplorePostType)
      : "update";
    const text = typeof body.body === "string" ? body.body.trim() : "";
    const media = parseMedia(body.media);
    const featuredSchool = parseFeaturedSchool(body.featuredSchool);
    const isSponsored = body.isSponsored === true || postType === "sponsored";
    const statusRaw = body.status;
    const status: ExplorePostDoc["status"] =
      statusRaw === "Draft" ? "Draft" : "Published";
    const schoolIdRaw =
      typeof body.schoolId === "string" ? body.schoolId.trim() : "";

    if (!text && media.length === 0 && !featuredSchool) {
      return NextResponse.json(
        { error: "Add text, media, or a featured school" },
        { status: 400 },
      );
    }

    const now = new Date();
    const doc: ExplorePostDoc = {
      authorName,
      authorAvatar,
      authorType,
      schoolId:
        schoolIdRaw && ObjectId.isValid(schoolIdRaw)
          ? new ObjectId(schoolIdRaw)
          : null,
      postType,
      body: text,
      media,
      featuredSchool,
      isSponsored,
      advertiserName: parseOptionalText(body.advertiserName),
      advertiserEmail: parseOptionalEmail(body.advertiserEmail),
      campaignName: parseOptionalText(body.campaignName),
      status,
      likes: [],
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      createdAt: now,
      updatedAt: now,
      publishedAt: status === "Published" ? now : null,
    };

    const db = await getDb();
    await ensureExploreIndexes(db);
    const result = await explorePostsCollection(db).insertOne(doc);

    if (status === "Published") {
      const snippet = text.slice(0, 120) || "A new update is live on Explore.";
      void notifyAllStudents(db, {
        title: "New Explore post",
        body: `${authorName}: ${snippet}${snippet.length >= 120 ? "…" : ""}`,
        kind: "explore",
        href: "/explore",
        dedupeKey: `explore-post:${String(result.insertedId)}`,
      }).catch((err) =>
        console.error("[admin/explore-posts] notify students", err),
      );
    }

    return NextResponse.json({
      ok: true,
      post: serializeExplorePost(
        { ...doc, _id: result.insertedId },
        null,
        { includeAdvertiser: true },
      ),
    });
  } catch (error) {
    console.error("[admin/explore-posts] POST error", error);
    return NextResponse.json(
      { error: "Failed to create explore post" },
      { status: 500 },
    );
  }
}
