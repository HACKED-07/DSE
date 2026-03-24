import Link from "next/link";
import { ArrowRight, CandlestickChart, Wallet } from "lucide-react";
import { Session } from "next-auth";
import { Button } from "./ui/button";
import { DEFAULT_MARKET_SYMBOL } from "@/lib/markets";
import { getAllResolvedMarkets } from "@/lib/market-data";

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function formatPercent(value: number | null) {
  if (value === null) return "Flat";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export const Dashboard = async ({ session }: { session: Session }) => {
  const markets = await getAllResolvedMarkets();

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <section className="animate-fade-in-up overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_28px_80px_-48px_rgba(15,23,42,0.45)]">
        <div className="grid gap-10 bg-[radial-gradient(circle_at_top_left,_rgba(240,185,11,0.18),_transparent_34%),linear-gradient(180deg,_#fffdf7_0%,_#ffffff_55%,_#f8fafc_100%)] px-6 py-8 text-zinc-950 md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-10">
          <div className="space-y-5">
            <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-900">
              Welcome back
            </div>
            <div className="max-w-2xl space-y-3">
              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                Trade fast, stay in sync, and move between markets without dead ends.
              </h1>
              <p className="max-w-xl text-base leading-7 text-zinc-600 md:text-lg">
                Your market routes are now limited to valid symbols, and the
                trading surface is ready to jump straight into live order books.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-xl bg-[#f0b90b] px-6 font-semibold text-zinc-950 shadow-[0_8px_24px_-8px_rgba(240,185,11,0.5)] transition-all duration-200 hover:bg-[#ddb02d] hover:shadow-[0_12px_32px_-8px_rgba(240,185,11,0.6)]"
              >
                <Link href={`/market/${DEFAULT_MARKET_SYMBOL}`}>
                  Open Trade Desk
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-600 shadow-sm">
                Signed in as {session.user?.email}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
            <div className="animate-fade-in-up delay-200 rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-3 flex items-center gap-3 text-zinc-500">
                <CandlestickChart className="size-4" />
                Trading access
              </div>
              <div className="text-3xl font-black">
                {markets.length} active pairs
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-600">
                BTC, ETH, DOGE, and DIDE are the only UI routes exposed, which
                prevents invalid market navigation from the dashboard.
              </div>
            </div>
            <div className="animate-fade-in-up delay-300 rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-3 flex items-center gap-3 text-zinc-500">
                <Wallet className="size-4" />
                Market coverage
              </div>
              <div className="text-3xl font-black">
                {compactFormat.format(
                  markets.reduce(
                    (sum, market) => sum + market.stats.visibleLiquidity,
                    0,
                  ),
                )}{" "}
                depth
              </div>
              <div className="mt-2 text-sm leading-6 text-zinc-600">
                Visible order-book liquidity is now pulled from the matching
                engine instead of hard-coded labels.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="animate-fade-in-up delay-200 mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Markets
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
              Pick a valid market
            </h2>
          </div>
          <div className="text-sm text-zinc-500">
            All links resolve only to supported market routes.
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {markets.map((market, index) => (
            <Link
              key={market.symbol}
              href={`/market/${market.symbol}`}
              className={`animate-fade-in-up group overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-[0_22px_50px_-42px_rgba(15,23,42,0.45)] transition-all duration-250 hover:-translate-y-1.5 hover:shadow-[0_28px_60px_-35px_rgba(15,23,42,0.5)] ${market.accent}`}
              style={{ animationDelay: `${300 + index * 100}ms` }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                    {market.name}
                  </div>
                  <div className="mt-2 text-2xl font-black tracking-tight text-zinc-950">
                    {market.baseAsset}/{market.quoteAsset}
                  </div>
                </div>
                <div
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    (market.stats.changePercent ?? 0) >= 0
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {formatPercent(market.stats.changePercent)}
                </div>
              </div>
              <div className="mt-8 grid gap-4 text-sm text-zinc-600">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="text-xs uppercase tracking-[0.25em] text-zinc-500">
                    Last price
                  </div>
                  <div className="mt-1 text-xl font-bold text-zinc-950">
                    {market.stats.lastPrice === null
                      ? "Unavailable"
                      : priceFormat.format(market.stats.lastPrice)}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Visible liquidity</span>
                  <span className="font-semibold text-zinc-900">
                    {compactFormat.format(market.stats.visibleLiquidity)}
                  </span>
                </div>
              </div>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-950">
                Trade now
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};
