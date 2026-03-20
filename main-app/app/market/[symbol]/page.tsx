import { Chart } from "@/components/Chart";
import { LiveMarketStats } from "@/components/LiveMarketStats";
import { OrderBook } from "@/components/orderBook";
import { notFound } from "next/navigation";
import { Markets } from "./markets";
import { PlaceOrderButton } from "@/components/placeorder-button";
import { getMarketBySymbol, isValidMarketSymbol } from "@/lib/markets";
import { getMarketStats } from "@/lib/market-data";

export default async function Page({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  if (!isValidMarketSymbol(symbol)) {
    notFound();
  }

  const market = getMarketBySymbol(symbol);

  const [res, orderBook, stats] = await Promise.all([
    fetch(`http://localhost:3002/ohlc/${symbol}`, {
      cache: "no-store",
    }),
    fetch(`http://localhost:3002/markets/${symbol}`, {
      cache: "no-store",
    }),
    getMarketStats(symbol),
  ]);

  if (!res.ok || !orderBook.ok || !market) notFound();

  const [ohlcData, orderBookData] = await Promise.all([
    res.json(),
    orderBook.json(),
  ]);
  if (!Array.isArray(ohlcData.candles) || !orderBookData) notFound();

  return (
    <div className="grid min-h-[calc(100vh-5.5rem)] grid-cols-1 gap-6 bg-zinc-50 p-6 xl:grid-cols-[15rem_minmax(0,1fr)_24rem]">
      <Markets />

      <div className="space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(240,185,11,0.18),_transparent_34%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 text-zinc-950 shadow-[0_28px_80px_-48px_rgba(15,23,42,0.25)]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-500">
                Active market
              </div>
              <h1 className="mt-3 text-4xl font-black tracking-tight">
                {market.baseAsset}/{market.quoteAsset}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600 md:text-base">
                The route is validated before render, so unsupported symbols
                never reach the trading surface.
              </p>
            </div>

            <LiveMarketStats symbol={symbol} initialStats={stats} />
          </div>
        </div>

        <div className="min-h-180 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.45)]">
          <Chart data={ohlcData.candles} />
        </div>
      </div>

      <div className="flex min-h-180 flex-col gap-4">
        <div className="min-h-0 flex-1">
          <OrderBook initialData={orderBookData} symbol={symbol} />
        </div>
        <div className="rounded-[2rem] border border-zinc-200 bg-white p-3 shadow-[0_18px_50px_-45px_rgba(15,23,42,0.45)]">
          <PlaceOrderButton />
        </div>
      </div>
    </div>
  );
}
