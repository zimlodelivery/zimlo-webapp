import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { notifyAdminOnWhatsapp } from "@/lib/notifyWhatsapp";

// GET /api/orders
//   - as admin: send header "x-admin-key: <ADMIN_PASSWORD>" -> returns ALL orders
//   - as customer: send ?phone=9999999999 -> returns only that phone's orders
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  const adminKey = req.headers.get("x-admin-key");

  const isAdmin = adminKey && adminKey === process.env.ADMIN_PASSWORD;

  if (!isAdmin && !phone) {
    return NextResponse.json(
      { error: "Provide ?phone=... or a valid admin key" },
      { status: 400 }
    );
  }

  const orders = await db.order.findMany({
    where: isAdmin ? {} : { customerPhone: phone },
    orderBy: { createdAt: "desc" },
    take: isAdmin ? 200 : 50,
  });

  return NextResponse.json({ orders });
}

// POST /api/orders  — anyone can create an order (this is the public "place order" endpoint)
export async function POST(req) {
  const body = await req.json();

  const {
    category, // "food" | "custom"
    requestText,
    extraData,     // for food: cart array [{name, price, qty}]
    itemPrice,     // for food: pre-computed total from the fixed menu
    customerName,
    customerPhone,
    address,
  } = body;

  if (!category || !requestText || !customerName || !customerPhone) {
    return NextResponse.json(
      { error: "Missing required fields (category, requestText, customerName, customerPhone)" },
      { status: 400 }
    );
  }

  if (!/^[0-9]{10}$/.test(customerPhone)) {
    return NextResponse.json(
      { error: "customerPhone must be a 10-digit number" },
      { status: 400 }
    );
  }

  // Food orders come from the fixed menu — price is already known, so we skip
  // straight to CONFIRMED and let the customer pay immediately via QR.
  // Custom orders need the admin to set a price first, so they stay REQUESTED.
  const isFood = category === "food" && itemPrice != null;

  const order = await db.order.create({
    data: {
      category,
      requestText,
      extraData: extraData ? JSON.stringify(extraData) : null,
      customerName,
      customerPhone,
      address: address || null,
      status: isFood ? "CONFIRMED" : "REQUESTED",
      itemPrice: isFood ? Number(itemPrice) : null,
      totalPrice: isFood ? Number(itemPrice) : null,
    },
  });

  // Non-blocking: don't fail order creation if WhatsApp isn't configured/fails
  notifyAdminOnWhatsapp(order);

  return NextResponse.json({ order }, { status: 201 });
}
