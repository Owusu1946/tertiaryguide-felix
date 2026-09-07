import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const postId = searchParams.get("postId");

        if (!postId) {
            return NextResponse.json({ error: "Missing postId" }, { status: 400 });
        }

        const db = await getDb();
        const comments = await db.collection("blogComments")
            .find({ postId })
            .sort({ createdAt: 1 })
            .toArray();

        // Fetch latest user avatars from users collection
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

        const updatedComments = comments.map((c) => ({
            ...c,
            _id: String(c._id),
            userAvatar: (c.userEmail && userAvatarMap.get(c.userEmail.toLowerCase())) || c.userAvatar || "/woman.png",
        }));

        return NextResponse.json({ ok: true, comments: updatedComments }, { status: 200 });
    } catch (error) {
        console.error("[blog/comments] GET error", error);
        return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { postId, parentId, userEmail, userName, userAvatar: reqAvatar, text } = body;

        if (!postId || !userEmail || !userName || !text) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const db = await getDb();
        if (parentId) {
            if (!ObjectId.isValid(parentId) || !(await db.collection("blogComments").findOne({ _id: new ObjectId(parentId), postId }))) {
                return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
            }
        }

        const userDoc = await db.collection("users").findOne(
            { email: userEmail.trim().toLowerCase() },
            { projection: { profilePicture: 1, avatarSeed: 1 } }
        );
        const resolvedAvatar = userDoc
            ? (userDoc.profilePicture || `https://api.navii.dev/avatar/${encodeURIComponent(userDoc.avatarSeed || String(userDoc._id))}?size=96&tileBg=auto`)
            : (reqAvatar || "/woman.png");

        const newComment = {
            postId,
            parentId: parentId || null,
            userEmail,
            userName,
            userAvatar: resolvedAvatar,
            text,
            likes: [],
            createdAt: new Date(),
        };

        const result = await db.collection("blogComments").insertOne(newComment);

        return NextResponse.json({ ok: true, comment: { ...newComment, _id: String(result.insertedId), createdAt: newComment.createdAt.toISOString() } }, { status: 201 });
    } catch (error) {
        console.error("[blog/comments] POST error", error);
        return NextResponse.json({ error: "Failed to post comment" }, { status: 500 });
    }
}
