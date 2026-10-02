"use client";
import Link from "next/link";
import { useRef } from "react";
export function MobileNavigation({ links }: { links: string[][] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  function close() {
    if (ref.current) ref.current.open = false;
  }
  return (
    <details
      className="mobile-nav"
      ref={ref}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          close();
          ref.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary aria-label="Open navigation">
        Menu <span aria-hidden>☰</span>
      </summary>
      <nav
        aria-label="Mobile navigation"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) close();
        }}
      >
        {links.map(([name, href]) => (
          <Link key={name} href={href}>
            {name}
          </Link>
        ))}
        <Link href="/login">Log in</Link>
        <Link href="/signup">Get started free</Link>
      </nav>
    </details>
  );
}
