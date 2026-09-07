import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import {
  ensureExploreIndexes,
  exploreCommentsCollection,
  explorePostsCollection,
} from "@/lib/explore/db";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const db = await getDb();
    await ensureExploreIndexes(db);
    const comments = await exploreCommentsCollection(db)
      .find({ postId: new ObjectId(id) })
      .sort({ createdAt: 1 })
      .limit(100)
      .toArray();

    // Fetch latest user profile pictures/avatars from users collection
    const emails = Array.from(new Set(comments.map((c) => c.userEmail).filter(Boolean)));
    const users = emails.length > 0
      ? await db.collection("users").find(
          { email: { $in: emails } },
          { projection: { email: 1, profilePicture: 1, avatarSeed: 1 } }
        ).toArray()
      : [];

    const userAvatarMap = new Map<string, string>();
    for (const u of users) {
      if (u.email) {
        const avatar = u.profilePicture || `https://api.navii.dev/avatar/${encodeURIComponent(u.avatarSeed || String(u._id))}?size=96&tileBg=auto`;
        userAvatarMap.set(u.email.toLowerCase(), avatar);
      }
    }

    return NextResponse.json({
      ok: true,
      comments: comments.map((c) => ({
        id: String(c._id),
        postId: String(c.postId),
        parentId: c.parentId ? String(c.parentId) : null,
        userEmail: c.userEmail,
        userName: c.userName,
        userAvatar: (c.userEmail && userAvatarMap.get(c.userEmail.toLowerCase())) || c.userAvatar || "/hero/avatar.png",
        text: c.text,
        likes: Array.isArray(c.likes) ? c.likes : [],
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[explore/posts/:id/comments] GET error", error);
    return NextResponse.json(
      { error: "Failed to load comments" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const userName =
      typeof body.userName === "string" ? body.userName.trim() : "";
    const reqAvatar =
      typeof body.userAvatar === "string" && body.userAvatar.trim()
        ? body.userAvatar.trim()
        : "/hero/avatar.png";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const parentId = typeof body.parentId === "string" && ObjectId.isValid(body.parentId) ? new ObjectId(body.parentId) : null;

    if (!email) {
      return NextResponse.json(
        { error: "Sign in to comment" },
        { status: 401 },
      );
    }
    if (!text) {
      return NextResponse.json({ error: "Comment cannot be empty" }, { status: 400 });
    }

    const db = await getDb();
    await ensureExploreIndexes(db);
    const posts = explorePostsCollection(db);
    const post = await posts.findOne({
      _id: new ObjectId(id),
      status: "Published",
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (parentId) {
      const parent = await exploreCommentsCollection(db).findOne({ _id: parentId, postId: new ObjectId(id) });
      if (!parent) return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
    }

    // Resolve latest user avatar from users collection
    const userDoc = await db.collection("users").findOne(
      { email },
      { projection: { profilePicture: 1, avatarSeed: 1 } }
    );
    const userAvatar = userDoc
      ? (userDoc.profilePicture || `https://api.navii.dev/avatar/${encodeURIComponent(userDoc.avatarSeed || String(userDoc._id))}?size=96&tileBg=auto`)
      : reqAvatar;

    const now = new Date();
    const doc = {
      postId: new ObjectId(id),
      parentId,
      userEmail: email,
      userName: userName || email.split("@")[0] || "User",
      userAvatar,
      text,
      likes: [] as string[],
      createdAt: now,
    };

    const result = await exploreCommentsCollection(db).insertOne(doc);
    await posts.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { commentCount: 1 }, $set: { updatedAt: now } },
    );

    return NextResponse.json({
      ok: true,
      comment: {
        id: String(result.insertedId),
        postId: id,
        parentId: parentId ? String(parentId) : null,
        userEmail: doc.userEmail,
        userName: doc.userName,
        userAvatar: doc.userAvatar,
        text: doc.text,
        likes: [],
        createdAt: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("[explore/posts/:id/comments] POST error", error);
    return NextResponse.json(
      { error: "Failed to post comment" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const commentId = typeof body.commentId === "string" ? body.commentId : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!ObjectId.isValid(id) || !ObjectId.isValid(commentId) || !email) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    const db = await getDb();
    const comments = exploreCommentsCollection(db);
    const filter = { _id: new ObjectId(commentId), postId: new ObjectId(id) };
    const current = await comments.findOne(filter, { projection: { likes: 1 } });
    if (!current) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    const liked = !(current.likes || []).includes(email);
    if (liked) await comments.updateOne(filter, { $addToSet: { likes: email } });
    else await comments.updateOne(filter, { $pull: { likes: email } });
    return NextResponse.json({ ok: true, liked, likeCount: Math.max(0, (current.likes || []).length + (liked ? 1 : -1)) });
  } catch (error) {
    console.error("[explore/posts/:id/comments] PATCH error", error);
    return NextResponse.json({ error: "Failed to update comment like" }, { status: 500 });
  }
}
