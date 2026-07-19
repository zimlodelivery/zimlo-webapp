import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/menu — public, used by the customer app to show the food menu
export async function GET() {
  const items = await db.menuItem.findMany({
    where: { isAvailable: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ items });
}

// POST /api/menu — admin only, add a new item
export async function POST(req) {
  const adminKey = req.headers.get("x-admin-key");
  if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { category, name, price, unit } = body;
  if (!category || !name || price == null) {
    return NextResponse.json({ error: "category, name and price are required" }, { status: 400 });
  }
  const item = await db.menuItem.create({
    data: { category, name, price: Number(price), unit: unit || "plate" },
  });
  return NextResponse.json({ item }, { status: 201 });
}
