import { NextResponse } from "next/server";
import { auth } from "@/auth";

const WALLET_URL = process.env.WALLET_URL ?? "http://localhost:3001";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ err: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${WALLET_URL}/wallet/balance/${session.user.id}`, {
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(data);
}
