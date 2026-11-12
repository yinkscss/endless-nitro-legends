import type { ReactNode } from "react";

import { MINI_APP } from "./app";

export type InfoKind = "about" | "how" | "terms" | "privacy" | "support";

/** Route paths for the five pages (HashRouter). Add them inside the Layout route: INFO_ROUTES.map((r) => <Route key={r.path} path={r.path} element={<InfoPage kind={r.kind} />} />) */
export const INFO_ROUTES: Array<{ path: string; kind: InfoKind }> = [
  { path: "about", kind: "about" },
  { path: "how-to-use", kind: "how" },
  { path: "terms", kind: "terms" },
  { path: "privacy", kind: "privacy" },
  { path: "support", kind: "support" },
];

/** What MiniFooter links to when it isn't given links of its own. */
export const MINI_LINKS = { about: "#/about", howToUse: "#/how-to-use", terms: "#/terms", privacy: "#/privacy", support: "#/support" };

function Page({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-sm space-y-4 px-4 py-6">
      <a href="#/" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:underline">
        Back
      </a>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="space-y-3 leading-relaxed text-muted-foreground">{children}</div>
    </main>
  );
}

export function InfoPage({ kind }: { kind: InfoKind }) {
  const a = MINI_APP;
  if (kind === "about") {
    return (
      <Page title={"About " + a.name}>
        <p>{a.tagline}</p>
        <p>{a.name} is made by {a.publisher}. It works inside MiniPay and takes payments in dollar coins.</p>
      </Page>
    );
  }
  if (kind === "how") {
    return (
      <Page title="How to use">
        <ol className="list-decimal space-y-2 pl-5">
          {a.howTo.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>Need money in your wallet first? Use Add cash in MiniPay.</p>
      </Page>
    );
  }
  if (kind === "terms") {
    return (
      <Page title="Terms">
        <p>{a.name} is run by {a.publisher}. It is not run by Opera or MiniPay.</p>
        <p>Payments are sent from your own MiniPay wallet. You confirm every payment yourself, and this app cannot take money from your wallet without it.</p>
        <p>A payment that has gone through cannot be undone by this app. Check the amount before you confirm.</p>
        <p>The app is offered as it is, and it may change or stop. These are plain-words terms, not legal advice.</p>
      </Page>
    );
  }
  if (kind === "privacy") {
    return (
      <Page title="Privacy">
        <p>{a.name} does not ask for your name, email or phone number.</p>
        <p>Your wallet address and your payments are public on the blockchain. Nobody, including us, can remove them.</p>
        {a.keeps ? <p>{a.keeps}</p> : <p>The app keeps nothing else about you.</p>}
      </Page>
    );
  }
  return (
    <Page title="Support">
      {a.supportEmail ? (
        <p>
          Write to <a className="underline" href={"mailto:" + a.supportEmail}>{a.supportEmail}</a> and say what happened and when.
        </p>
      ) : (
        <p>Message {a.publisher} where you found this app, and say what happened and when.</p>
      )}
      <p>A payment that failed does not take your money. If one looks stuck, check your MiniPay history first.</p>
    </Page>
  );
}
