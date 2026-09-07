import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "../../../../lib/mongodb";
import { notifyNewsOptInUsers } from "../../../../lib/user-notifications-server";

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
  /** Platform admin/superadmin: feature this school post on homepage + /blog. */
  showOnHomepage?: boolean;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function GET(_req: NextRequest) {
  try {
    const db = await getDb();
    const posts = db.collection<BlogPostDoc>("blogPosts");

    const docs = await posts
      .find({}, { sort: { updatedAt: -1 } })
      .limit(50)
      .toArray();

    return NextResponse.json(
      {
        ok: true,
        posts: docs.map((doc) => ({
          id: String(doc._id),
          title: doc.title,
          status: doc.status,
          featuredImageUrl: doc.featuredImageUrl ?? null,
          updatedAt: doc.updatedAt.toISOString(),
          schoolId: doc.schoolId || null,
          isAd: doc.isAd === true,
          showOnHomepage: doc.showOnHomepage === true,
        })),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[admin/blog-posts] GET error", error);
    return NextResponse.json(
      { error: "Failed to load blog posts" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null as unknown as null);

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

    await posts.createIndex({ slug: 1 }, { unique: true });

    const baseSlug = slugify(titleRaw) || "post";
    let slug = baseSlug;
    let counter = 1;

    // ensure slug uniqueness
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existing = await posts.findOne({ slug });
      if (!existing) break;
      counter += 1;
      slug = `${baseSlug}-${counter}`;
    }

    const doc: BlogPostDoc = {
      title: titleRaw,
      slug,
      contentHtml: contentHtmlRaw,
      featuredImageUrl: featuredImageUrlRaw || null,
      status,
      scheduledAt,
      publishedAt,
      createdAt: now,
      updatedAt: now,
      schoolId: schoolId || null,
      isAd,
      showOnHomepage: schoolId ? showOnHomepage : false,
    };

    const result = await posts.insertOne(doc);

    if (status === "Published") {
      void notifyNewsOptInUsers(db, {
        title: "New on TertiaryGuide News",
        body: titleRaw,
        kind: "news",
        href: `/blog/${slug}`,
        dedupeKey: `blog-post:${String(result.insertedId)}`,
      }).catch((err) =>
        console.error("[admin/blog-posts] notify users", err),
      );
    }

    return NextResponse.json(
      {
        ok: true,
        post: {
          id: result.insertedId.toString(),
          title: doc.title,
          status: doc.status,
          featuredImageUrl: doc.featuredImageUrl,
          updatedAt: doc.updatedAt.toISOString(),
          schoolId: doc.schoolId || null,
          isAd: doc.isAd === true,
          showOnHomepage: doc.showOnHomepage === true,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[admin/blog-posts] POST error", error);
    return NextResponse.json(
      { error: "Failed to create blog post" },
      { status: 500 },
    );
  }
}
