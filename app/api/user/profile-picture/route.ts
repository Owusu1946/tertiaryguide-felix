
import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";
import { cacheUser } from "../../../../lib/redis";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { email, image, avatarSeed } = body;

        if (!email || (!image && !avatarSeed)) {
            return NextResponse.json(
                { error: "Email and an image or avatar seed are required" },
                { status: 400 },
            );
        }

        if (image && (typeof image !== "string" || !image.startsWith("data:image") || image.length > 2_800_000)) {
            return NextResponse.json(
                { error: "Invalid image format" },
                { status: 400 },
            );
        }

        const db = await getDb();
        const normalizedEmail = String(email).trim().toLowerCase();
        const useGenerated = typeof avatarSeed === "string" && avatarSeed.trim();
        const update = useGenerated
            ? { $set: { avatarSeed: avatarSeed.trim().slice(0, 128), profilePicture: null } }
            : { $set: { profilePicture: image } };
        const users = db.collection("users");
        const result = await users.updateOne({ email: normalizedEmail }, update);

        if (result.matchedCount === 0) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const user = await users.findOne({ email: normalizedEmail }, { projection: { username: 1, email: 1, phone: 1, profilePicture: 1, avatarSeed: 1 } });
        if (user?.email) {
            await cacheUser({ id: String(user._id), username: user.username || "", email: user.email, phone: user.phone, profilePicture: user.profilePicture ?? null, avatarSeed: user.avatarSeed ?? null });
            const newAvatarUrl = user.profilePicture || `https://api.navii.dev/avatar/${encodeURIComponent(user.avatarSeed || String(user._id))}?size=96&tileBg=auto`;
            await Promise.all([
                db.collection("exploreComments").updateMany({ userEmail: normalizedEmail }, { $set: { userAvatar: newAvatarUrl } }),
                db.collection("blogComments").updateMany({ userEmail: normalizedEmail }, { $set: { userAvatar: newAvatarUrl } }),
            ]).catch((err) => console.error("Failed to update comments userAvatar:", err));
        }
        return NextResponse.json({ success: true, profilePicture: user?.profilePicture ?? null, avatarSeed: user?.avatarSeed ?? null });
    } catch (error) {
        console.error("Error updating profile picture:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
        );
    }
}
