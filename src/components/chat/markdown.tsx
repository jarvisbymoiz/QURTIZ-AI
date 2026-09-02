"use client";

import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy } from "lucide-react";

/**
 * Safe Markdown renderer for AI chat responses.
 * - react-markdown renders React elements (no dangerouslySetInnerHTML),
 *   so raw HTML in AI output is escaped by construction — XSS-safe.
 * - remark-gfm adds tables, task lists, strikethrough.
 * - URLs pass through react-markdown's default urlTransform (http/https/mailto only).
 */
function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy code"
      className="absolute right-2 top-2 rounded-md border bg-background/90 p-1.5 text-muted-foreground hover:text-foreground"
      onClick={async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="size-3.5 text-emerald-500" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </button>
  );
}

export const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h1 className="mt-5 mb-3 border-b border-border/60 pb-1.5 text-xl font-bold tracking-tight" {...p} />,
          h2: (p) => <h2 className="mt-5 mb-2.5 text-lg font-bold tracking-tight" {...p} />,
          h3: (p) => <h3 className="mt-4 mb-2 text-base font-semibold" {...p} />,
          h4: (p) => <h4 className="mt-3 mb-1.5 text-sm font-semibold" {...p} />,
          p: (p) => <p className="my-2.5" {...p} />,
          strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
          em: (p) => <em className="italic" {...p} />,
          ul: (p) => <ul className="my-2.5 list-disc space-y-1 pl-5" {...p} />,
          ol: (p) => <ol className="my-2.5 list-decimal space-y-1 pl-5" {...p} />,
          li: (p) => <li className="leading-relaxed marker:text-muted-foreground" {...p} />,
          blockquote: (p) => (
            <blockquote className="my-3 border-l-2 border-primary/50 bg-primary/5 py-1.5 pl-3 pr-2 text-muted-foreground" {...p} />
          ),
          hr: () => <hr className="my-4 border-border/60" />,
          a: (p) => (
            <a className="text-primary underline underline-offset-4 hover:underline" target="_blank" rel="noopener noreferrer nofollow" {...p} />
          ),
          table: (p) => (
            <div className="my-3 overflow-x-auto rounded-lg border scroll-thin">
              <table className="w-full border-collapse text-xs" {...p} />
            </div>
          ),
          thead: (p) => <thead className="bg-muted/60" {...p} />,
          th: (p) => <th className="border-b px-2.5 py-2 text-left font-semibold" {...p} />,
          td: (p) => <td className="border-b px-2.5 py-1.5 align-top" {...p} />,
          code: (p) => {
            const { className, children } = p as { className?: string; children?: React.ReactNode };
            const isBlock = /language-/.test(className ?? "") || String(children).includes("\n");
            if (!isBlock) {
              return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.8em]" {...p} />;
            }
            return (
              <div className="relative my-3">
                <pre className="overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed scroll-thin">
                  <code className={className}>{children}</code>
                </pre>
                <CopyCode code={String(children)} />
              </div>
            );
          },
          pre: (p) => <>{p.children}</>,
          input: (p) => (
            <input
              disabled
              aria-disabled
              {...p}
              className="mr-1.5 align-middle accent-primary"
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
