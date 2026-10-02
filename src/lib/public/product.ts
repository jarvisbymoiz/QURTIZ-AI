export const features = [
  {
    id: "agent",
    number: "01",
    title: "An agent, with context.",
    short: "AI Chat Agent",
    description:
      "Plan, research and create through conversation. The agent uses workspace tools and saved context to carry the work forward.",
    detail:
      "Ask for ideas, improve a caption or work on a content plan. Chat history keeps conversations available across visits; tool activity makes the work visible.",
  },
  {
    id: "brand-brain",
    number: "02",
    title: "Your brand. Remembered.",
    short: "Brand Brain & memory",
    description:
      "Give your agent the business, audience, voice and preferences behind every post.",
    detail:
      "Store your niche, products, services, contact details, tone and brand assets. Workspace memory adds reusable preferences so each request starts with relevant context.",
  },
  {
    id: "research",
    number: "03",
    title: "Find a reason to post.",
    short: "Research intelligence",
    description:
      "Explore topics, trends and competitors with source-aware web research when search is configured.",
    detail:
      "Research Lab uses Brave Search through a shared, metered research service. Sources help distinguish retrieved evidence from AI interpretation; live search depends on deployment configuration and quotas.",
  },
  {
    id: "studio",
    number: "04",
    title: "From idea to ready for review.",
    short: "Content Studio",
    description:
      "Develop hooks, captions, CTAs, hashtags, first comments and visual prompts in one place.",
    detail:
      "Create single-image content, carousel plans and reel content. Generate images with a configured image provider or upload your own images and video. Review and edit before approval.",
  },
  {
    id: "publishing",
    number: "05",
    title: "A calendar that follows through.",
    short: "Scheduling & publishing",
    description:
      "Review, approve and schedule content for connected Facebook and Instagram accounts.",
    detail:
      "Backend jobs handle publishing without keeping your browser open. Meta is the primary provider; compatible Buffer connections are also supported. Formats, permissions and account eligibility depend on the platform and provider.",
  },
  {
    id: "analytics",
    number: "06",
    title: "Make the next idea better.",
    short: "Analytics & Auto Run",
    description:
      "Use available performance data and configure automated content workflows around your workspace.",
    detail:
      "Analytics depend on connected accounts and accessible metrics. Auto Run combines context, generation, visuals and scheduling according to configuration. It requires working AI providers, eligible social connections and background execution.",
  },
];
export const faqs = [
  [
    "Does Qurtiz support a separate First Comment?",
    "Yes. Content Studio prepares it alongside the caption. Meta Direct attempts it after Facebook or Instagram publishing and records the comment result separately, subject to permissions and API eligibility. Buffer passes it as optional channel metadata; support depends on the connection and plan, and a rejected option can be skipped. A failed comment does not undo a successful post.",
  ],
  [
    "What is Qurtiz AI?",
    "Qurtiz AI is a workspace-based AI social media operating system. It connects brand context, conversational tools, research, content creation, media, approval, scheduling, publishing and available analytics.",
  ],
  [
    "Is Qurtiz AI free?",
    "Qurtiz is currently offered as free software. AI providers, search, hosting, storage and connected services may charge separately. There are no paid Qurtiz plans advertised here.",
  ],
  [
    "Is Qurtiz open source?",
    "The source is available in the public Qurtiz GitHub repository. The project owner still needs to publish a license file that defines reuse and redistribution rights; check the repository before relying on specific permissions.",
  ],
  [
    "What does the AI Agent do?",
    "It uses tools and workspace context to help with research, ideas, content and operations. What it can execute depends on your permissions, configured providers and connected accounts.",
  ],
  [
    "What is Brand Brain?",
    "Brand Brain stores your business identity, niche, audience, products, services, tone, preferences and assets so content can use relevant brand context.",
  ],
  [
    "Which social platforms are supported?",
    "Facebook and Instagram publishing connections are implemented through Meta, with compatible Buffer connections also supported. Account eligibility, permissions and supported formats vary.",
  ],
  [
    "Can Qurtiz generate images and carousels?",
    "Yes, image generation requires a working image provider or configured account-mode companion. Content Studio supports carousel content and ordered media uploads. Reel planning and video uploads are also available; image generation is not video generation.",
  ],
  [
    "Can it schedule and automatically publish?",
    "Approved content can be scheduled. Backend publishing jobs execute through configured connections, with success or failure saved to the workspace. A deployed worker or cron mechanism must be running.",
  ],
  [
    "What is Auto Run?",
    "Auto Run is a configurable automated content workflow. It uses workspace context and providers to generate content and media and carry out configured scheduling or publishing steps. Review the settings and permissions before enabling it.",
  ],
  [
    "Can I use my own AI provider?",
    "Yes. Workspace Settings supports provider, model and credential configuration for text and images. Available tasks depend on the selected provider's capabilities.",
  ],
  [
    "How are credentials handled?",
    "The application encrypts stored provider credentials using AES-256-GCM with a deployment encryption key. Credentials are resolved on the server for provider requests. Operators remain responsible for protecting keys, infrastructure and backups.",
  ],
  [
    "How can I disconnect an account?",
    "A workspace administrator can disconnect a platform in Connections. This clears the local connection token. Revoke the application's permissions at the platform too if you want to remove the platform-side grant.",
  ],
  [
    "How does workspace data work?",
    "Content, brand context, chats and provider settings belong to a workspace. Server operations verify session, membership and applicable role permissions. Owners can use the confirmed workspace deletion flow in Settings.",
  ],
  [
    "Does research always use live information?",
    "No. Live source retrieval requires configured Brave Search and available quota. Cached results can be reused. Check sources and dates, and do not treat AI interpretation as verified fact.",
  ],
  [
    "Does Qurtiz guarantee engagement or publish every format?",
    "No. AI output needs human review, and social APIs impose account, permission, rate and format limits. Qurtiz cannot guarantee reach, accuracy, platform acceptance or business outcomes.",
  ],
] as const;
