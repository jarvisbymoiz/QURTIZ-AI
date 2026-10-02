/** Typed editorial repository. Replace this adapter with a CMS without changing public rendering. */
import { qurtizArticles } from "./qurtiz-articles";
export type ArticleSection = {
  id: string;
  title: string;
  paragraphs: string[];
  steps?: string[];
  link?: { label: string; href: string };
};
export type Article = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  author: string;
  category: string;
  tags: string[];
  featured: boolean;
  image: string;
  seoTitle: string;
  seoDescription: string;
  sections: ArticleSection[];
};
const articles: Article[] = [
  ...qurtizArticles,
  {
    slug: "what-is-an-ai-social-media-agent",
    title: "What is an AI social media agent? A complete guide",
    description:
      "How brand context, tools and human review connect research, content creation, scheduling and publishing — and what to expect from an agent.",
    publishedAt: "2026-10-02",
    updatedAt: "2026-10-02",
    author: "Qurtiz AI Editorial",
    category: "AI social media",
    tags: ["AI agents", "Brand context", "Content operations"],
    featured: true,
    image: "/articles/agent-guide.png",
    seoTitle:
      "What Is an AI Social Media Agent? Research, Creation & Publishing",
    seoDescription:
      "Learn how an AI social media agent differs from a chatbot, uses brand context and tools, and connects research, content, review, scheduling and publishing.",
    sections: [
      {
        id: "definition",
        title: "What is an AI social media agent?",
        paragraphs: [
          "An AI social media agent is software that interprets a social media goal and uses permitted tools and relevant data to help carry it out. Instead of returning only a piece of text, it can participate in a workflow: understand the brand, retrieve information, propose content, create a draft and prepare the next authorized action.",
          "The word agent does not mean unrestricted autonomy. A useful agent operates inside account permissions, provider capabilities and human review requirements. It should tell you what it did, what it could not do and which decisions still need your attention.",
          "Consider a small business planning next week's posts. A caption generator might produce seven unrelated captions. An agent can use the business's audience and services, examine available content, research a timely topic when appropriate, create a plan and save drafts that can be reviewed. Whether those steps actually happen depends on the application's tools, rather than the wording of its marketing.",
        ],
      },
      {
        id: "chatbot-vs-agent",
        title: "How does an agent differ from a chatbot?",
        paragraphs: [
          "A chatbot primarily produces conversational responses. It may explain how to schedule a post without being able to save or schedule anything. An agent has access to defined operations: retrieve brand context, query a library, call a research provider, create a record or request a publishing job.",
          "The distinction is execution and verification. After a tool runs, the application should check its outcome and persist the result when appropriate. A sentence saying 'your post is scheduled' is not proof of a schedule. Look for a saved item, the selected account, a timezone and a real job status.",
          "Conversation is still a valuable interface. It lets you describe a goal in natural language and refine the work. But the interface should be backed by permission checks and structured operations. Ask what tools the agent can use, how failures appear and whether you can inspect the resulting content outside the chat.",
        ],
      },
      {
        id: "brand-context",
        title: "Why brand understanding comes first",
        paragraphs: [
          "Useful content starts with the business and audience. An agent needs to know what you offer, who you serve, what problems you solve, how you speak and which claims or topics you avoid. Without that context, a fluent draft can still be irrelevant.",
          "Keep the brief concrete. Specify the product or service, the intended audience, the desired action and the tone. Add approved facts such as opening hours or product details only when current. Separate examples of your preferred writing from binding restrictions, such as never making a health claim or never mentioning an unpublished price.",
          "Qurtiz's Brand Brain stores reusable business, audience, tone, preferences and asset information. Workspace memory can add recurring instructions. These features supply context; they do not remove the need to check whether a particular generated claim matches the latest business information.",
        ],
        link: { label: "Explore Brand Brain", href: "/features#brand-brain" },
      },
      {
        id: "research",
        title: "Research and ideation: evidence before inspiration",
        paragraphs: [
          "Research is useful when a task depends on current information, competitor context or an unfamiliar topic. It is less useful when you already have an approved brief and need a straightforward rewrite. Calling every research tool for every caption creates cost and delay without necessarily improving the result.",
          "A research-enabled agent should preserve source links and distinguish retrieved evidence from its interpretation. Check publication dates, the original source and the relevance of the source to your audience. A search result about a broad industry does not automatically establish what your customers want.",
          "In Qurtiz, configured Brave Search supports source-aware Research Lab operations. Search availability, cached results and quota affect what information can be retrieved. Turn useful findings into specific ideas: an educational explanation, a practical checklist, a product use case or a response to a real audience question. Do not treat an unsupported trend prediction as a fact.",
        ],
      },
      {
        id: "creation",
        title: "Content creation includes more than a caption",
        paragraphs: [
          "A publishable post has several connected parts. The hook introduces the idea, the caption develops it, the call to action gives the audience a next step, and the visual supports the message. Hashtags and first comments may help organize the presentation, but they are not a substitute for a useful idea.",
          "Choose the format before asking for a finished draft. A carousel needs a sequence of slides with a clear progression. A reel plan needs a visual sequence, spoken or on-screen messaging and a practical production approach. A single-image post needs one central message that remains readable at a small size.",
          "Qurtiz's Content Studio brings captions, hooks, CTAs, hashtags, first comments and visual prompts into a shared editing flow. Image generation depends on a configured image provider; existing media can also be uploaded. A reel plan or video upload should not be confused with AI video generation. Review both the words and the visual before approving content.",
        ],
        link: { label: "Explore Content Studio", href: "/features#studio" },
      },
      {
        id: "approval-publishing",
        title: "Review, scheduling and publishing are separate decisions",
        paragraphs: [
          "Review asks whether the content is accurate, useful, brand-consistent and legally appropriate. Approval records the decision to accept it. Scheduling identifies when and where it should go live. Publishing is the external operation that sends it to a platform. Keeping those stages distinct makes mistakes easier to prevent and diagnose.",
          "Confirm the account, format, date and timezone before scheduling. A backend job should carry out the operation without requiring your browser to stay open. If a token expires or a platform rejects media, the application should show failure and retain enough detail to help you recover.",
          "Qurtiz implements Facebook and Instagram publishing through Meta, with compatible Buffer connections also available. Account eligibility, permissions, media requirements and format support vary. A working connection is necessary, and a saved schedule alone is not proof that a platform has accepted the final post.",
        ],
      },
      {
        id: "analytics",
        title: "Use analytics as feedback, not a promise",
        paragraphs: [
          "Available performance data can help compare content and identify questions for the next plan. Examine comparable time windows and formats. A high-view post with little meaningful response may serve a different purpose from a lower-reach post that generates useful inquiries.",
          "Metrics have limits. Providers expose different fields and may delay data. Missing data should remain missing, rather than being filled with plausible numbers. An agent can propose an interpretation, but a small sample or a one-off result does not prove a lasting audience preference.",
          "Use the evidence to form a testable next step: repeat a helpful format, explain a confusing topic more clearly or adjust the call to action. Qurtiz's analytics and automation features depend on real accessible data and configured services. They cannot guarantee reach or business results.",
        ],
      },
      {
        id: "use-cases",
        title: "Who benefits from a connected agent workflow?",
        paragraphs: [
          "Creators can use an agent to organize recurring themes while keeping their own perspective and voice. Freelancers and agencies can use separate workspaces to retain each client's brief and content context. Small businesses can turn real services and customer questions into a repeatable editorial process.",
          "Marketing teams benefit when drafts, review decisions and scheduling are visible together. The biggest practical question is whether the system reduces the places where context must be copied by hand. Start with one brand and one connected account, then expand only after the workflow is reliable.",
          "Before choosing a tool, test a complete journey: configure a brand, create one draft, review it, upload or generate media, approve it and publish through an eligible account. Then inspect the saved result and the failure path. A polished chat response is only one part of that test.",
        ],
        steps: [
          "Write a clear brand brief and a concrete goal.",
          "Configure only the providers and connections you need.",
          "Create and review one complete post before automating a batch.",
          "Check actual publishing results and available analytics.",
          "Refine the process using evidence and human feedback.",
        ],
        link: {
          label: "Build the workflow step by step",
          href: "/articles/ai-powered-social-media-workflow",
        },
      },
    ],
  },
  {
    slug: "ai-powered-social-media-workflow",
    title: "How to build an AI-powered social media workflow",
    description:
      "A practical guide from brand research to content, visuals, review, scheduling, publishing and the next informed decision.",
    publishedAt: "2026-10-02",
    updatedAt: "2026-10-02",
    author: "Qurtiz AI Editorial",
    category: "Guides",
    tags: ["Content creation", "Social media automation", "Publishing"],
    featured: false,
    image: "/articles/workflow-guide.png",
    seoTitle:
      "Build an AI-Powered Social Media Workflow: Research to Publishing",
    seoDescription:
      "Follow a practical brand-to-publishing workflow with research, ideas, captions, visuals, human approval, scheduling, real publishing results and analytics.",
    sections: [
      {
        id: "start-with-work",
        title: "Start with the work, not the automation",
        paragraphs: [
          "An AI-powered social media workflow is a sequence of decisions and operations that moves a business goal into reviewed, distributed content. AI can help with research, ideas and production, but the workflow needs explicit context, checkpoints and observable results.",
          "A common fragmented process involves copying a brief into a chat, pasting the answer into a document, building a visual elsewhere and entering everything again in a scheduler. Each handoff can lose details: the approved claim, the final image order, the intended account or the correct timezone. Integration helps preserve that information; it does not make the underlying decisions disappear.",
          "The sequence in this guide is brand context → research → idea → caption → visual → review → schedule → publish → analyze. You can run it manually first and automate selected steps later. Qurtiz organizes these activities within a workspace, using the providers and connections you configure.",
        ],
      },
      {
        id: "brand",
        title: "1. Make the brand brief reusable",
        paragraphs: [
          "Create a short, specific brief with the business identity, audience, products or services, tone, language, content themes and restrictions. Include what the audience should understand or do after reading your content. A useful brief is easier to maintain than an enormous collection of disconnected instructions.",
          "Separate stable information from changing information. Voice and positioning may last for months; prices, availability and event dates can change quickly. Establish who updates those facts and how the reviewer checks them. Do not rely on the agent to infer the latest price from an old conversation.",
          "In Qurtiz, use Brand Brain for reusable brand information and assets, with workspace memory for recurring preferences. Start a content request with a concrete goal such as explaining one service to a specific audience. This makes the output easier to evaluate than a broad request for 'viral content'.",
        ],
        link: {
          label: "Understand Brand Brain",
          href: "/features#brand-brain",
        },
      },
      {
        id: "research",
        title: "2. Research only what the decision needs",
        paragraphs: [
          "Identify the uncertainty before searching. Do you need current platform information, an explanation of an industry topic or examples of competitor messaging? Define the question and the evidence that would help answer it. This keeps research focused and avoids collecting material that never affects the plan.",
          "Check source quality and dates. Keep a short note linking the source to the idea it supports. Distinguish an observable fact from an interpretation or a prediction. When a source is unavailable, use the information you do have and state the limitation rather than inventing evidence.",
          "Qurtiz's Research Lab can retrieve web sources through configured Brave Search. Deployment settings and quotas determine live availability; cached information can also be returned. Search results are a starting point for review, not a guarantee that every claim in a generated caption is supported.",
        ],
        link: {
          label: "Explore research capabilities",
          href: "/features#research",
        },
      },
      {
        id: "idea",
        title: "3. Choose an idea and a format",
        paragraphs: [
          "Turn the goal and evidence into one central idea. Specify the audience problem, the takeaway and the desired next action. Compare the proposal with recent content so you do not repeat the same angle simply because it was easy to generate.",
          "Match the format to the message. Use a single image for a focused statement, a carousel for a sequence or explanation, and a reel plan for a visual demonstration or narrative. A format is a communication choice, not an automatic path to better engagement.",
          "Before generating a batch, establish a small mix of purposes: teach something useful, show a relevant service, answer an objection or invite a meaningful action. In a client workspace, confirm that the plan fits the client's brief before spending provider credits on content and visuals.",
        ],
      },
      {
        id: "caption",
        title: "4. Draft the caption as a complete message",
        paragraphs: [
          "Ask for a hook, the main explanation and a clear CTA. Supply the factual details that must appear, the terms that should be avoided and the platform context. Review the draft for a specific audience rather than judging it only by how polished it sounds.",
          "A good edit removes vague promises and replaces them with concrete information. If the post introduces a service, explain who it serves and what it does. If the caption contains a number, deadline or comparative claim, confirm its source. Treat hashtags and the first comment as supporting details, not the core message.",
          "Qurtiz's Content Studio keeps these fields with the content item. Use the editing flow to refine the result and maintain the approved version. Saving the work in the library makes it possible to revisit it without reconstructing the entire conversation.",
        ],
      },
      {
        id: "visual",
        title: "5. Give the visual a clear job",
        paragraphs: [
          "Define the visual's purpose before choosing an image tool. What should the viewer notice first? Which element supports the caption? Specify the format, composition, brand colors, text hierarchy and any media restrictions. Keep essential text readable on a phone.",
          "Use a configured image provider to generate an asset or upload existing media you have permission to use. Check crop, legibility, representation and factual accuracy. If an image includes a real product, person or location, verify that the representation is appropriate rather than accepting a plausible substitute.",
          "For carousels, verify the slide order and the continuity of the explanation. For reels, review the actual video and its platform requirements. A text plan is not a produced video. Qurtiz supports visual prompts, provider-dependent image generation and media uploads, so keep the distinction between plan and asset explicit.",
        ],
      },
      {
        id: "review",
        title: "6. Make approval a real checkpoint",
        paragraphs: [
          "Review the caption and media together. Check the business facts, brand voice, rights, audience relevance, platform suitability and CTA. Have a named person accept the version that is intended to go live. A generated draft should not become approved merely because generation succeeded.",
          "For a batch, review the distribution of topics as well as individual posts. Several individually good posts can still create a repetitive week. Check whether the batch serves the goal and whether each post earns its place.",
          "Use content lifecycle controls to approve, reject or edit. If you regenerate a piece, review the replacement again. This avoids accidentally treating a fresh AI output as covered by an earlier approval.",
        ],
        steps: [
          "Check factual claims and current business details.",
          "Review media rights, readability and slide order.",
          "Confirm audience, language, tone and platform fit.",
          "Approve the intended final version before scheduling.",
        ],
        link: { label: "See the content workflow", href: "/features#studio" },
      },
      {
        id: "schedule",
        title: "7. Schedule with an account and timezone",
        paragraphs: [
          "A schedule needs a date, time, timezone, platform and account. Verify all of them before queuing the operation. Pay particular attention when a client or audience is in another timezone or a date falls near a daylight-saving transition.",
          "The backend must execute scheduled work independently of the browser. Confirm that the deployment's worker or cron mechanism is running and that the connection remains eligible. Expiring tokens and provider outages are operational conditions, not editing problems.",
          "Qurtiz uses persisted scheduling and publishing workflows. The presence of a calendar item means the operation is planned; inspect its eventual state to know whether it was executed. Keep a procedure for failed jobs instead of assuming an unattended schedule will always succeed.",
        ],
      },
      {
        id: "publish",
        title: "8. Verify the external publishing result",
        paragraphs: [
          "Publishing is an external action. Its success depends on the platform accepting the content and returning a usable result. A loading indicator, successful AI draft or local database insert is not enough. Check the saved status and any external post reference or error information.",
          "For Facebook and Instagram, account permissions, media rules, rate limits and supported formats matter. Qurtiz uses Meta as the primary publishing path and supports compatible Buffer connections. Do not assume that every account or provider can publish every format.",
          "When a publish fails, inspect the actual cause before retrying. Reconnect an expired account, correct unsupported media or wait for a rate limit as appropriate. Check whether the external platform created a post before repeating an ambiguous operation so recovery does not create duplicates.",
        ],
        link: { label: "Publishing requirements", href: "/faq" },
      },
      {
        id: "analyze",
        title: "9. Use results to improve the next plan",
        paragraphs: [
          "Review available analytics after a meaningful observation window. Compare similar formats and goals. Record what you observed, what you think it means and what you want to test next. Keep those three things separate so a recommendation does not quietly become a fact.",
          "Missing metrics should be described as unavailable. Small samples should lead to cautious experiments, not sweeping claims. Look for useful audience signals such as questions and responses alongside numerical measures, subject to what the provider exposes.",
          "After the manual flow works, consider Qurtiz's Auto Run settings for suitable recurring work. Configure the needed providers, connection permissions and review expectations first. Automate a process you understand and can recover, then inspect the results regularly. The aim is continuity and less manual handoff, with human responsibility intact.",
        ],
        link: {
          label: "What makes an AI social media agent?",
          href: "/articles/what-is-an-ai-social-media-agent",
        },
      },
    ],
  },
];
export function getArticles(): Article[] {
  return [...articles].sort((a, b) =>
    b.publishedAt.localeCompare(a.publishedAt),
  );
}
export function getArticle(slug: string): Article | undefined {
  return articles.find((article) => article.slug === slug);
}
export function getRelatedArticles(article: Article, limit = 3): Article[] {
  const relevance = (candidate: Article) =>
    candidate.tags.filter((tag) => article.tags.includes(tag)).length +
    (candidate.category === article.category ? 2 : 0);
  return getArticles()
    .filter((candidate) => candidate.slug !== article.slug)
    .sort((a, b) => relevance(b) - relevance(a))
    .slice(0, limit);
}
export function readingMinutes(article: Article): number {
  return Math.max(
    1,
    Math.ceil(
      article.sections
        .flatMap((s) => [...s.paragraphs, ...(s.steps ?? [])])
        .join(" ")
        .split(/\s+/).length / 220,
    ),
  );
}
export function articleDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
