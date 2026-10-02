export type PublicSection = {
  heading: string;
  paragraphs: string[];
  links?: { label: string; href: string }[];
};
export type PublicPage = {
  title: string;
  description: string;
  eyebrow: string;
  sections: PublicSection[];
  policy?: boolean;
};
export const publicPages: Record<string, PublicPage> = {
  about: {
    title: "A connected workspace for meaningful social media work",
    description:
      "Qurtiz brings brand context, research, creation and content operations together so the work can move with continuity.",
    eyebrow: "ABOUT QURTIZ",
    sections: [
      {
        heading: "What is Qurtiz AI?",
        paragraphs: [
          "Qurtiz AI is an AI social media operating system organized around brand workspaces. Its conversational agent works with tools for brand context, content, research and operations. Content Studio, media, review, scheduling and supported publishing connections share the same workspace.",
        ],
      },
      {
        heading: "Why it exists",
        paragraphs: [
          "A social post is rarely just a caption. It starts with a business goal and an audience, then moves through research, an idea, a visual, review and distribution. When each stage lives in a separate tool, context gets lost and decisions become harder to revisit.",
          "Qurtiz aims to make that context reusable and the workflow visible. The agent helps carry out the work, while people set direction, review content and control external actions.",
        ],
      },
      {
        heading: "Our product principles",
        paragraphs: [
          "Use real sources where available. Keep AI interpretation distinguishable from evidence. Make failures visible. Keep brand data scoped to its workspace. Prefer useful operations over decorative AI buttons.",
          "Qurtiz is currently free software with publicly available source. Provider costs and deployment requirements still apply.",
        ],
        links: [
          { label: "Explore the features", href: "/features" },
          {
            label: "Read the workflow guide",
            href: "/articles/ai-powered-social-media-workflow",
          },
        ],
      },
    ],
  },
  "open-source": {
    title: "The source is part of the story",
    description:
      "Explore Qurtiz's public source, understand the architecture and contribute to a connected AI social media workflow.",
    eyebrow: "FREE + PUBLIC SOURCE",
    sections: [
      {
        heading: "Free software, real operating requirements",
        paragraphs: [
          "Qurtiz does not advertise paid software plans today. Running the product can still involve hosting, database, storage, AI and search costs. Connected services operate under their own terms and limits.",
          "The repository is public. A license file has not yet been published in this checkout; public access alone does not establish unrestricted reuse rights. Review the repository's current license status before redistribution or commercial reuse.",
        ],
        links: [
          {
            label: "View the repository",
            href: "https://github.com/jarvisbymoiz/QURTIZ-AI",
          },
        ],
      },
      {
        heading: "A practical architecture",
        paragraphs: [
          "Qurtiz uses Next.js and React for the web experience, Supabase for authentication and storage, and PostgreSQL with Drizzle for persistence. Workspace-scoped services connect the agent, content pipeline, research, publishing and background jobs.",
          "Text and image provider configuration belongs to the workspace. Meta and compatible Buffer connections support the implemented social publishing flows. Source-aware live web research uses a configured Brave Search service.",
        ],
      },
      {
        heading: "Contribute with context",
        paragraphs: [
          "Start by reading the repository instructions, environment example and existing implementation. Preserve working services, reproduce problems and submit focused changes with relevant verification. Use issues for reproducible bugs and proposals; avoid posting tokens, personal information or private workspace content.",
        ],
        links: [
          {
            label: "Open a repository issue",
            href: "https://github.com/jarvisbymoiz/QURTIZ-AI/issues",
          },
          { label: "Security architecture", href: "/security" },
        ],
      },
    ],
  },
  security: {
    title: "Security built into the workflow",
    description:
      "An implementation-based overview of Qurtiz's authentication, workspace permissions, credential handling and external-action controls.",
    eyebrow: "SECURITY & CONTROL",
    sections: [
      {
        heading: "Authentication and workspace access",
        paragraphs: [
          "The application uses Supabase authentication with server-side session handling. Protected application layouts require a workspace; server operations check user membership and applicable permissions before accessing or changing workspace records.",
          "Workspace-scoped identifiers connect content, chats, media and provider configuration. Database policies provide an additional layer for direct client access. Deployment operators must maintain those policies and secure server database credentials.",
        ],
      },
      {
        heading: "Credential handling",
        paragraphs: [
          "Stored provider credentials are encrypted with AES-256-GCM. The server requires a valid deployment encryption key and decrypts credentials for provider operations. Protect that key separately from database backups and rotate compromised credentials at the provider.",
          "Social connections use provider authorization and access tokens, rather than collecting social account passwords. Local disconnect controls clear saved connection tokens; provider-side permission revocation is a separate step.",
        ],
      },
      {
        heading: "External operations and resource controls",
        paragraphs: [
          "Publishing and scheduling pass through server-side services and persist job state. Research has quota and rate controls. The repository includes URL, AI endpoint and media validation controls. None of these remove the need for secure infrastructure, monitoring and provider permission review.",
          "This page describes implemented controls, not a security certification or a guarantee that every deployment is secure. No SOC 2, ISO, HIPAA or platform partnership claim is made.",
        ],
      },
      {
        heading: "Reporting a security issue",
        paragraphs: [
          "A private security contact has not yet been configured. Do not publish exploit details, personal data or credentials in a public issue. Use the repository's private vulnerability reporting option if its maintainer has enabled it; otherwise open a non-sensitive issue asking for a private reporting channel.",
        ],
        links: [
          {
            label: "Repository security page",
            href: "https://github.com/jarvisbymoiz/QURTIZ-AI/security",
          },
          { label: "Data deletion instructions", href: "/data-deletion" },
        ],
      },
    ],
  },
  contact: {
    title: "Let's make the next step clear",
    description:
      "Find Qurtiz project support, report reproducible problems and learn where to handle sensitive requests.",
    eyebrow: "CONTACT & SUPPORT",
    sections: [
      {
        heading: "Project questions and bug reports",
        paragraphs: [
          "The verified project channel is the public GitHub repository. Use its issue tracker for non-sensitive questions, reproducible bugs and feature proposals. Include the relevant screen, expected behavior and a redacted error message. Never include API keys, access tokens, account passwords or private customer content.",
        ],
        links: [
          {
            label: "Visit repository issues",
            href: "https://github.com/jarvisbymoiz/QURTIZ-AI/issues",
          },
        ],
      },
      {
        heading: "Hosted deployment support",
        paragraphs: [
          "If you use a hosted installation, contact the operator of that installation for account, privacy, billing or deletion requests. No support email or legal operator identity is configured in this repository. Those details must be supplied by the operator before a public hosted launch.",
          "Public GitHub issues are not a private support channel. For sensitive matters, request a private channel without describing the sensitive data in public.",
        ],
        links: [
          { label: "Read data deletion steps", href: "/data-deletion" },
          { label: "Security reporting", href: "/security" },
        ],
      },
    ],
  },
  changelog: {
    title: "Follow the work as it develops",
    description:
      "Track Qurtiz development through the source repository. Published release notes will be collected here when releases are issued.",
    eyebrow: "CHANGELOG",
    sections: [
      {
        heading: "No published release entries yet",
        paragraphs: [
          "This page is ready for verified release notes. It does not turn commit history into invented product releases. Consult the repository's releases and commits for actual development activity.",
        ],
        links: [
          {
            label: "Repository releases",
            href: "https://github.com/jarvisbymoiz/QURTIZ-AI/releases",
          },
          {
            label: "Source history",
            href: "https://github.com/jarvisbymoiz/QURTIZ-AI/commits",
          },
        ],
      },
      {
        heading: "What future entries will contain",
        paragraphs: [
          "Each published entry should identify the release date, user-facing changes, fixes, relevant limitations and any required migration or deployment action. Breaking changes should include a recovery path.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    description:
      "A deployment-specific privacy policy draft covering accounts, workspace content, media, integrations, AI processing and deletion.",
    eyebrow: "POLICY DRAFT · 2 OCTOBER 2026",
    policy: true,
    sections: [
      {
        heading: "Scope and operator",
        paragraphs: [
          "This draft describes the Qurtiz application in this repository. It must be completed for the specific hosted service before production publication: legal operator identity, private contact, jurisdiction, processor agreements and retention periods are not supplied here. Self-hosted operators determine their own privacy practices. This document has not been represented as lawyer-reviewed.",
        ],
      },
      {
        heading: "Information processed",
        paragraphs: [
          "The service processes account identifiers and email addresses through its authentication provider; workspace membership and settings; business and brand information; chat messages and saved memory; research requests; drafts, generated content, media and schedules; connected social-account identifiers and authorization tokens; AI-provider configuration and encrypted credentials; and available social performance metrics.",
          "Operational logs may contain request identifiers, job states and error information. Avoid placing unnecessary sensitive personal information in prompts, brand context or uploaded media.",
        ],
      },
      {
        heading: "Why information is used",
        paragraphs: [
          "Data is used to authenticate users, scope workspace access, provide agent and content functions, store media, retrieve research, manage connections, schedule and publish authorized content, synchronize available analytics and diagnose failures. Research usage events support quota and abuse controls.",
        ],
      },
      {
        heading: "AI and third-party processing",
        paragraphs: [
          "Relevant prompts and context are sent to the AI provider selected for the workspace. Research queries are sent to configured search services. Media and post content are sent to connected publishing providers when the workflow requires it. These providers apply their own terms and data practices; Qurtiz does not promise that every provider has the same retention or training policy.",
          "The architecture uses Supabase authentication/storage, a PostgreSQL database, deployment hosting, configured AI and image providers, Brave Search where enabled, and Meta or Buffer where connected. The hosted operator must identify the actual processors it uses.",
        ],
      },
      {
        heading: "Cookies and local storage",
        paragraphs: [
          "Authentication uses cookies and browser client session storage to maintain sign-in. Workspace selection and interface preferences may also be stored. This public website does not add advertising trackers or a marketing analytics script. Operators must update this policy and apply applicable consent requirements if they add tracking.",
        ],
      },
      {
        heading: "Retention and deletion",
        paragraphs: [
          "Workspace content persists until it is deleted through supported controls or removed by the operator. Disconnecting an integration clears the local connection token but does not delete posts already published to a social platform or automatically revoke its platform-side grant.",
          "Workspace owners can use the confirmed workspace deletion flow in Settings. Backup retention, log retention, account deletion, and processor deletion schedules must be specified by the deployment operator; this draft does not invent a retention period.",
        ],
        links: [{ label: "Deletion instructions", href: "/data-deletion" }],
      },
      {
        heading: "Security and user requests",
        paragraphs: [
          "Stored provider credentials are encrypted, and server-side workspace permissions restrict application access. These controls do not eliminate all risks. Operators must protect infrastructure, encryption keys and backups.",
          "Depending on applicable law, users may have rights to access, correct, export or delete information and object to certain processing. Send sensitive requests privately to the hosted operator. A private privacy contact must be configured before launch; do not submit identity documents or personal data to public repository issues.",
        ],
        links: [
          { label: "Contact information", href: "/contact" },
          { label: "Security overview", href: "/security" },
        ],
      },
    ],
  },
  terms: {
    title: "Terms of service",
    description:
      "Professional draft terms for the Qurtiz service, account responsibilities, AI content, integrations and automation.",
    eyebrow: "POLICY DRAFT · 2 OCTOBER 2026",
    policy: true,
    sections: [
      {
        heading: "Service and operator",
        paragraphs: [
          "Qurtiz provides workspace-based AI and social content operations. These draft terms must be adapted by the hosted operator with its legal identity, contact details, applicable law and dispute process before launch. They are not represented as lawyer-reviewed. Self-hosted software use is also subject to any license actually published by the repository owner.",
        ],
      },
      {
        heading: "Accounts and responsibilities",
        paragraphs: [
          "Keep account credentials secure and provide accurate information. Use only workspaces, media and social accounts you are authorized to manage. Administrators are responsible for granting appropriate access, configuring providers and reviewing automation permissions. Notify your service operator of suspected account compromise.",
        ],
      },
      {
        heading: "Free software and third-party costs",
        paragraphs: [
          "Qurtiz currently advertises no paid software plans. Hosting, AI, search, storage or publishing services may impose their own costs, quotas and terms. No entitlement to unlimited processing is implied. Any future commercial plans require separately published pricing and terms.",
        ],
      },
      {
        heading: "Content and intellectual property",
        paragraphs: [
          "You are responsible for rights to uploaded and submitted content and for the material you publish. Processing your content to deliver requested features does not by itself establish a transfer of your ownership to the service operator.",
          "AI output can be inaccurate, repetitive or unsuitable. Review facts, rights, claims, accessibility and platform rules before using it. AI generation does not guarantee originality, copyright protection, platform acceptance or marketing results. Source-code rights depend on the repository's published license; no additional license is granted by this page.",
        ],
      },
      {
        heading: "Connections and automation",
        paragraphs: [
          "Connecting a provider authorizes actions within the permissions you grant. Review queued content, timezones and automation settings. External platforms may limit formats, reject content, expire tokens or change APIs. Disconnecting locally does not remove already published content; revoke grants and delete external posts through the platform when appropriate.",
        ],
      },
      {
        heading: "Acceptable use",
        paragraphs: [
          "Do not use the service for unlawful content, impersonation, spam, harassment, credential theft, unauthorized access or evasion of platform controls. Do not bypass quotas or abuse compute and storage resources. The operator may restrict access to protect users and infrastructure under its published enforcement process.",
        ],
        links: [{ label: "Acceptable use policy", href: "/acceptable-use" }],
      },
      {
        heading: "Availability, termination and changes",
        paragraphs: [
          "Provider outages, maintenance and configuration errors can interrupt service. No uninterrupted availability or recovery commitment is stated by this draft. Operators must publish their support commitments and legally appropriate liability limitations.",
          "Users may stop using the service and follow the deletion controls. Operators must specify notice, suspension, termination and data export procedures, subject to applicable law. Material changes to hosted terms should be communicated through the operator's published channel.",
        ],
        links: [
          { label: "Contact the operator", href: "/contact" },
          { label: "Privacy policy", href: "/privacy" },
        ],
      },
    ],
  },
  "acceptable-use": {
    title: "Acceptable use policy",
    description:
      "Rules for responsible content, provider access, social publishing and AI automation in Qurtiz.",
    eyebrow: "POLICY DRAFT · 2 OCTOBER 2026",
    policy: true,
    sections: [
      {
        heading: "Respect people and the law",
        paragraphs: [
          "Do not create or distribute unlawful material, threats, targeted harassment, discriminatory abuse, exploitation, fraud, deceptive impersonation or non-consensual private information. Only upload media you have the right to use. Follow applicable advertising and disclosure rules.",
        ],
      },
      {
        heading: "Respect connected platforms",
        paragraphs: [
          "Do not send spam, purchase or fabricate engagement, evade rate limits, bypass account restrictions or automate accounts without authorization. Follow the terms and content policies of each connected AI, search and social provider. Provider acceptance is not proof that a post is lawful or appropriate.",
        ],
      },
      {
        heading: "Protect the service",
        paragraphs: [
          "Do not attempt unauthorized access to other workspaces, extract credentials, upload malicious files or exploit the service to attack third parties. Do not circumvent quotas, cause excessive resource consumption or use agent tools to bypass permission checks.",
        ],
      },
      {
        heading: "Review AI output and report concerns",
        paragraphs: [
          "Review generated claims, media rights and sensitive topics before publishing. Keep humans responsible for external actions. Report non-sensitive issues through the repository; sensitive reports require a private operator channel. The hosted operator must publish its enforcement, appeal and contact process before launch.",
        ],
        links: [
          { label: "Security reporting", href: "/security" },
          { label: "Contact", href: "/contact" },
        ],
      },
    ],
  },
  "data-deletion": {
    title: "Disconnect accounts and delete workspace data",
    description:
      "Practical steps for removing local platform connections, revoking external permissions and using Qurtiz's confirmed workspace deletion flow.",
    eyebrow: "DATA & CONNECTION CONTROL",
    sections: [
      {
        heading: "1. Review scheduled work",
        paragraphs: [
          "Before disconnecting, review the Content Calendar and Auto Run settings. Stop unwanted automation and cancel or unschedule pending content through the available controls. Removing a connection can cause queued publishing to fail; it does not erase a queue or delete published posts.",
        ],
      },
      {
        heading: "2. Disconnect Facebook or Instagram",
        paragraphs: [
          "Sign in to the relevant workspace, open Connections and use the disconnect control for the provider and platform. A workspace administrator must perform this action. The application clears its saved token and connection details and marks the connection as not connected.",
          "For Meta or Buffer, also remove the app's authorization through that provider's account settings if you want to revoke the provider-side grant. Qurtiz's local disconnect does not guarantee platform-side revocation.",
        ],
      },
      {
        heading: "3. Remove provider access",
        paragraphs: [
          "Remove or replace AI provider credentials in Workspace Settings where the available controls allow it. Revoke the old API key in the provider's console to prevent future use. For an account-mode companion, revoke its pairing/access through the configured companion controls. Provider-held data must be managed according to that provider's deletion process.",
        ],
      },
      {
        heading: "4. Delete workspace data",
        paragraphs: [
          "Workspace owners can open Settings and use the Delete workspace danger zone. The flow verifies ownership with password or email confirmation and requires the exact workspace name before deletion. It deletes the workspace and its associated application data through the existing server deletion service and signs the user out.",
          "This is workspace deletion, not a promise that the authentication account, operational logs, backups or third-party copies are immediately erased. Published social posts remain on their platform until removed there.",
        ],
      },
      {
        heading: "5. Request additional deletion privately",
        paragraphs: [
          "For account-level deletion, backup/log retention or data that cannot be removed through application controls, contact the operator of the hosted installation. No private deletion email or response deadline is configured in this repository. The operator must publish those details before launch.",
          "Do not post personal data or identity documents in GitHub issues. A maintainer can be asked for a private channel using a non-sensitive message.",
        ],
        links: [
          { label: "Contact information", href: "/contact" },
          { label: "Privacy draft", href: "/privacy" },
        ],
      },
    ],
  },
};
