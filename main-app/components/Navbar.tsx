import Link from "next/link";
import {
  Menu,
} from "lucide-react";
import SignIn from "./sign-in";
import { SignOut } from "./signout-button";
import { Button } from "./ui/button";
import { DEFAULT_MARKET_SYMBOL } from "@/lib/markets";

const NAV_ITEMS = [
  { label: "Buy Crypto", href: "/" },
  { label: "Markets", href: `/market/${DEFAULT_MARKET_SYMBOL}` },
  { label: "Trade", href: `/market/${DEFAULT_MARKET_SYMBOL}` },
  { label: "Futures", href: "/market/ETH_USDT" },
  { label: "Earn", href: "/" },
  { label: "Square", href: "/" },
  { label: "More", href: "/" },
];

type NavbarProps = {
  isSignedIn: boolean;
  userLabel?: string | null;
};

export const Navbar = ({ isSignedIn, userLabel }: NavbarProps) => {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/85">
      <div className="mx-auto flex h-22 w-full max-w-400 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-4 lg:gap-7">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0b90b] text-zinc-950 shadow-sm">
              <span className="text-lg font-black tracking-tight">D</span>
            </div>
            <div className="min-w-0">
              <div className="font-sans text-2xl font-black tracking-[0.2em] text-[#f0b90b]">
                DSE
              </div>
              <div className="-mt-1 text-[10px] font-semibold uppercase tracking-[0.45em] text-zinc-500">
                Exchange
              </div>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_ITEMS.map((item) => (
              <Link key={item.label} href={item.href}>
                <Button
                  variant="ghost"
                  className="h-10 rounded-full px-4 text-[15px] font-semibold text-zinc-800 hover:bg-zinc-100 hover:text-zinc-950"
                >
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/market/BTC_USDT">
                <Button className="rounded-xl bg-[#f0b90b] px-5 font-semibold text-zinc-950 hover:bg-[#ddb02d]">
                  Deposit
                </Button>
              </Link>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700">
                {userLabel ?? "Signed in"}
              </div>
              <SignOut
                size="lg"
                className="rounded-xl border-zinc-200 bg-white px-4 text-zinc-800 hover:bg-zinc-100"
              />
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <SignIn
                label="Log In"
                size="lg"
                className="rounded-xl bg-zinc-100 px-5 text-zinc-900 hover:bg-zinc-200"
              />
              <SignIn
                label="Sign Up"
                variant="default"
                size="lg"
                className="rounded-xl bg-[#f0b90b] px-5 font-semibold text-zinc-950 hover:bg-[#ddb02d]"
              />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="rounded-full lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};
