"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMarketByBaseAsset, MARKET_PAIRS } from "@/lib/markets";
import { useParams, useRouter } from "next/navigation";

export const Markets = () => {
  const { symbol } = useParams();
  const active = symbol?.toString().split("_")[0];
  const router = useRouter();
  function changeMarket(marketBaseAsset: string) {
    const market = getMarketByBaseAsset(marketBaseAsset);
    if (!market) return;
    router.replace(`/market/${market.symbol}`);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-[0_20px_50px_-42px_rgba(15,23,42,0.45)]">
      <div className="px-2">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          Markets
        </div>
        <div className="mt-1 text-sm text-zinc-600">
          Only valid pairs are listed.
        </div>
      </div>

      {MARKET_PAIRS.map((market) => {
        const isActive = active === market.baseAsset;
        return (
          <Button
            key={market.symbol}
            variant={isActive ? "default" : "secondary"}
            onClick={() => changeMarket(market.baseAsset)}
            className={cn(
              "h-14 justify-start rounded-2xl px-4 text-left font-semibold transition-all duration-200 hover:cursor-pointer",
              isActive
                ? "bg-amber-50 text-amber-900 shadow-sm hover:bg-amber-100"
                : "bg-zinc-50 text-zinc-700 hover:-translate-y-0.5 hover:bg-zinc-100 hover:shadow-sm",
            )}
          >
            <div className="flex w-full items-center gap-3">
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full transition-colors",
                  isActive ? "bg-amber-500" : "bg-zinc-300",
                )}
              />
              <div className="flex flex-col">
                <span className="text-[13px] font-bold leading-tight">
                  {market.baseAsset}/{market.quoteAsset}
                </span>
                <span className="text-[11px] font-medium leading-tight text-zinc-500">
                  {market.name}
                </span>
              </div>
            </div>
          </Button>
        );
      })}
    </div>
  );
};
