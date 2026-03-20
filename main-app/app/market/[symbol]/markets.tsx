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

      {MARKET_PAIRS.map((market) => (
        <MarketsButton
          key={market.symbol}
          market={market.baseAsset}
          onClick={() => changeMarket(market.baseAsset)}
          variant={active === market.baseAsset ? "default" : "secondary"}
        />
      ))}
    </div>
  );
};

export const MarketsButton = ({
  market,
  onClick,
  variant,
}: {
  market: string;
  onClick: () => void;
  variant?:
    | "link"
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost";
}) => {
  return (
    <Button
      variant={variant}
      onClick={onClick}
      className={cn(
        "h-12 justify-start rounded-2xl px-4 text-left font-semibold hover:cursor-pointer",
        variant === "default"
          ? "bg-amber-50 text-amber-900 hover:bg-amber-100"
          : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100",
      )}
    >
      {market}
    </Button>
  );
};
