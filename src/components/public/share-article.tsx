"use client";
import { useState } from "react";
export function ShareArticle({ title, url }: { title: string; url: string }) {
  const [status, setStatus] = useState("");
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setStatus("Shared");
      } else {
        await navigator.clipboard.writeText(url);
        setStatus("Link copied");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError")
        setStatus("Could not share. Copy the link below.");
    }
  }
  return (
    <div className="article-share">
      <button type="button" onClick={share}>
        Share this guide ↗
      </button>
      <span role="status">{status}</span>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        LinkedIn
      </a>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        X
      </a>
      {status.startsWith("Could not") && <a href={url}>{url}</a>}
    </div>
  );
}
