import {
  ArrowUpRight,
  Search,
  PenLine,
  Image,
  Send,
  Brain,
  MessageSquare,
} from "lucide-react";
import { QurtizMark } from "@/components/brand/mark";
import { PlatformIdentity } from "./platforms";
export const workflowSteps = [
  { label: "Research", icon: Search },
  { label: "Brand Brain", icon: Brain },
  { label: "AI Agent", icon: MessageSquare },
  { label: "Content", icon: PenLine },
  { label: "Visual", icon: Image },
  { label: "Facebook", icon: Send },
  { label: "Instagram", icon: Send },
];
export function HeroWorkflow() {
  return (
    <div
      className="hero-system"
      aria-label="Research and Brand Brain inform the AI Agent, content and visuals flow to eligible Facebook and Instagram publishing connections"
    >
      <div className="system-orbit orbit-one" />
      <div className="system-orbit orbit-two" />
      <div className="system-axis" />
      <svg
        className="hero-signals"
        viewBox="0 0 500 540"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="M110 100Q230 100 250 270M430 170Q360 245 250 270M60 260H250M430 360Q350 300 250 270M100 430Q210 380 250 270M310 490Q290 365 250 270M380 60Q290 145 250 270" />
        <path
          className="hero-data-signal"
          d="M110 100Q230 100 250 270M430 170Q360 245 250 270M60 260H250M430 360Q350 300 250 270M100 430Q210 380 250 270M310 490Q290 365 250 270M380 60Q290 145 250 270"
        />
      </svg>
      <div className="system-core">
        <QurtizMark />
        <span>ONE CONNECTED SYSTEM</span>
      </div>
      <div className="system-note note-top">
        <span className="status-dot" />
        Brand context at the center
      </div>
      <div className="system-note note-bottom">
        Human direction.
        <br />
        <strong>Agent momentum.</strong>
        <ArrowUpRight size={16} />
      </div>
      <div className="system-nodes">
        {workflowSteps.map((step, i) => (
          <div className={`system-node node-${i}`} key={step.label}>
            {i === 5 ? (
              <PlatformIdentity platform="facebook" size={18} />
            ) : i === 6 ? (
              <PlatformIdentity platform="instagram" size={18} />
            ) : (
              <step.icon size={18} />
            )}
            <span>{step.label}</span>
            <small>0{i + 1}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
export function WorkflowSection() {
  const steps = [
    "Understand your brand",
    "Research & plan",
    "Create content & visuals",
    "Review & approve",
    "Schedule & publish",
    "Analyze & improve",
  ];
  return (
    <section id="workflow" className="public-section public-container">
      <div className="section-heading">
        <span className="eyebrow">FROM CONTEXT TO CONTINUITY</span>
        <h2>
          One agent.
          <br />
          <span>Your entire workflow.</span>
        </h2>
        <p>The work connects. Your judgment stays at the center.</p>
      </div>
      <ol className="workflow-strip">
        {steps.map((step, i) => (
          <li key={step}>
            <span>0{i + 1}</span>
            <h3>{step}</h3>
            <div className="workflow-connector" aria-hidden />
          </li>
        ))}
      </ol>
      <p className="section-note">
        Generation requires configured AI providers. Publishing requires an
        eligible connected account and running backend jobs.
      </p>
    </section>
  );
}
