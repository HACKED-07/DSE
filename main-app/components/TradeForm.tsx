"use client";

import { useState, useEffect } from "react";
import { Button } from "./ui/button";

type Balances = Record<
  string,
  { total: number; locked: number; available: number }
>;

export const TradeForm = ({ symbol }: { symbol: string }) => {
  const [orderType, setOrderType] = useState<"BUY" | "SELL">("BUY");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [balances, setBalances] = useState<Balances | null>(null);

  const market = symbol.replace("_", "/");
  const [baseAsset, quoteAsset] = symbol.split("_");

  useEffect(() => {
    const refreshBalances = () => {
      fetch("/api/balance")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setBalances(data))
        .catch(() => {});
    };

    refreshBalances();

    const onWalletUpdate = () => refreshBalances();
    window.addEventListener("wallet:balance-updated", onWalletUpdate);

    return () => {
      window.removeEventListener("wallet:balance-updated", onWalletUpdate);
    };
  }, []);

  const handleSubmit = async () => {
    const numPrice = Number(price);
    const numQty = Number(qty);

    if (!numPrice || numPrice <= 0) {
      setResult({ type: "error", message: "Enter a valid price" });
      return;
    }
    if (!numQty || numQty <= 0) {
      setResult({ type: "error", message: "Enter a valid quantity" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price: numPrice,
          qty: numQty,
          orderType,
          market,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({
          type: "success",
          message: `Order placed! ID: ${data.orderId?.slice(0, 12)}…`,
        });
        setPrice("");
        setQty("");
        window.dispatchEvent(
          new CustomEvent("orderbook:resync", {
            detail: { symbol },
          }),
        );
        window.dispatchEvent(new Event("wallet:balance-updated"));
      } else {
        setResult({
          type: "error",
          message: data.err || "Order failed",
        });
      }
    } catch {
      setResult({ type: "error", message: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  const total = Number(price) * Number(qty) || 0;
  const relevantAsset = orderType === "BUY" ? quoteAsset : baseAsset;
  const relevantBalance = balances?.[relevantAsset]?.available ?? 0;

  return (
    <div className="space-y-4">
      {/* Order type toggle */}
      <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
        <button
          onClick={() => {
            setOrderType("BUY");
            setResult(null);
          }}
          className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
            orderType === "BUY"
              ? "bg-emerald-500 text-white shadow-sm"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          BUY
        </button>
        <button
          onClick={() => {
            setOrderType("SELL");
            setResult(null);
          }}
          className={`flex-1 rounded-lg py-2.5 text-sm font-bold transition-all ${
            orderType === "SELL"
              ? "bg-rose-500 text-white shadow-sm"
              : "text-zinc-600 hover:text-zinc-900"
          }`}
        >
          SELL
        </button>
      </div>

      {/* Balance display */}
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500">Available</span>
          <span className="text-sm font-bold tabular-nums text-zinc-900">
            {relevantBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            })}{" "}
            <span className="text-xs font-semibold text-zinc-500">
              {relevantAsset}
            </span>
          </span>
        </div>
      </div>

      {/* Price input */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
          Price
        </label>
        <div className="relative">
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            min="0"
            step="any"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 pr-14 text-sm font-semibold tabular-nums text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#f0b90b] focus:ring-2 focus:ring-[#f0b90b]/20"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
            {quoteAsset}
          </span>
        </div>
      </div>

      {/* Quantity input */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-zinc-600">
          Quantity
        </label>
        <div className="relative">
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0.00"
            min="0"
            step="any"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 pr-14 text-sm font-semibold tabular-nums text-zinc-950 outline-none transition-colors placeholder:text-zinc-400 focus:border-[#f0b90b] focus:ring-2 focus:ring-[#f0b90b]/20"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">
            {baseAsset}
          </span>
        </div>
      </div>

      {/* Total */}
      <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500">Total</span>
          <span className="text-sm font-bold tabular-nums text-zinc-900">
            {total.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 8,
            })}{" "}
            <span className="text-xs font-semibold text-zinc-500">
              {quoteAsset}
            </span>
          </span>
        </div>
      </div>

      {/* Result message */}
      {result && (
        <div
          className={`rounded-xl px-3 py-2 text-xs font-medium ${
            result.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          {result.message}
        </div>
      )}

      {/* Submit button */}
      <Button
        onClick={handleSubmit}
        disabled={loading || !price || !qty}
        className={`w-full rounded-xl py-5 text-sm font-bold hover:cursor-pointer disabled:opacity-50 ${
          orderType === "BUY"
            ? "bg-emerald-500 text-white hover:bg-emerald-400"
            : "bg-rose-500 text-white hover:bg-rose-400"
        }`}
      >
        {loading
          ? "Placing order…"
          : `${orderType} ${baseAsset}`}
      </Button>
    </div>
  );
};
