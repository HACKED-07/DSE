"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, Wallet, X } from "lucide-react";
import { Button } from "./ui/button";

type Balances = Record<
  string,
  { total: number; locked: number; available: number }
>;

const PRESET_AMOUNTS = [100, 500, 1000, 5000];

function formatBalance(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const DepositModal = () => {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const availableUsdt = balances?.USDT?.available ?? 0;
  const lockedUsdt = balances?.USDT?.locked ?? 0;

  const fetchBalance = async () => {
    setLoadingBalance(true);
    try {
      const res = await fetch("/api/balance", { cache: "no-store" });
      if (!res.ok) return;

      const data = (await res.json()) as Balances;
      setBalances(data);
    } catch {
      // Ignore balance load failures in the modal.
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    void fetchBalance();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setAmount("");
    setResult(null);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleDeposit = async () => {
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setResult({ type: "error", message: "Enter a valid amount to continue." });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({
          type: "error",
          message: data.err || "Deposit failed. Please try again.",
        });
        return;
      }

      setResult({
        type: "success",
        message: `${parsedAmount.toLocaleString()} USDT added to your wallet.`,
      });
      setAmount("");
      window.dispatchEvent(new Event("wallet:balance-updated"));
      await fetchBalance();
    } catch {
      setResult({
        type: "error",
        message: "Network error while processing the deposit.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        className="rounded-xl bg-[#f0b90b] px-5 font-semibold text-zinc-950 hover:cursor-pointer hover:bg-[#ddb02d]"
      >
        Deposit
      </Button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[200]">
              <div
                className="absolute inset-0 bg-zinc-950/45 backdrop-blur-md"
                onClick={handleClose}
              />

              <div className="absolute inset-0 overflow-y-auto">
                <div className="flex min-h-full items-start justify-center px-4 py-6 sm:items-center sm:p-8">
                  <section className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.98)_100%)] shadow-[0_40px_120px_-36px_rgba(15,23,42,0.55)]">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(240,185,11,0.28),transparent_65%)]" />

                    <div className="relative border-b border-zinc-200/80 px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-3">
                          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-amber-800">
                            <Wallet className="h-3.5 w-3.5" />
                            Wallet Funding
                          </div>
                          <div>
                            <h2 className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
                              Deposit USDT
                            </h2>
                            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600">
                              Add test funds to your exchange wallet and use them
                              immediately on the trading screen.
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={handleClose}
                          className="rounded-full border border-zinc-200 bg-white p-2 text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-950"
                          aria-label="Close deposit modal"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="relative space-y-6 px-5 py-5 sm:px-7 sm:py-6">
                      <div className="grid gap-3 rounded-[1.5rem] border border-zinc-200/80 bg-white/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] sm:grid-cols-[1.25fr_0.9fr]">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                            Available Balance
                          </div>
                          <div className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
                            {loadingBalance ? "..." : formatBalance(availableUsdt)}
                            <span className="ml-2 text-sm font-bold text-zinc-500">
                              USDT
                            </span>
                          </div>
                        </div>

                        <div className="rounded-[1.15rem] border border-zinc-200 bg-zinc-50/90 p-3">
                          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                            Locked
                          </div>
                          <div className="mt-2 text-lg font-bold text-zinc-900">
                            {loadingBalance ? "..." : formatBalance(lockedUsdt)}
                            <span className="ml-1 text-xs font-semibold text-zinc-500">
                              USDT
                            </span>
                          </div>
                          <div className="mt-2 text-xs leading-5 text-zinc-500">
                            Funds reserved by open orders stay unavailable until
                            they are filled or canceled.
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-bold text-zinc-800">
                            Amount
                          </label>
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
                            Instant credit
                          </span>
                        </div>

                        <div className="relative">
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            placeholder="0.00"
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            className="h-18 w-full rounded-[1.35rem] border border-zinc-200 bg-white px-5 pr-24 text-3xl font-black tracking-tight text-zinc-950 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-200/60 placeholder:text-zinc-300"
                          />
                          <div className="absolute inset-y-3 right-3 flex items-center rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold text-zinc-700">
                            USDT
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          {PRESET_AMOUNTS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setAmount(String(preset))}
                              className="rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm font-bold text-zinc-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900"
                            >
                              {preset >= 1000 ? `${preset / 1000}K` : preset}
                            </button>
                          ))}
                        </div>
                      </div>

                      {result ? (
                        <div
                          className={`rounded-[1.25rem] border px-4 py-3 text-sm font-medium ${
                            result.type === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-rose-200 bg-rose-50 text-rose-800"
                          }`}
                        >
                          {result.message}
                        </div>
                      ) : null}

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button
                          onClick={handleDeposit}
                          disabled={loading || !amount}
                          className="h-14 flex-1 rounded-[1.2rem] bg-[linear-gradient(135deg,#f0b90b_0%,#f7d77d_100%)] text-base font-black text-zinc-950 shadow-[0_16px_40px_-20px_rgba(240,185,11,0.7)] transition hover:cursor-pointer hover:brightness-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loading ? "Processing..." : "Deposit USDT"}
                        </Button>

                        <button
                          type="button"
                          onClick={handleClose}
                          className="inline-flex h-14 items-center justify-center gap-2 rounded-[1.2rem] border border-zinc-200 bg-white px-5 text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
                        >
                          Back to market
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                      </div>

                      <p className="text-center text-xs leading-5 text-zinc-500">
                        This deposit flow is simulated for local trading and does
                        not move real funds.
                      </p>
                    </div>
                  </section>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};
