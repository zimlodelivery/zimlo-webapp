import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/settings — public: brand name, UPI ID (needed to build the payment QR), contact phone
export async function GET() {
  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  return NextResponse.json({ settings });
}

// PATCH /api/settings — admin only
export async function PATCH(req) {
  const adminKey = req.headers.get("x-admin-key");
  if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const allowed = ["upiId", "brandName", "contactPhone"];
  const data = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }
  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  return NextResponse.json({ settings });
}
