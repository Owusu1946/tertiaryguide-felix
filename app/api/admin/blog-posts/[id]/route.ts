import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../../lib/mongodb";
import { notifyNewsOptInUsers } from "../../../../../lib/user-notifications-server";

interface BlogPostDoc {
    _id?: ObjectId;
    title: string;
    slug: string;
    contentHtml: string;
    featuredImageUrl?: string | null;
    status: "Draft" | "Published" | "Scheduled";
    scheduledAt?: Date | null;
    publishedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    schoolId?: string | null;
    isAd?: boolean;
    showOnHomepage?: boolean;
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const db = await getDb();
        const post = await db
            .collection<BlogPostDoc>("blogPosts")
            .findOne({ _id: new ObjectId(id) });

        if (!post) {
            return NextResponse.json(
                { error: "Blog post not found" },
                { status: 404 },
            );
        }

        return NextResponse.json(
            {
                ok: true,
                post: {
                    id: String(post._id),
                    title: post.title,
                    slug: post.slug,
                    contentHtml: post.contentHtml,
                    featuredImageUrl: post.featuredImageUrl ?? null,
                    status: post.status,
                    scheduledAt: post.scheduledAt ? post.scheduledAt.toISOString() : "",
                    updatedAt: post.updatedAt.toISOString(),
                    schoolId: post.schoolId || null,
                    isAd: post.isAd === true,
                    showOnHomepage: post.showOnHomepage === true,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("[admin/blog-posts/[id]] GET error", error);
        return NextResponse.json(
            { error: "Failed to load blog post" },
            { status: 500 },
        );
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const body = await req.json().catch(() => null);

        const titleRaw = typeof body?.title === "string" ? body.title.trim() : "";
        const contentHtmlRaw =
            typeof body?.contentHtml === "string" ? body.contentHtml.trim() : "";
        const featuredImageUrlRaw =
            typeof body?.featuredImageUrl === "string"
                ? body.featuredImageUrl.trim()
                : "";
        const statusRaw = typeof body?.status === "string" ? body.status : "";
        const scheduledAtRaw =
            typeof body?.scheduledAt === "string" ? body.scheduledAt : "";
        const schoolId = typeof body?.schoolId === "string" ? body.schoolId.trim() : null;
        const isAd = body?.isAd === true;
        const showOnHomepage = body?.showOnHomepage === true;

        if (!titleRaw) {
            return NextResponse.json(
                { error: "Title is required" },
                { status: 400 },
            );
        }

        if (!contentHtmlRaw) {
            return NextResponse.json(
                { error: "Content is required" },
                { status: 400 },
            );
        }

        const allowedStatuses = ["Draft", "Published", "Scheduled"] as const;
        const status = allowedStatuses.includes(statusRaw as any)
            ? (statusRaw as BlogPostDoc["status"])
            : "Draft";

        let scheduledAt: Date | null = null;
        if (status === "Scheduled" && scheduledAtRaw) {
            const d = new Date(scheduledAtRaw);
            if (!Number.isNaN(d.getTime())) {
                scheduledAt = d;
            }
        }

        const now = new Date();
        let publishedAt: Date | null = null;
        if (status === "Published") {
            publishedAt = now;
        } else if (status === "Scheduled" && scheduledAt) {
            publishedAt = scheduledAt;
        }

        const db = await getDb();
        const posts = db.collection<BlogPostDoc>("blogPosts");
        const existing = await posts.findOne({ _id: new ObjectId(id) });

        const result = await posts.findOneAndUpdate(
            { _id: new ObjectId(id) },
            {
                $set: {
                    title: titleRaw,
                    contentHtml: contentHtmlRaw,
                    featuredImageUrl: featuredImageUrlRaw || null,
                    status,
                    scheduledAt,
                    publishedAt: publishedAt ?? undefined, // Only update if changing to published/scheduled
                    updatedAt: now,
                    schoolId: schoolId || null,
                    isAd,
                    showOnHomepage: schoolId ? showOnHomepage : false,
                },
            },
            { returnDocument: "after" },
        );

        const updatedDoc = (result as any)?.value || result; // Helper for different mongodb driver versions

        if (!updatedDoc) {
            return NextResponse.json(
                { error: "Blog post not found or update failed" },
                { status: 404 },
            );
        }

        const becamePublished =
            status === "Published" && existing?.status !== "Published";
        if (becamePublished) {
            void notifyNewsOptInUsers(db, {
                title: "New on TertiaryGuide News",
                body: titleRaw,
                kind: "news",
                href: `/blog/${updatedDoc.slug || id}`,
                dedupeKey: `blog-post:${id}`,
            }).catch((err) =>
                console.error("[admin/blog-posts/[id]] notify users", err),
            );
        }

        return NextResponse.json(
            {
                ok: true,
                post: {
                    id: String(updatedDoc._id),
                    title: updatedDoc.title,
                    status: updatedDoc.status,
                    featuredImageUrl: updatedDoc.featuredImageUrl,
                    updatedAt: updatedDoc.updatedAt.toISOString(),
                    schoolId: updatedDoc.schoolId || null,
                    isAd: updatedDoc.isAd === true,
                    showOnHomepage: updatedDoc.showOnHomepage === true,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("[admin/blog-posts/[id]] PUT error", error);
        return NextResponse.json(
            { error: "Failed to update blog post" },
            { status: 500 },
        );
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const body = await req.json().catch(() => null);
        if (typeof body?.showOnHomepage !== "boolean") {
            return NextResponse.json(
                { error: "showOnHomepage boolean is required" },
                { status: 400 },
            );
        }

        const db = await getDb();
        const posts = db.collection<BlogPostDoc>("blogPosts");
        const existing = await posts.findOne({ _id: new ObjectId(id) });
        if (!existing) {
            return NextResponse.json(
                { error: "Blog post not found" },
                { status: 404 },
            );
        }

        if (!existing.schoolId) {
            return NextResponse.json(
                {
                    error:
                        "Homepage featuring applies to school blog posts only",
                },
                { status: 400 },
            );
        }

        const result = await posts.findOneAndUpdate(
            { _id: new ObjectId(id) },
            {
                $set: {
                    showOnHomepage: body.showOnHomepage,
                    updatedAt: new Date(),
                },
            },
            { returnDocument: "after" },
        );

        const updatedDoc = (result as { value?: BlogPostDoc } | BlogPostDoc | null);
        const post =
            updatedDoc && "value" in updatedDoc
                ? updatedDoc.value
                : (updatedDoc as BlogPostDoc | null);

        if (!post) {
            return NextResponse.json(
                { error: "Blog post not found or update failed" },
                { status: 404 },
            );
        }

        return NextResponse.json({
            ok: true,
            post: {
                id: String(post._id),
                title: post.title,
                status: post.status,
                featuredImageUrl: post.featuredImageUrl ?? null,
                updatedAt: post.updatedAt.toISOString(),
                schoolId: post.schoolId || null,
                isAd: post.isAd === true,
                showOnHomepage: post.showOnHomepage === true,
            },
        });
    } catch (error) {
        console.error("[admin/blog-posts/[id]] PATCH error", error);
        return NextResponse.json(
            { error: "Failed to update homepage feature flag" },
            { status: 500 },
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        if (!ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
        }

        const db = await getDb();
        const result = await db
            .collection("blogPosts")
            .deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 0) {
            return NextResponse.json(
                { error: "Blog post not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
        console.error("[admin/blog-posts/[id]] DELETE error", error);
        return NextResponse.json(
            { error: "Failed to delete blog post" },
            { status: 500 },
        );
    }
}
