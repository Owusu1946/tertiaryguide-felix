import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  ensureExploreIndexes,
  exploreCommentsCollection,
  explorePostsCollection,
} from "@/lib/explore/db";
import {
  EXPLORE_POST_TYPES,
  serializeExplorePost,
  type ExploreFeaturedSchool,
  type ExploreMedia,
  type ExplorePostType,
} from "@/lib/explore/types";
import { notifyAllStudents } from "@/lib/user-notifications-server";

type Ctx = { params: Promise<{ id: string }> };

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
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return null;
  const id =
    typeof (raw as { id?: string }).id === "string"
      ? (raw as { id: string }).id.trim()
      : "";
  const name =
    typeof (raw as { name?: string }).name === "string"
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

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.authorName === "string" && body.authorName.trim()) {
      updates.authorName = body.authorName.trim();
    }
    if (typeof body.authorAvatar === "string") {
      updates.authorAvatar = body.authorAvatar.trim() || null;
    }
    if (
      body.authorType === "admin" ||
      body.authorType === "partner" ||
      body.authorType === "sponsored"
    ) {
      updates.authorType = body.authorType;
    }
    if (
      typeof body.postType === "string" &&
      (EXPLORE_POST_TYPES as readonly string[]).includes(body.postType)
    ) {
      updates.postType = body.postType as ExplorePostType;
    }
    if (typeof body.body === "string") {
      updates.body = body.body.trim();
    }
    if (body.media !== undefined) {
      updates.media = parseMedia(body.media);
    }
    if (body.featuredSchool !== undefined) {
      updates.featuredSchool = parseFeaturedSchool(body.featuredSchool);
    }
    if (typeof body.isSponsored === "boolean") {
      updates.isSponsored = body.isSponsored;
    }
    if (body.status === "Draft" || body.status === "Published") {
      updates.status = body.status;
      if (body.status === "Published") {
        updates.publishedAt = new Date();
      }
    }
    if (typeof body.schoolId === "string") {
      updates.schoolId =
        body.schoolId && ObjectId.isValid(body.schoolId)
          ? new ObjectId(body.schoolId)
          : null;
    }

    const db = await getDb();
    await ensureExploreIndexes(db);
    const existing = await explorePostsCollection(db).findOne({
      _id: new ObjectId(id),
    });
    const result = await explorePostsCollection(db).findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updates },
      { returnDocument: "after" },
    );

    if (!result) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const becamePublished =
      body.status === "Published" && existing?.status !== "Published";
    if (becamePublished) {
      const text =
        typeof result.body === "string" ? result.body.trim() : "";
      const snippet = text.slice(0, 120) || "A new update is live on Explore.";
      const authorName =
        typeof result.authorName === "string" && result.authorName.trim()
          ? result.authorName.trim()
          : "TertiaryGuide";
      void notifyAllStudents(db, {
        title: "New Explore post",
        body: `${authorName}: ${snippet}${snippet.length >= 120 ? "…" : ""}`,
        kind: "explore",
        href: "/explore",
        dedupeKey: `explore-post:${id}`,
      }).catch((err) =>
        console.error("[admin/explore-posts/:id] notify students", err),
      );
    }

    return NextResponse.json({
      ok: true,
      post: serializeExplorePost(result),
    });
  } catch (error) {
    console.error("[admin/explore-posts/:id] PATCH error", error);
    return NextResponse.json(
      { error: "Failed to update explore post" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const db = await getDb();
    await ensureExploreIndexes(db);
    const result = await explorePostsCollection(db).deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    await exploreCommentsCollection(db).deleteMany({
      postId: new ObjectId(id),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin/explore-posts/:id] DELETE error", error);
    return NextResponse.json(
      { error: "Failed to delete explore post" },
      { status: 500 },
    );
  }
}
