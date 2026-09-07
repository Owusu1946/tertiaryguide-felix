import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ensureExploreIndexes, explorePostsCollection } from "@/lib/explore/db";
import { serializeExplorePost } from "@/lib/explore/types";
import { getCachedExplorePosts, setCachedExplorePosts } from "@/lib/redis";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
      50,
    );
    const cursor = searchParams.get("cursor");
    const viewerEmail = (searchParams.get("email") || "").trim().toLowerCase();

    const cacheKey = !cursor ? `first:${limit}` : null;
    if (cacheKey) {
      const cached = await getCachedExplorePosts(cacheKey);
      if (cached) {
        return NextResponse.json({
          ok: true,
          posts: cached.posts.map((post) => ({
            ...post,
            likedByMe: viewerEmail && Array.isArray(post.likes) ? post.likes.includes(viewerEmail) : false,
          })),
          nextCursor: cached.nextCursor,
        });
      }
    }

    const db = await getDb();
    await ensureExploreIndexes(db);
    const posts = explorePostsCollection(db);

    const filter: Record<string, unknown> = { status: "Published" };
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!Number.isNaN(cursorDate.getTime())) {
        filter.publishedAt = { $lt: cursorDate };
      }
    }

    const docs = await posts
      .find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(limit)
      .toArray();

    const nextCursor =
      docs.length === limit
        ? docs[docs.length - 1]?.publishedAt?.toISOString?.() ||
          docs[docs.length - 1]?.createdAt?.toISOString?.() ||
          null
        : null;

    const rawPosts = docs.map((doc) => ({
      ...serializeExplorePost(doc, null),
      likes: Array.isArray(doc.likes) ? doc.likes : [],
    }));

    if (cacheKey) {
      void setCachedExplorePosts(cacheKey, { posts: rawPosts, nextCursor });
    }

    return NextResponse.json({
      ok: true,
      posts: rawPosts.map((post) => ({
        ...post,
        likedByMe: viewerEmail ? post.likes.includes(viewerEmail) : false,
      })),
      nextCursor,
    });
  } catch (error) {
    console.error("[explore/posts] GET error", error);
    return NextResponse.json(
      { error: "Failed to load explore feed" },
      { status: 500 },
    );
  }
}
