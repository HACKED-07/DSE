import { NextResponse } from "next/server";
import { auth } from "@/auth";

const WALLET_URL = process.env.WALLET_URL ?? "http://localhost:3001";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ err: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json({ err: "Invalid amount" }, { status: 400 });
  }

  const res = await fetch(`${WALLET_URL}/wallet/credit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: session.user.id,
      asset: "USDT",
      amount,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(data);
}
