"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Brain,
  PenLine,
  Image as ImageIcon,
  Check,
  CalendarDays,
  Send,
  MessageSquare,
  ChartNoAxesCombined,
  Pause,
  Play,
  ArrowRight,
} from "lucide-react";
import { QurtizMark } from "@/components/brand/mark";

const stages = [
  {
    label: "AI Agent",
    detail: "Start with your brand and a clear objective.",
    icon: Brain,
  },
  {
    label: "Content created",
    detail: "Develop the hook, caption and call to action.",
    icon: PenLine,
  },
  {
    label: "Visual generated",
    detail: "Use a configured image provider or upload your media.",
    icon: ImageIcon,
  },
  {
    label: "Approved",
    detail: "Review the content and accept the intended version.",
    icon: Check,
  },
  {
    label: "Scheduled",
    detail: "Choose the destination, date, time and timezone.",
    icon: CalendarDays,
  },
  {
    label: "Published",
    detail: "The platform accepts the post; its result is saved.",
    icon: Send,
  },
  {
    label: "First comment added",
    detail: "A separate comment follows when the connection supports it.",
    icon: MessageSquare,
  },
  {
    label: "Analytics",
    detail: "Available platform metrics inform your next plan.",
    icon: ChartNoAxesCombined,
  },
];

export function PublishingDemo() {
  const container = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReduced(preference.matches);
      if (preference.matches) setStage(7);
    };
    update();
    preference.addEventListener("change", update);
    const target = container.current;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    if (target) observer.observe(target);
    const documentVisibility = () => {
      if (document.hidden) setVisible(false);
      else if (target) {
        const bounds = target.getBoundingClientRect();
        setVisible(bounds.top < innerHeight && bounds.bottom > 0);
      }
    };
    document.addEventListener("visibilitychange", documentVisibility);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", documentVisibility);
    };
  }, []);
  useEffect(() => {
    if (!visible || !playing || reduced) return;
    const interval = setInterval(
      () => setStage((value) => (value + 1) % stages.length),
      2600,
    );
    return () => clearInterval(interval);
  }, [visible, playing, reduced]);
  const current = stages[stage];
  return (
    <section
      id="first-comment"
      className="public-section public-container publishing-story"
    >
      <div className="section-heading split-heading">
        <div>
          <span className="eyebrow">MORE THAN A FINISHED CAPTION</span>
          <h2>
            Caption + First Comment.
            <br />
            <span>Ready together.</span>
          </h2>
        </div>
        <p>
          Prepare your main post and a separate comment in Content Studio. The
          publishing connection determines whether that comment can be added
          after the post goes live.
        </p>
      </div>
      <div
        className="publishing-demo"
        ref={container}
        data-demo-stage={stage}
        data-demo-playing={String(playing && !reduced)}
      >
        <header className="demo-toolbar">
          <span>
            <QurtizMark className="size-5" />A connected publishing journey
          </span>
          <span className="demo-badge">
            Illustrative sequence · not live data
          </span>
        </header>
        <div className="demo-body">
          <ol className="demo-stages" aria-label="Publishing workflow stages">
            {stages.map((item, i) => (
              <li key={item.label}>
                <button
                  type="button"
                  aria-current={i === stage ? "step" : undefined}
                  onClick={() => {
                    setStage(i);
                    setPlaying(false);
                  }}
                >
                  <span
                    className={`demo-step-icon ${i < stage ? "step-complete" : ""}`}
                  >
                    {i < stage ? <Check size={14} /> : <item.icon size={14} />}
                  </span>
                  <span>{item.label}</span>
                  <small>0{i + 1}</small>
                </button>
              </li>
            ))}
          </ol>
          <div className="demo-workspace">
            <div className="demo-current">
              <span className="eyebrow">
                EXAMPLE SUCCESS PATH · 0{stage + 1}/08
              </span>
              <h3>{current.label}</h3>
              <p>{current.detail}</p>
            </div>
            <div className="demo-post">
              <div className="demo-post-brand">
                <QurtizMark className="size-6" />
                <span>Example brand post</span>
                <span
                  className={stage >= 5 ? "demo-check visible" : "demo-check"}
                >
                  <Check size={12} />
                  Post published
                </span>
              </div>
              <div
                className={`demo-visual ${stage >= 2 ? "visual-ready" : ""}`}
                aria-hidden
              >
                <div className="demo-art-orbit" />
                <QurtizMark className="size-16" />
                <span>ONE IDEA. CONNECTED.</span>
              </div>
              <p className="demo-caption">
                A useful idea starts with the right context.
                <br />
                Bring your brand, content and next step together.
              </p>
              <div
                className={`demo-comment ${stage >= 6 ? "comment-ready" : ""}`}
              >
                <MessageSquare size={16} />
                <div>
                  <span>First Comment</span>
                  <p>
                    Which part of your content workflow would you like to
                    improve?
                  </p>
                </div>
                <Check size={15} className="demo-comment-check" />
              </div>
            </div>
            <div className="demo-controls">
              <span>
                Prepared <ArrowRight size={12} /> reviewed{" "}
                <ArrowRight size={12} /> connected
              </span>
              <button
                type="button"
                disabled={reduced}
                onClick={() => setPlaying((value) => !value)}
                aria-label={
                  playing
                    ? "Pause publishing illustration"
                    : "Play publishing illustration"
                }
              >
                {playing && !reduced ? <Pause size={13} /> : <Play size={13} />}
                {reduced ? "Motion reduced" : playing ? "Pause" : "Play"}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="comment-support">
        <div>
          <h3>Meta Direct</h3>
          <p>
            Facebook and Instagram comments use a separate request after the
            main post. Comment success, failure and permission requirements are
            recorded independently.
          </p>
        </div>
        <div>
          <h3>Buffer</h3>
          <p>
            First Comment is sent as channel metadata. Availability depends on
            the connection and Buffer plan. A rejected comment option can be
            omitted so the main post can proceed, with the skip recorded.
          </p>
        </div>
        <Link
          className="text-link"
          href="/articles/automate-facebook-instagram-qurtiz-ai"
        >
          Read the publishing guide ↗
        </Link>
      </div>
    </section>
  );
}
