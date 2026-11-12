import type { ReactNode } from "react";

import { MINI_LINKS } from "./InfoPages";

export interface FooterLinks {
  about: string;
  howToUse: string;
  terms: string;
  privacy: string;
  support: string;
}

/**
 * The footer MiniPay's listing asks for: About, How to use, Terms, Privacy and Support, plus the
 * line that says the app isn't run by Opera or MiniPay. With no links it points at the kit's own five pages.
 */
export function MiniFooter({ links = MINI_LINKS, children }: { links?: FooterLinks; children?: ReactNode }) {
  const items: Array<[string, string]> = [
    ["About", links.about],
    ["How to use", links.howToUse],
    ["Terms", links.terms],
    ["Privacy", links.privacy],
    ["Support", links.support],
  ];
  return (
    <footer className="mt-8 border-t px-4 py-6 text-center text-xs text-muted-foreground">
      {children}
      <nav className="flex flex-wrap justify-center gap-x-4">
        {items.map(([label, href]) => (
          <a key={label} href={href} className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
            {label}
          </a>
        ))}
      </nav>
      <p className="mt-2">This app is not operated by Opera or MiniPay.</p>
    </footer>
  );
}
