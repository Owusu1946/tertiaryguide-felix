
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

        return NextResponse.json({ ok: true, comments }, { status: 200 });
    } catch (error) {
        console.error("[blog/comments] GET error", error);
        return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { postId, parentId, userEmail, userName, userAvatar, text } = body;

        if (!postId || !userEmail || !userName || !text) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const db = await getDb();
        if (parentId) {
            if (!ObjectId.isValid(parentId) || !(await db.collection("blogComments").findOne({ _id: new ObjectId(parentId), postId }))) {
                return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
            }
        }
        const newComment = {
            postId,
            parentId: parentId || null,
            userEmail,
            userName,
            userAvatar: userAvatar || "/woman.png",
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
