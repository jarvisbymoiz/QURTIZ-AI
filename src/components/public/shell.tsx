import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { QurtizMark } from "@/components/brand/mark";
import { repositoryUrl } from "@/lib/public/site";
import { MobileNavigation } from "./mobile-navigation";

const navigation = [
  ["Product", "/#product"],
  ["Features", "/features"],
  ["How it works", "/#workflow"],
  ["Articles", "/articles"],
  ["Open source", "/open-source"],
  ["FAQ", "/faq"],
  ["About", "/about"],
];
export function PublicNavbar() {
  return (
    <header className="public-header">
      <div className="public-container public-nav">
        <Link href="/" className="brand-lockup" aria-label="Qurtiz AI home">
          <QurtizMark className="size-9" />
          <span>
            Qurtiz <span className="brand-ai">AI</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="desktop-nav">
          {navigation.map(([name, href]) => (
            <Link key={name} href={href}>
              {name}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <Link href="/login" className="login-link">
            Log in
          </Link>
          <Link className="public-button small" href="/signup">
            Get started <ArrowUpRight size={14} />
          </Link>
        </div>
        <MobileNavigation links={navigation} />
      </div>
    </header>
  );
}
export function PublicFooter() {
  const groups = [
    {
      title: "Explore",
      links: [
        ["Product", "/#product"],
        ["Features", "/features"],
        ["Articles", "/articles"],
        ["FAQ", "/faq"],
      ],
    },
    {
      title: "Project",
      links: [
        ["About", "/about"],
        ["Open source", "/open-source"],
        ["Changelog", "/changelog"],
        ["Contact", "/contact"],
      ],
    },
    {
      title: "Trust",
      links: [
        ["Security", "/security"],
        ["Privacy", "/privacy"],
        ["Terms", "/terms"],
        ["Acceptable use", "/acceptable-use"],
        ["Data deletion", "/data-deletion"],
      ],
    },
  ];
  return (
    <footer className="public-footer public-container">
      <div className="footer-grid">
        <div>
          <Link className="brand-lockup" href="/">
            <QurtizMark className="size-9" />
            Qurtiz AI
          </Link>
          <p>
            Less fragmentation.
            <br />
            More meaningful creation.
          </p>
          <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">
            Explore the source ↗
          </a>
        </div>
        {groups.map((group) => (
          <div key={group.title}>
            <h2>{group.title}</h2>
            {group.links.map(([label, href]) => (
              <Link href={href} key={label}>
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getUTCFullYear()} Qurtiz AI</span>
        <span>Free software. Provider costs may apply.</span>
        <div>
          <Link href="/login">Log in</Link>
          <Link href="/signup">Sign up</Link>
          <Link href="/rss.xml">RSS</Link>
        </div>
      </div>
    </footer>
  );
}
export function PublicCTA() {
  return (
    <section className="public-cta public-container">
      <span className="eyebrow">YOUR NEXT CHAPTER</span>
      <h2>
        Make room for ideas.
        <br />
        <span>Connect the rest.</span>
      </h2>
      <p>Turn your social media workflow into one intelligent system.</p>
      <div className="button-row">
        <Link className="public-button" href="/signup">
          Start free <ArrowUpRight size={18} />
        </Link>
        <Link className="public-button secondary" href="/login">
          Log in
        </Link>
      </div>
    </section>
  );
}
