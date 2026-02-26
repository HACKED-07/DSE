"use client";

import { Button } from "@/components/ui/button";
import { useParams, useRouter } from "next/navigation";

type Market = "BTC" | "DOGE" | "DIDE" | "ETH";

export const Markets = () => {
  const { symbol } = useParams();
  const active = symbol?.toString().split("_")[0];
  const router = useRouter();
  function changeMarket(market: string) {
    router.replace(`${market}_USDT`);
  }
  return (
    <div className="flex flex-col w-36 justify-evenly">
      <MarketsButton
        market="BTC"
        onClick={() => changeMarket("BTC")}
        variant={active === "BTC" ? "default" : "secondary"}
      />
      <MarketsButton
        market="DOGE"
        onClick={() => changeMarket("DOGE")}
        variant={active === "DOGE" ? "default" : "secondary"}
      />
      <MarketsButton
        market="DIDE"
        onClick={() => changeMarket("DIDE")}
        variant={active === "DIDE" ? "default" : "secondary"}
      />
      <MarketsButton
        market="ETH"
        onClick={() => changeMarket("ETH")}
        variant={active === "ETH" ? "default" : "secondary"}
      />
    </div>
  );
};

export const MarketsButton = ({
  market,
  onClick,
  variant,
}: {
  market: Market;
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
      className="hover:cursor-pointer focus:cursor-not-allowed"
    >
      {market}
    </Button>
  );
};
