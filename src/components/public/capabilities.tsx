import Link from "next/link";
import {
  Brain,
  Search,
  PenLine,
  Image,
  Send,
  ChartNoAxesCombined,
  ArrowUpRight,
} from "lucide-react";
const groups = [
  {
    id: "context",
    name: "Start with context",
    icon: Brain,
    items: [
      "AI Chat Agent",
      "Brand Brain",
      "User & workspace memory",
      "Multi-provider AI configuration",
    ],
    sequence: ["Business", "Audience", "Voice", "Agent"],
    detail: "Relevant brand context and permitted memory guide the work.",
    link: "/features#brand-brain",
  },
  {
    id: "discovery",
    name: "Find a useful angle",
    icon: Search,
    items: [
      "Research",
      "Trends research",
      "Competitor research",
      "Content ideation",
    ],
    sequence: ["Sources", "Evidence", "Ideas"],
    detail:
      "Trends use web research. Competitor discovery needs eligible Meta Instagram access; web research needs configured search.",
    link: "/features#research",
  },
  {
    id: "writing",
    name: "Give the idea a voice",
    icon: PenLine,
    items: [
      "Hooks",
      "Captions",
      "CTA",
      "Hashtags",
      "First Comment",
      "Visual prompts",
      "Content Studio",
    ],
    sequence: ["Topic", "Caption", "First Comment"],
    detail:
      "Develop the message and supporting fields together, then edit and review.",
    link: "/features#studio",
  },
  {
    id: "media",
    name: "Make it visual",
    icon: Image,
    items: [
      "AI image generation",
      "Single Image posts",
      "Carousel posts",
      "Reel content & workflows",
      "Media upload",
    ],
    sequence: ["Concept", "Visual", "Carousel"],
    detail:
      "Images need a configured provider. Reel planning and video uploads are supported; AI video generation is not implied.",
    link: "/features#studio",
  },
  {
    id: "distribution",
    name: "Move the work forward",
    icon: Send,
    items: [
      "Content Calendar",
      "Scheduling",
      "Publish Now",
      "Facebook publishing",
      "Instagram publishing",
      "Meta Direct connection",
      "Buffer connection",
    ],
    sequence: ["Approve", "Schedule", "Publish"],
    detail:
      "Eligible accounts, permissions and supported media are required. Backend execution handles scheduled work.",
    link: "/features#publishing",
  },
  {
    id: "learning",
    name: "Bring learning back",
    icon: ChartNoAxesCombined,
    items: ["Analytics", "Auto Run"],
    sequence: ["Available metrics", "Next plan"],
    detail:
      "Use actual available platform data. Auto Run depends on configured providers, connections and automation settings.",
    link: "/features#auto-run",
  },
];
export function CapabilitiesSection() {
  return (
    <section
      id="supports"
      className="public-section public-container supports-section"
    >
      <div className="section-heading split-heading">
        <div>
          <span className="eyebrow">WHAT QURTIZ SUPPORTS</span>
          <h2>
            A complete set of tools.
            <br />
            <span>A continuous way to work.</span>
          </h2>
        </div>
        <p>
          Capabilities connected by context, review and real provider
          operations. Choose the parts your workspace needs.
        </p>
      </div>
      <div className="capability-groups">
        {groups.map((group, index) => (
          <article
            className={`capability-group capability-${group.id}`}
            key={group.id}
          >
            <header>
              <group.icon size={20} />
              <span className="feature-number">0{index + 1}</span>
            </header>
            <h3>{group.name}</h3>
            <div
              className="capability-mini-flow"
              aria-label={group.sequence.join(" to ")}
            >
              {group.sequence.map((item) => (
                <span key={item}>{item}</span>
              ))}
              <i aria-hidden />
            </div>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>{group.detail}</p>
            <Link href={group.link} className="text-link">
              Explore this workflow <ArrowUpRight size={13} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
