import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/mongodb";

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const currentEmail = normalizeEmail(body?.email);
    const nextEmailRaw = body?.newEmail ?? body?.email;
    const nextEmail = normalizeEmail(nextEmailRaw);

    if (!currentEmail) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!nextEmail || !isValidEmail(nextEmail)) {
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 },
      );
    }

    const username =
      typeof body?.username === "string" ? body.username.trim() : undefined;
    const phone =
      typeof body?.phone === "string" ? body.phone.trim() : undefined;

    const db = await getDb();
    const users = db.collection("users");
    const user = await users.findOne({ email: currentEmail });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const emailChanged = nextEmail !== currentEmail;
    if (emailChanged) {
      const taken = await users.findOne({
        email: nextEmail,
        _id: { $ne: user._id },
      });
      if (taken) {
        return NextResponse.json(
          { error: "That email is already in use by another account" },
          { status: 409 },
        );
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (username !== undefined) updateData.username = username;
    if (phone !== undefined) updateData.phone = phone;
    if (emailChanged) updateData.email = nextEmail;

    await users.updateOne({ _id: user._id }, { $set: updateData });

    if (emailChanged) {
      await Promise.all([
        db
          .collection("formPayments")
          .updateMany({ email: currentEmail }, { $set: { email: nextEmail } }),
        db
          .collection("checkerPayments")
          .updateMany({ email: currentEmail }, { $set: { email: nextEmail } }),
        db
          .collection("admissionPayments")
          .updateMany({ email: currentEmail }, { $set: { email: nextEmail } }),
        db.collection("admissionVouchers").updateMany(
          { purchasedBy: currentEmail },
          { $set: { purchasedBy: nextEmail } },
        ),
        db
          .collection("admissionVouchers")
          .updateMany({ usedBy: currentEmail }, { $set: { usedBy: nextEmail } }),
        db.collection("applications").updateMany(
          { applicantEmail: currentEmail },
          { $set: { applicantEmail: nextEmail } },
        ),
        db.collection("applications").updateMany(
          { "personalInfo.email": currentEmail },
          { $set: { "personalInfo.email": nextEmail } },
        ),
        db
          .collection("userNotifications")
          .updateMany({ email: currentEmail }, { $set: { email: nextEmail } }),
      ]);
    }

    return NextResponse.json({
      success: true,
      email: nextEmail,
      emailChanged,
    });
  } catch (error) {
    console.error("Error updating user info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
