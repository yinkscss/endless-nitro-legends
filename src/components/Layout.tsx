import { Flag, Gauge, Trophy } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useWallet } from "../lib/useWallet";
import { ConnectButton } from "./ConnectButton";
import { MiniFooter } from "../minipay/MiniFooter";
import { WalletStatus } from "./WalletStatus";

const TABS = [
  { to: "/", label: "Race", icon: Flag, end: true },
  { to: "/garage", label: "Garage", icon: Gauge, end: false },
  { to: "/board", label: "Board", icon: Trophy, end: false },
];

export function Layout() {
  const { account } = useWallet();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-md px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent">
              <Flag className="size-5" />
            </span>
            <div>
              <p className="font-display text-base font-semibold leading-tight tracking-tight">Neon Drift</p>
              <p className="text-[11px] leading-tight text-muted-foreground">Free endless racer</p>
            </div>
          </div>
          {/* Free play needs no wallet: the button is here for the garage and the season pass.
              Inside MiniPay the wallet connects by itself, so no button is shown. */}
          {!account && <ConnectButton />}
        </div>
        {!account && (
          <div className="mt-3">
            <WalletStatus />
          </div>
        )}
        <nav className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-border bg-card p-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                "flex min-h-11 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors " +
                (isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")
              }
            >
              <tab.icon className="size-4" />
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-4">
        <Outlet />
      </main>
      <MiniFooter />
    </div>
  );
}
