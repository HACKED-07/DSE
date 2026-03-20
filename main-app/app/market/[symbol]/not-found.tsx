import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DEFAULT_MARKET_SYMBOL, MARKET_PAIRS } from "@/lib/markets";

export default function Page() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-4xl items-center px-6 py-12">
      <div className="w-full rounded-[2rem] border border-zinc-200 bg-white p-8 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.45)]">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Invalid market
        </div>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-zinc-950">
          This trading pair is not available.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
          Choose one of the supported markets below. The UI now exposes only
          valid routes, so market navigation stays consistent.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {MARKET_PAIRS.map((market) => (
            <Button
              key={market.symbol}
              asChild
              variant="outline"
              className="rounded-xl"
            >
              <Link href={`/market/${market.symbol}`}>
                {market.baseAsset}/{market.quoteAsset}
              </Link>
            </Button>
          ))}
        </div>
        <div className="mt-6">
          <Button asChild className="rounded-xl bg-zinc-950 hover:bg-zinc-800">
            <Link href={`/market/${DEFAULT_MARKET_SYMBOL}`}>Go to default market</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
