import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/orders/:id/mark-paid — public: customer taps "मैंने भुगतान कर दिया"
// after scanning the QR. This only sets a claim flag — the admin still
// verifies the money actually arrived before moving the order forward.
export async function POST(_req, { params }) {
  const order = await db.order.update({
    where: { id: Number(params.id) },
    data: { paymentClaimed: true },
  });
  return NextResponse.json({ order });
}
