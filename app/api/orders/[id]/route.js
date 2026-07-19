import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/orders/:id — used by the customer's confirmation screen to poll status
export async function GET(_req, { params }) {
  const order = await db.order.findUnique({ where: { id: Number(params.id) } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order });
}

// PATCH /api/orders/:id — admin only: accept/reject/price/assign/update status
export async function PATCH(req, { params }) {
  const adminKey = req.headers.get("x-admin-key");
  if (!adminKey || adminKey !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const allowed = [
    "status",
    "itemPrice",
    "deliveryCharge",
    "totalPrice",
    "rejectionReason",
    "deliveryPartner",
    "paymentMethod",
    "paymentClaimed",
    "paymentReceived",
  ];

  const data = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  // auto-calc total if both price fields are present and total wasn't sent explicitly
  if (data.itemPrice !== undefined && data.totalPrice === undefined) {
    const delivery = data.deliveryCharge ?? 0;
    data.totalPrice = Number(data.itemPrice) + Number(delivery);
  }

  const order = await db.order.update({
    where: { id: Number(params.id) },
    data,
  });

  return NextResponse.json({ order });
}
