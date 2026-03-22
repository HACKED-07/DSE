import { NextResponse } from "next/server";
import { auth } from "@/auth";

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:3002";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ err: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { price, qty, orderType, market } = body;

  if (!price || !qty || !orderType || !market) {
    return NextResponse.json({ err: "Missing fields" }, { status: 400 });
  }

  const res = await fetch(`${ENGINE_URL}/order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: session.user.id,
      price: Number(price),
      qty: Number(qty),
      orderType,
      market,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(data);
}
