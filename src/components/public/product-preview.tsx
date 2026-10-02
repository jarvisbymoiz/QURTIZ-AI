"use client";
import { useState } from "react";
import {
  Brain,
  CalendarDays,
  ChartNoAxesCombined,
  FlaskConical,
  MessageSquare,
  PenLine,
  ArrowUpRight,
  Check,
  Command,
} from "lucide-react";
import { QurtizMark } from "@/components/brand/mark";
const tabs = [
  {
    label: "AI Agent",
    icon: MessageSquare,
    heading: "A little direction. A connected workflow.",
    text: "Your conversation is the starting point. Brand context, research and content tools help turn intent into work.",
    lines: [
      "Brand context",
      "Relevant content",
      "Research sources",
      "Content plan",
    ],
  },
  {
    label: "Brand Brain",
    icon: Brain,
    heading: "The context behind your content.",
    text: "Keep the identity, audience and voice of your business close to every creative decision.",
    lines: [
      "Business & products",
      "Audience & niche",
      "Voice & language",
      "Brand assets",
    ],
  },
  {
    label: "Studio",
    icon: PenLine,
    heading: "One idea. Every part of the post.",
    text: "Work on the hook, caption, visual prompt and media together, then review the result.",
    lines: ["Single image", "Carousel", "Reel planning", "Approval"],
  },
  {
    label: "Research",
    icon: FlaskConical,
    heading: "Evidence before inspiration.",
    text: "Explore source-aware web research with configured search. Bring useful findings into your content plan.",
    lines: [
      "Topic discovery",
      "Competitor research",
      "Source links",
      "Saved ideas",
    ],
  },
  {
    label: "Calendar",
    icon: CalendarDays,
    heading: "A clear view of what comes next.",
    text: "Schedule approved content for eligible connected accounts. Backend jobs carry out the publishing work.",
    lines: [
      "Approved content",
      "Date & timezone",
      "Connected account",
      "Publishing status",
    ],
  },
  {
    label: "Analytics",
    icon: ChartNoAxesCombined,
    heading: "Look back. Create forward.",
    text: "Review available performance metrics from your connections. Use the evidence you have to inform the next plan.",
    lines: [
      "Available metrics",
      "Content performance",
      "Provider sync",
      "Next steps",
    ],
  },
];
export function ProductPreview() {
  const [active, setActive] = useState(0);
  const selected = tabs[active];
  return (
    <div className="product-window">
      <div className="window-top">
        <span>
          <i />
          <i />
          <i />
        </span>
        <span>Qurtiz workspace · Product preview</span>
        <Command size={14} />
      </div>
      <div className="preview-layout">
        <div className="preview-sidebar">
          <div className="brand-lockup">
            <QurtizMark className="size-7" />
            Qurtiz AI
          </div>
          <div role="tablist" aria-label="Explore the product">
            {tabs.map((tab, i) => (
              <button
                type="button"
                key={tab.label}
                id={`preview-tab-${i}`}
                role="tab"
                aria-selected={i === active}
                aria-controls="preview-panel"
                tabIndex={i === active ? 0 : -1}
                onKeyDown={(event) => {
                  const next =
                    event.key === "ArrowRight" || event.key === "ArrowDown"
                      ? (i + 1) % tabs.length
                      : event.key === "ArrowLeft" || event.key === "ArrowUp"
                        ? (i + tabs.length - 1) % tabs.length
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? tabs.length - 1
                            : null;
                  if (next !== null) {
                    event.preventDefault();
                    setActive(next);
                    document.getElementById(`preview-tab-${next}`)?.focus();
                  }
                }}
                onClick={() => setActive(i)}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
          <span className="preview-workspace">
            Your workspace
            <br />
            <small>Your brand, connected.</small>
          </span>
        </div>
        <div
          className="preview-content"
          id="preview-panel"
          role="tabpanel"
          aria-labelledby={`preview-tab-${active}`}
        >
          <div className="preview-heading">
            <span className="eyebrow">{selected.label.toUpperCase()}</span>
            <span className="preview-label">Illustrative interface</span>
          </div>
          <h3>{selected.heading}</h3>
          <p>{selected.text}</p>
          <div className="preview-conversation">
            <span className="preview-avatar">
              <QurtizMark className="size-6" />
            </span>
            <div>
              <strong>A workflow built around your brand</strong>
              <p>
                Choose your context. Review your content.
                <br />
                Stay in control of what goes live.
              </p>
              <div className="preview-chips">
                {selected.lines.map((line) => (
                  <span key={line}>
                    <Check size={12} />
                    {line}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="preview-prompt">
            <span>What would you like to create?</span>
            <ArrowUpRight size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}
