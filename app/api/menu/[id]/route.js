import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function checkAdmin(req) {
  const adminKey = req.headers.get("x-admin-key");
  return adminKey && adminKey === process.env.ADMIN_PASSWORD;
}

// PATCH /api/menu/:id — admin only, edit name/price/availability/etc
export async function PATCH(req, { params }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed = ["category", "name", "price", "unit", "isAvailable", "sortOrder"];
  const data = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = key === "price" ? Number(body[key]) : body[key];
  }
  const item = await db.menuItem.update({ where: { id: Number(params.id) }, data });
  return NextResponse.json({ item });
}

// DELETE /api/menu/:id — admin only
export async function DELETE(req, { params }) {
  if (!checkAdmin(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.menuItem.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
