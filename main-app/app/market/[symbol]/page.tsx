import { Chart } from "@/components/Chart";
import { OrderBook } from "@/components/orderBook";
import { notFound } from "next/navigation";
import { Markets } from "./markets";
import { PlaceOrderButton } from "@/components/placeorder-button";

export default async function Page({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const p1 = await fetch(`http://localhost:3002/ohlc/${symbol}`, {
    cache: "no-store",
  });
  const p2 = await fetch(`http://localhost:3002/markets/${symbol}`);
  const [res, orderBook] = await Promise.all([p1, p2]);
  if (!res.ok) notFound();
  const [ohlcData, orderBookData] = await Promise.all([
    res.json(),
    orderBook.json(),
  ]);
  if (!ohlcData.candles || !orderBookData) notFound();
  return (
    <div className="flex h-screen">
      <Markets />
      <Chart data={ohlcData.candles} />
      <div>
        <div className="h-11/12 overflow-scroll">
          BIDS
          <OrderBook type="buys" data={orderBookData["buys"]} symbol={symbol} />
          ASKS
          <OrderBook
            type="sells"
            data={orderBookData["sells"]}
            symbol={symbol}
          />
        </div>
        <div>
          <PlaceOrderButton />
        </div>
      </div>
    </div>
  );
}
