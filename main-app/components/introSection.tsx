import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap } from "lucide-react";
import SignIn from "./sign-in";
import { Button } from "./ui/button";
import { DEFAULT_MARKET_SYMBOL, MARKET_PAIRS } from "@/lib/markets";

export const IntroSection = () => {
  return (
    <div className="flex min-h-[calc(100vh-5.5rem)] items-center py-10">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div className="max-w-3xl">
          <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            Spot Trading UI
          </div>
          <div className="mt-5 text-6xl font-black tracking-tighter text-zinc-950 md:text-8xl">
            The future of finance is here.
          </div>
          <div className="mt-5 max-w-2xl text-lg leading-8 text-zinc-600 md:text-xl">
            Buy, sell, and track supported markets on a polished exchange
            interface with valid market routes, live order books, and a focused
            trading workspace.
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <SignIn
              label="Sign Up"
              variant="default"
              size="lg"
              className="rounded-xl bg-[#f0b90b] px-6 font-semibold text-zinc-950 hover:bg-[#ddb02d]"
            />
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-xl border-zinc-300 bg-white px-6 text-zinc-900 hover:bg-zinc-100"
            >
              <Link href={`/market/${DEFAULT_MARKET_SYMBOL}`}>
                Explore Markets
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <Zap className="size-4 text-amber-500" />
                Live markets
              </div>
              <div className="mt-2 text-2xl font-black text-zinc-950">
                {MARKET_PAIRS.length}
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Only supported pairs are shown in navigation.
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-700">
                <ShieldCheck className="size-4 text-emerald-500" />
                Safer routing
              </div>
              <div className="mt-2 text-2xl font-black text-zinc-950">
                100%
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Invalid market links are filtered out at the UI layer.
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white/90 p-4 shadow-sm">
              <div className="text-sm font-semibold text-zinc-700">
                Default pair
              </div>
              <div className="mt-2 text-2xl font-black text-zinc-950">
                BTC/USDT
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Ready as the primary trade entry point.
              </div>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[2.25rem] border border-zinc-200 bg-[radial-gradient(circle_at_top,_rgba(240,185,11,0.18),_transparent_28%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.22)]">
          <div className="absolute inset-x-10 top-0 h-30 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="relative rounded-[1.75rem] border border-zinc-200 bg-white/90 p-6 backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
                  Exchange preview
                </div>
                <div className="mt-2 text-3xl font-black tracking-tight text-zinc-950">
                  Built for fast market switching
                </div>
              </div>
              <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Live-ready
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {MARKET_PAIRS.map((market) => (
                <div
                  key={market.symbol}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
                    {market.name}
                  </div>
                  <div className="mt-2 text-xl font-black text-zinc-950">
                    {market.baseAsset}/{market.quoteAsset}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Spot market</span>
                    <span className="font-semibold text-amber-700">{market.symbol}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-zinc-50 p-4">
              <Image
                src="https://images.ctfassets.net/o10es7wu5gm1/NwN4qP0kizrOvWSJm9fhC/900e0f0eb28c040f6bcafb74cdf4f4a8/Group_1547769260__1_.png?fm=avif&w=1200&h=2223&q=65"
                alt="Screenshot of a mobile trading UI"
                width={1200}
                height={2223}
                className="mx-auto h-auto w-full max-w-sm"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
