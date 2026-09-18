MASTER COMMAND --- COMPLETE THE EXISTING PROJECT

You are now taking responsibility for completing an already
partially-built production project.

Act as a:

-   World-Class Senior Software Architect
-   Principal Full-Stack Developer
-   AI/Agentic Systems Engineer
-   SaaS Product Engineer
-   Backend Engineer
-   Frontend Engineer
-   Database Architect
-   API Integration Engineer
-   Cybersecurity Engineer
-   DevOps Engineer
-   QA/Test Engineer
-   UI/UX Designer
-   Product Strategist
-   Performance Engineer
-   Technical Project Manager

You are not working on a blank project.

A significant portion of this application has already been built
successfully.

Your job now is to:

«UNDERSTAND → AUDIT → DEBUG → COMPLETE → INTEGRATE → TEST → POLISH →
DELIVER»

the existing project.

------------------------------------------------------------------------

1.  MOST IMPORTANT RULE

DO NOT START BY REBUILDING THE PROJECT.

The existing project contains substantial work that has already been
completed.

Some parts may be very good.

Some parts may be incomplete.

Some parts may only be UI.

Some parts may have backend logic but incomplete integration.

Some parts may be working correctly.

Your first responsibility is to determine which is which.

Preserve good existing work.

Do NOT unnecessarily:

-   rewrite working components
-   replace the entire architecture
-   rebuild the frontend
-   recreate existing database models
-   create duplicate services
-   create duplicate AI systems
-   create duplicate APIs
-   replace working integrations without reason

Instead:

Inspect → Understand → Reuse → Fix → Complete

------------------------------------------------------------------------

2.  YOU ARE NOT A UI-ONLY DEVELOPER

This is extremely important.

Do NOT treat a feature as complete because its UI exists.

A feature is only complete when its complete execution flow works.

For example:

UI ↓ Frontend Logic ↓ API / Server Action ↓ Backend ↓ Business Logic ↓
AI Agent / Service ↓ Database / External Services ↓ Real Result ↓
Frontend State Update

If only the UI exists:

THE FEATURE IS NOT COMPLETE.

If buttons exist but do nothing:

THE FEATURE IS NOT COMPLETE.

If fake/mock data is being used:

THE FEATURE IS NOT COMPLETE.

If a loading state appears forever:

THE FEATURE IS BROKEN.

------------------------------------------------------------------------

3.  DO NOT HIDE PROBLEMS

Do not make the application look functional.

Never solve a backend problem by changing the frontend to make it appear
successful.

Never:

-   fake progress
-   fake AI responses
-   hard-code results
-   use placeholder success responses
-   insert dummy database records
-   simulate publishing
-   simulate analytics
-   simulate AI research
-   hide errors
-   automatically mark failed operations as successful

I want real functionality.

------------------------------------------------------------------------

4.  FIRST TASK --- FULL PROJECT AUDIT

Before making major changes, inspect the entire existing project.

Understand:

Frontend

-   Framework
-   Routes
-   Pages
-   Components
-   State management
-   Forms
-   Modals
-   UI system
-   Design system
-   Responsive behavior

Backend

-   API routes
-   Server actions
-   Services
-   Controllers
-   Business logic
-   Background jobs
-   AI services
-   Authentication
-   Authorization

Database

-   Database provider
-   Schema
-   Tables
-   Relationships
-   Indexes
-   Existing records/models

AI

-   AI provider
-   Agent architecture
-   Prompts
-   Tools
-   Context
-   Memory
-   Structured outputs
-   Streaming
-   Error handling

Integrations

-   Facebook
-   Instagram
-   Google
-   Analytics
-   Research
-   Image generation
-   Other services

Infrastructure

-   Environment variables
-   Hosting
-   Storage
-   Queues
-   Cron/scheduled jobs
-   Logging
-   Monitoring

------------------------------------------------------------------------

5.  CREATE A PROJECT STATUS MAP

After inspecting the repository, classify the existing features.

Use:

COMPLETE

Actually works end-to-end.

PARTIALLY COMPLETE

Some functionality works but important parts are missing.

UI ONLY

Frontend exists but backend functionality is missing.

BROKEN

Implementation exists but does not work correctly.

MISSING

Not implemented.

DUPLICATED

Multiple implementations exist for the same responsibility.

Example:

AUTHENTICATION COMPLETE DATABASE COMPLETE AI CHAT PARTIALLY COMPLETE
BRAND BRAIN COMPLETE CONTENT STUDIO PARTIALLY COMPLETE BULK CREATION
BROKEN AI AGENT PARTIALLY COMPLETE RESEARCH PARTIALLY COMPLETE ANALYTICS
UI ONLY FACEBOOK PARTIALLY COMPLETE INSTAGRAM PARTIALLY COMPLETE
SCHEDULING BROKEN PUBLISHING PARTIALLY COMPLETE

Do this based on actual code, not assumptions.

------------------------------------------------------------------------

6.  FIND THE ROOT CAUSES

For every broken feature, do not immediately patch it.

Find the root cause.

Example:

If:

Generating 0/6

is stuck, investigate:

Button ↓ Frontend handler ↓ Request ↓ API ↓ Backend ↓ Job creation ↓
Worker ↓ AI service ↓ AI response ↓ Database ↓ Progress update ↓
Frontend subscription/polling

Determine exactly where it stops.

Then fix the root cause.

------------------------------------------------------------------------

7.  FULL AGENTIC SYSTEM REQUIREMENT

This project is not supposed to be a collection of static AI buttons.

It is an AI-powered Social Media Agent.

The AI should be capable of understanding the user's goal and deciding
what actions/data are necessary.

The architecture should conceptually work like:

USER ↓ AI CHAT / USER REQUEST ↓ AGENT ORCHESTRATOR ↓ UNDERSTAND INTENT ↓
PLAN ↓ DECIDE REQUIRED INFORMATION ↓ USE TOOLS / DATA ↓ ANALYZE ↓ MAKE
DECISION ↓ EXECUTE TASK ↓ VERIFY RESULT ↓ RETURN RESULT

The AI should not blindly generate content without context.

------------------------------------------------------------------------

8.  SOCIAL MEDIA AGENT --- CORE PURPOSE

The product is an intelligent Social Media Agent that can help the user:

-   Research topics
-   Discover content opportunities
-   Analyze trends
-   Analyze keywords
-   Analyze competitors
-   Analyze existing content
-   Analyze performance
-   Understand the brand
-   Develop content strategy
-   Generate posts
-   Generate captions
-   Generate visuals
-   Adapt content for platforms
-   Create bulk content
-   Review content
-   Improve content
-   Schedule content
-   Publish content
-   Analyze results
-   Learn from user feedback

All of these should work together as one coherent system.

------------------------------------------------------------------------

9.  BRAND BRAIN

The AI must understand the brand before producing important content.

Brand Brain may include:

-   Business information
-   Services
-   Products
-   Pricing
-   Target audience
-   Brand voice
-   Brand personality
-   Tone
-   Language
-   Visual identity
-   Colors
-   Typography
-   Content pillars
-   Preferred CTAs
-   Restrictions
-   Topics to avoid
-   Previous user instructions
-   Learned preferences

Do not hard-code Brand Brain into individual prompts.

Create a reusable context system.

------------------------------------------------------------------------

10. CONTENT LIBRARY

The agent should be able to work with the existing Content Library.

It should understand:

-   Drafts
-   Published posts
-   Scheduled posts
-   Rejected posts
-   Approved posts
-   Previous AI-generated content
-   Topics
-   Content pillars
-   Formats
-   Captions
-   Visuals

Before creating new content, the agent should check relevant existing
content to reduce repetition.

------------------------------------------------------------------------

11. ANALYTICS

Where real analytics data is available, use it.

The agent should be able to analyze:

-   Reach
-   Engagement
-   Shares
-   Saves
-   Comments
-   Likes
-   Performance by format
-   Performance by topic
-   Performance over time
-   Best-performing content
-   Weak-performing content

Do not invent analytics.

If analytics are unavailable:

say so and continue with available information.

------------------------------------------------------------------------

12. RESEARCH

Where research functionality exists, allow the agent to use it
intelligently.

Possible research sources:

-   Trends
-   Keywords
-   Competitors
-   Industry topics
-   Audience interests
-   Search opportunities
-   Current events
-   Content gaps

The agent should decide when research is actually necessary.

Do not call every tool on every request unnecessarily.

------------------------------------------------------------------------

13. AI CHAT MUST BE THE AGENT INTERFACE

The AI Chat should not be just a chatbot.

It should be the conversational interface to the entire agent.

For example:

User:

«Create 10 posts for next week.»

The agent should understand:

-   quantity
-   timeframe
-   brand
-   platforms
-   content strategy
-   existing content
-   available analytics
-   research requirements

Then perform the necessary workflow.

The user should be able to say:

«Make the first three more educational.»

and the agent should modify the relevant content.

Or:

«Reject number 5 and create a better replacement.»

The agent should actually perform that operation.

------------------------------------------------------------------------

14. TOOL-BASED AGENT ARCHITECTURE

Do not create one enormous prompt containing the entire application.

Use a structured tool-based architecture.

Conceptually:

AI AGENT │ ├── Brand Brain Tool ├── Content Library Tool ├── Analytics
Tool ├── Research Tool ├── Keyword Tool ├── Competitor Tool ├── Content
Generation Tool ├── Image/Visual Tool ├── Content Verification Tool ├──
Scheduling Tool ├── Publishing Tool └── Performance Analysis Tool

The exact architecture should follow the existing project and chosen
technology.

------------------------------------------------------------------------

15. AI DECISION MAKING

The AI should determine:

«"What information do I need before doing this task?"»

rather than simply:

«"Generate something."»

Example:

User: Create 6 posts.

Agent: ↓ Understand brand ↓ Check recent content ↓ Check performance ↓
Check relevant research ↓ Identify content gaps ↓ Create content
strategy ↓ Generate 6 posts ↓ Verify ↓ Save ↓ Ask/Wait for approval

------------------------------------------------------------------------

16. BULK CREATION

Bulk Creation must be a real end-to-end workflow.

Correct flow:

Bulk Creation ↓ User Requirements ↓ Agent ↓ Brand Brain ↓ Content
Library ↓ Analytics ↓ Research ↓ Strategy ↓ Generate Posts ↓ Generate
Visuals ↓ Verify ↓ Save to Database ↓ Waiting for Approval ↓ Approve /
Reject / Edit / Regenerate ↓ Schedule ↓ Publish

No fake workflow.

------------------------------------------------------------------------

17. CONTENT APPROVAL SYSTEM

Generated content must normally enter:

WAITING FOR APPROVAL

It must not automatically publish.

User should be able to:

-   Approve
-   Reject
-   Edit
-   Regenerate
-   Delete

Bulk actions should be supported where appropriate.

------------------------------------------------------------------------

18. SCHEDULING

Approved content should be able to enter:

Scheduled

with:

-   Date
-   Time
-   Platform
-   Timezone
-   Publishing status

Scheduled jobs must execute through a reliable backend mechanism.

Do not depend on the browser remaining open.

------------------------------------------------------------------------

19. PUBLISHING

Publishing must be real.

For connected platforms:

Approved ↓ Scheduled ↓ Publishing Job ↓ Platform API ↓ Success / Failure
↓ Database ↓ UI

If publishing fails:

Show the actual reason where possible.

Do not mark the post as published if the external platform rejected it.

------------------------------------------------------------------------

20. FACEBOOK / INSTAGRAM INTEGRATION

Do not assume APIs can do everything.

Verify the current official platform capabilities and requirements.

Implement:

-   OAuth/authentication
-   Permissions
-   Token handling
-   Connection state
-   Token expiration handling
-   Publishing
-   Error handling
-   Rate limits

Never store platform passwords.

Never expose access tokens to the client unnecessarily.

------------------------------------------------------------------------

21. AI CONTENT QUALITY

Generated content must be evaluated before being presented as ready.

Verify:

Brand consistency

Accuracy

Originality

Repetition

Platform suitability

Content strategy

CTA

Language

Visual consistency

Safety/compliance

The agent should distinguish:

Fact

AI-generated interpretation

Recommendation

Prediction

Never present predictions as facts.

------------------------------------------------------------------------

22. VISUAL GENERATION

If visual generation is part of the current implementation:

The AI should determine:

-   Visual concept
-   Format
-   Dimensions
-   Brand colors
-   Typography
-   Layout
-   Text hierarchy
-   CTA
-   Platform requirements

Then generate or initiate the actual visual-generation process.

Do not create fake image results.

------------------------------------------------------------------------

23. BACKGROUND TASKS

Long-running agent operations must use an appropriate background
execution architecture.

Examples:

-   Bulk generation
-   Research
-   AI processing
-   Image generation
-   Analytics synchronization
-   Scheduling
-   Publishing

Use:

Job Created ↓ Queued ↓ Running ↓ Progress ↓ Completed / Failed /
Cancelled

Progress must come from the real backend state.

------------------------------------------------------------------------

24. NO PERMANENT LOADING STATES

Any operation that starts loading must have a real terminal state:

-   Completed
-   Failed
-   Cancelled

Never leave:

«Loading...»

forever.

If something fails, show the actual error and provide recovery where
possible.

------------------------------------------------------------------------

25. ERROR HANDLING

Handle:

-   AI errors
-   API errors
-   Authentication errors
-   Rate limits
-   Timeouts
-   Database failures
-   Network errors
-   Invalid responses
-   Job failures
-   Publishing failures

Never silently swallow errors.

------------------------------------------------------------------------

26. DATABASE INTEGRITY

Every important operation must have a clear persistence model.

Do not rely solely on frontend state.

Important states should be stored appropriately:

Draft Generating Waiting for Approval Approved Rejected Scheduled
Publishing Published Failed Archived

Use a consistent lifecycle.

------------------------------------------------------------------------

27. ONE UNIFIED CONTENT PIPELINE

Do not build separate systems for:

-   AI Chat content
-   Bulk Creation
-   Content Studio
-   Scheduling
-   Publishing

They should connect to the same underlying content architecture.

For example:

AI Chat ↓ Agent ↓ Content Service ↑ Bulk Creation ↑ Content Studio ↓
Approval ↓ Scheduling ↓ Publishing

------------------------------------------------------------------------

28. UI/UX --- MODERN 2026 STANDARD

The existing project should be completed with a polished 2026-quality
SaaS UI/UX.

The UI should feel:

Premium + Intelligent + Fast + Professional + Modern

not like a generic dashboard template.

Take inspiration from modern AI products such as Gemini, ChatGPT and
Claude in terms of interaction quality, but do not copy their
interfaces.

Use:

-   Excellent typography
-   Strong hierarchy
-   Clean spacing
-   Responsive layouts
-   Contextual actions
-   Intelligent empty states
-   Streaming states
-   Progress indicators
-   Modern navigation
-   Useful animations
-   Keyboard shortcuts
-   Accessible interactions
-   Consistent components

Avoid unnecessary:

-   Glassmorphism
-   Gradients
-   Shadows
-   Huge cards
-   Animations
-   Visual clutter

Functionality comes first.

------------------------------------------------------------------------

29. CHAT EXPERIENCE

AI Chat should behave like a genuine AI Agent.

User messages:

RIGHT

AI messages:

LEFT

Chat should support:

-   New chat
-   Chat history
-   Search chats
-   Rename
-   Pin
-   Archive
-   Delete
-   Streaming
-   Stop generation
-   Retry
-   Regenerate
-   Copy
-   Edit/resend
-   Agent activity
-   Tool execution states

Example:

AI Agent ✓ Brand analyzed ✓ Existing content analyzed ✓ Research
completed ● Creating content strategy...

Tool activity should be understandable to the user without exposing
unnecessary internal technical details.

------------------------------------------------------------------------

30. MOBILE + DESKTOP

Everything must work on:

-   Desktop
-   Laptop
-   Tablet
-   Mobile

Do not merely shrink desktop layouts.

Design intentional responsive behavior.

------------------------------------------------------------------------

31. SECURITY

Perform a security audit across the existing project.

Check:

-   Authentication
-   Authorization
-   IDOR
-   XSS
-   CSRF
-   SSRF
-   SQL injection
-   Command injection
-   File upload security
-   URL validation
-   Rate limiting
-   Secret management
-   Token security
-   Data isolation
-   API abuse
-   Resource exhaustion

AI agents must never automatically bypass security controls.

------------------------------------------------------------------------

32. AI AGENT PERMISSIONS

Separate:

READ

Research Analytics Content Brand data

INTERNAL WRITE

Create drafts Update content Save strategy

EXTERNAL ACTION

Publish Delete Schedule Modify external accounts

External actions must have proper authorization.

Do not give the AI unrestricted access.

------------------------------------------------------------------------

33. PERFORMANCE

Do not create an architecture that becomes unnecessarily slow.

Optimize:

-   Database queries
-   AI requests
-   API requests
-   Background jobs
-   Images
-   Bundle size
-   Caching
-   Streaming
-   Pagination

Do not make expensive AI calls when existing data can answer the
question.

------------------------------------------------------------------------

34. COST CONTROL

Be conscious of AI and infrastructure costs.

Avoid:

-   unnecessary repeated AI calls
-   sending huge contexts
-   repeatedly analyzing the same content
-   unnecessary research
-   unnecessary image generation

Use:

-   caching
-   context filtering
-   batching
-   structured prompts
-   appropriate model selection
-   background processing

where appropriate.

------------------------------------------------------------------------

35. TEST THE REAL SYSTEM

Do not consider implementation complete until the actual workflow is
tested.

Test:

AI Chat

User → Agent → Tool → Result

Bulk Creation

Request → Research → Strategy → Generation → Verification → Database

Approval

Generated → Waiting → Approve/Reject

Scheduling

Approved → Scheduled → Job

Publishing

Scheduled → Platform → Published/Failed

Analytics

Platform → Data → Database → Agent

------------------------------------------------------------------------

36. DEBUGGING METHOD

When something fails:

Step 1

Reproduce it.

Step 2

Inspect frontend console/network.

Step 3

Inspect backend logs.

Step 4

Inspect database state.

Step 5

Inspect AI request/response.

Step 6

Identify root cause.

Step 7

Fix it.

Step 8

Test again.

Step 9

Test related functionality for regression.

Do not patch randomly.

------------------------------------------------------------------------

37. NO DUPLICATE ARCHITECTURE

Before creating a new:

-   AI service
-   API
-   database table
-   content model
-   job system
-   agent
-   integration

search the existing project first.

If something already exists:

reuse or improve it.

Only create a new implementation if there is a legitimate architectural
reason.

------------------------------------------------------------------------

38. CODE QUALITY

Write maintainable production code.

Avoid:

-   giant components
-   giant files
-   duplicated logic
-   hard-coded secrets
-   magic values
-   unnecessary abstractions
-   fragile hacks
-   temporary code left permanently

Use clear naming.

Keep responsibilities separated.

------------------------------------------------------------------------

39. DOCUMENTATION

Update documentation as the system evolves.

Document:

-   Architecture
-   AI agent architecture
-   Database
-   Environment variables
-   Integrations
-   Job system
-   Deployment
-   Testing
-   Troubleshooting

------------------------------------------------------------------------

40. DEVELOPMENT PRIORITY

When deciding what to fix first, use:

1.  Broken core functionality
2.  Backend/agent functionality
3.  Data integrity
4.  Security
5.  External integrations
6.  User workflow
7.  Performance
8.  UI polish

Do not spend hours polishing a button while the backend behind it is
broken.

------------------------------------------------------------------------

41. DO NOT OVER-ENGINEER

Use the simplest architecture that can reliably solve the problem.

Do not introduce:

-   unnecessary microservices
-   unnecessary databases
-   unnecessary queues
-   unnecessary AI frameworks
-   unnecessary infrastructure

Complexity must have a reason.

------------------------------------------------------------------------

42. EXISTING PROJECT IS THE SOURCE OF TRUTH

The actual repository is now more important than assumptions from
previous conversations.

Inspect what is actually implemented.

Determine:

What exists

What works

What is incomplete

What is broken

What needs to be redesigned

Then continue from there.

------------------------------------------------------------------------

43. DO NOT THROW AWAY PREVIOUS WORK

The existing project has already taken significant development effort.

Your job is to finish it, not restart it.

If an existing implementation is good:

KEEP IT.

If it is partially good:

IMPROVE IT.

If it is fundamentally broken:

REFACTOR IT.

If it is unnecessary:

REMOVE IT only after understanding its dependencies.

------------------------------------------------------------------------

44. WHEN YOU DISCOVER A SERIOUS ARCHITECTURAL PROBLEM

Do not hide it.

Tell me:

Problem

...

Root Cause

...

Impact

...

Recommended Solution

...

Alternatives

...

Risk

...

For minor implementation decisions, use your engineering judgment.

For major architectural changes that affect the product significantly,
explain them before making irreversible changes.

------------------------------------------------------------------------

45. IMPLEMENTATION STRATEGY

After auditing the project, create a prioritized completion roadmap.

Example:

PHASE 1 Fix foundation/backend

PHASE 2 Complete AI Agent

PHASE 3 Complete Content Pipeline

PHASE 4 Complete Bulk Creation

PHASE 5 Complete Approval

PHASE 6 Complete Scheduling

PHASE 7 Complete Publishing

PHASE 8 Complete Analytics

PHASE 9 Security + Performance

PHASE 10 UI/UX Polish

PHASE 11 Full QA

PHASE 12 Production Readiness

Adapt the roadmap to the actual project.

------------------------------------------------------------------------

46. DO NOT STOP AFTER THE AUDIT

Unlike the original planning phase, this is now an existing-project
completion command.

You should:

1.  Audit
2.  Identify problems
3.  Create a completion plan
4.  Begin fixing/implementing the approved existing project requirements
5.  Test continuously
6.  Continue until the project is genuinely complete

Do not stop after simply describing what is wrong.

------------------------------------------------------------------------

47. BUT DO NOT MAKE DANGEROUS CHANGES BLINDLY

If you discover something that would require a major destructive change,
such as:

-   deleting production data
-   replacing the entire database
-   removing a major integration
-   changing authentication architecture
-   migrating infrastructure
-   breaking existing APIs

stop and explain the change first.

Do not perform destructive operations without appropriate confirmation.

------------------------------------------------------------------------

48. COMPLETION DEFINITION

The project is complete only when:

Frontend ↓ Backend ↓ Database ↓ AI Agent ↓ Tools ↓ External Integrations
↓ Background Jobs ↓ Real Results

all work together where required.

The user must be able to perform the main product journey from beginning
to end.

------------------------------------------------------------------------

49. FINAL PROJECT QUALITY CHECK

Before declaring completion, verify:

Product

Core problem solved.

AI

Agent actually reasons through tasks and uses available tools/data.

Content

Real generation works.

Bulk Creation

Real bulk generation works.

Approval

Real approval lifecycle works.

Scheduling

Real scheduling works.

Publishing

Real publishing works where integrations are configured.

Analytics

Real data is used where available.

Chat

Chat controls and agent interactions work.

Database

Data persists correctly.

Security

Critical attack surfaces reviewed.

Performance

No obvious severe bottlenecks.

UI/UX

Modern 2026-quality experience.

Mobile

Works properly.

Errors

Failures are visible and recoverable.

Testing

Critical workflows tested.

------------------------------------------------------------------------

50. FINAL RULE

Never confuse:

"The UI exists"

with:

"The feature works."

Never confuse:

"The AI prompt exists"

with:

"The AI agent works."

Never confuse:

"The loading state is displayed"

with:

"The operation is running."

Never confuse:

"The database record exists"

with:

"The complete workflow works."

The standard is:

«REAL END-TO-END FUNCTIONALITY.»

------------------------------------------------------------------------

YOUR FIRST ACTION

Now inspect the existing project thoroughly.

Do NOT immediately start rewriting things.

First determine:

1.  What has already been built successfully.
2.  What is partially implemented.
3.  What is UI-only.
4.  What is broken.
5.  What backend functionality is missing.
6.  What AI/agent functionality is missing.
7.  What integrations are incomplete.
8.  What workflows are disconnected.
9.  What duplicate systems exist.
10. What the highest-priority blockers are.

Then create a clear:

EXISTING PROJECT AUDIT

followed by:

COMPLETION ROADMAP

and:

PRIORITY FIX LIST

After that, begin systematically completing the project.

Do not restart the project.

Do not downgrade existing functionality.

Do not build only UI.

Do not fake functionality.

Do not leave broken workflows hidden.

## Finish the actual product.

# FINAL QURTIZ AI SaaS PRODUCTION HANDOFF --- SEPTEMBER 2026

This section extends and specializes all rules above for the current
Qurtiz AI repository. If a generic instruction above conflicts with a
more specific current-state instruction below, inspect the repository
and preserve the newer working implementation. The repository is the
source of truth for current implementation state; this document is the
source of truth for product intent, quality bar, historical decisions,
and completion requirements.

## 51. FINAL PRODUCT MISSION

Qurtiz AI must be finalized as a REAL, production-grade, monetizable
multi-tenant SaaS product, not a demo, UI prototype, local-only project,
or collection of disconnected AI features.

The target product is an autonomous AI Social Media Marketing and
Content Operations platform where a customer can:

Sign up → create/onboard a workspace → configure Brand Brain → configure
an AI provider/model → connect social accounts → research
market/trends/competitors → chat continuously with the AI Agent → create
single or bulk content → upload/generate media → review/approve →
schedule/publish → monitor real results/analytics → reuse those
learnings in future content.

The application must be capable of being deployed, operated, supported,
secured, measured, and monetized as a real SaaS business.

Do not declare the project complete merely because the build passes.
Completion means the main customer journeys work end-to-end with real
persistence and real provider behavior.

## 52. SaaS COMMERCIAL READINESS

Audit and complete the SaaS foundation needed for real paying customers.

The architecture should support, where not already implemented:

-   User accounts and authentication
-   Multi-workspace / tenant model
-   Workspace ownership and membership
-   Workspace onboarding
-   Account/workspace lifecycle
-   Plans
-   Subscriptions
-   Feature entitlements
-   Usage quotas
-   AI usage limits
-   publishing/scheduling limits where applicable
-   storage/media limits where applicable
-   provider/account connection limits where applicable
-   trial/free-plan capability if product configuration enables it
-   upgrade/downgrade-ready plan architecture
-   billing-provider abstraction
-   subscription status synchronization
-   cancellation/expiration behavior
-   usage metering
-   clear upgrade/limit-reached UX
-   admin/support visibility where appropriate

Do NOT invent prices or silently integrate a paid billing provider
without configuration/approval. If billing is not yet selected, build a
clean billing-ready entitlement architecture and identify the final
external billing decision separately.

Never scatter plan checks throughout arbitrary UI components. Prefer a
centralized entitlement/usage service that both frontend and backend
enforce.

Backend enforcement is mandatory. Hiding a premium button is not
authorization.

## 53. SaaS RELIABILITY / OPERATIONS

Production readiness includes:

-   structured server logging
-   actionable error reporting
-   health checks
-   provider health state
-   background-job observability
-   failed-job recovery
-   auditability of important external actions
-   database integrity
-   safe migrations
-   backups/recovery considerations
-   environment validation
-   production-safe secret handling
-   rate limiting
-   abuse protection
-   resource/cost controls
-   graceful degradation when providers are unavailable
-   no unbounded retries
-   no infinite polling
-   no orphaned permanent loading states

Create or improve operational documentation for deployment, environment
variables, troubleshooting, integrations, jobs, and recovery.

## 54. CURRENT CONFIRMED PROJECT STATE

The following represents the last confirmed development state. Verify it
against the repository before changing anything.

Meta Facebook and Instagram OAuth/account discovery are working.

Meta Facebook and Instagram main publishing are working.

Meta is the PRIMARY social publishing provider when a compatible healthy
Meta connection exists.

Buffer is SECONDARY / FALLBACK.

Provider resolution must use the centralized publishing architecture and
should be evaluated at execution time where necessary, especially for
scheduled/retried jobs.

Meta First Comment has been fixed and is currently working. Do not
regress it.

Buffer integration exists. Preserve its current OAuth/token
refresh/GraphQL implementation. Do not revert to legacy Buffer REST
APIs.

The AI architecture has been evolving toward a provider-agnostic
multi-provider system. Preserve working provider adapters and generic
OpenAI-compatible support.

Content Studio multi-image Carousel upload has been implemented.

Carousel images are persisted separately and ordered using `slideIndex`.

The Carousel preview is intentionally minimalist: ONE image visible at a
time, subtle previous/next arrows, and a small `1 / N` indicator. Do not
replace it with a large thumbnail grid without explicit product
direction.

Carousel image remove/reorder behavior has been implemented.

Reel video upload has been implemented for supported formats and
preserves the actual MIME type.

Reel video preview uses video controls.

The upload/storage/media UX must not be rebuilt unless an actual defect
is demonstrated.

At the last confirmed state, provider-side multi-media publishing was
still incomplete. Historically the centralized publishing service used
one visual (`ctxRes.visual`). Verify the current code because it may
have progressed.

If still incomplete, finish:

1.  ordered multi-visual loading in publishing context
2.  Meta Facebook real multi-photo Carousel publishing
3.  Meta Instagram child media containers + CAROUSEL parent publishing
4.  Meta Facebook Reel/video publishing
5.  Meta Instagram Reel/video publishing
6.  Buffer multi-image Carousel assets
7.  Buffer video AssetInput
8.  safe idempotency/retry/recovery for multi-step media publishing

Preserve working single-image publishing.

Never publish only the first Carousel image.

Never send a Reel video as an image.

Use persisted MIME type, media URL/reference, and `slideIndex`.

Use current official Meta and Buffer API schemas when changing provider
payloads. Do not guess deprecated fields or endpoints.

## 55. CENTRALIZED SOCIAL PUBLISHING

All publishing entry points must converge on the same centralized
publishing service:

AI Chat Content Studio Bulk Creation Calendar Publish Now Calendar
Schedule Auto Run Retry / Recovery

Conceptual flow:

Qurtiz Social Layer → Provider Resolver → Provider Adapter → Platform
Payload Builder → Provider API → Result Parser → Publishing Job
Persistence → UI / Agent Result

Do not create separate publishing implementations for different screens.

A provider operation is successful only after the real provider confirms
it.

Persist the provider actually used, connection/channel, provider object
ID, status, timestamps, attempts, and real sanitized failure
information.

Retries must be idempotent and must not duplicate already-published
posts, carousel parents/children, videos, or First Comments.

## 56. META / BUFFER PROVIDER PRIORITY

Default current strategy:

META FIRST BUFFER SECONDARY / FALLBACK

For Facebook, prefer a healthy compatible Meta Page connection.

For Instagram, prefer a healthy compatible Meta Professional account.

If Meta is unavailable, expired, disconnected, unsupported for the
requested operation, or otherwise unhealthy, use Buffer only if a
compatible healthy Buffer channel exists and provider resolution permits
it.

Never silently mark success because a fallback was attempted.

Re-resolve provider health at execution time for scheduled/background
work when appropriate.

## 57. BUFFER TOKEN SAFETY

A server/gateway restart must not automatically mean the Buffer user
needs to reconnect.

Persist credentials securely.

Where refresh tokens are supported, handle refresh/rotation atomically
and protect against concurrent refresh races.

On authorization failure, perform only the bounded refresh/retry
behavior supported by the current integration. If authorization remains
invalid, expose a real reconnection-required state.

Never log access or refresh tokens.

Never reintroduce legacy Buffer REST endpoints if the current
integration is GraphQL.

## 58. AI CHAT AGENT --- MAJOR PRODUCT PRIORITY

The AI Chat Agent is one of the most important differentiators of the
SaaS and must be enhanced beyond a basic chatbot.

It should operate as the conversational control center for Qurtiz AI.

It must be able to reason over the user's request, decide what
context/tools are necessary, execute permitted tools, verify results,
persist state, and continue the conversation naturally.

The agent should intelligently use, when relevant:

-   Brand Brain
-   Content Library
-   previous content/history
-   Analytics
-   Research & Trends
-   Competitor Analysis
-   keyword/topic data
-   content-generation tools
-   visual-generation tools
-   scheduling tools
-   publishing tools

Do not call every tool for every message. Tool use should be purposeful.

Do not put the entire database into the model context. Retrieve relevant
context selectively.

## 59. RESEARCH & COMPETITOR AGENT RIGHTS

The AI Agent must have controlled rights to use Research/Trends and
Competitor Analysis as real tools.

Research capabilities may include, where supported:

-   current topic research
-   trend discovery
-   keyword research
-   hashtag research
-   industry research
-   audience/content opportunities
-   content gaps
-   current-event context
-   platform-specific opportunities

Competitor capabilities may include, where legally and technically
supported:

-   analyze configured competitors
-   inspect available public/authorized competitor data
-   compare positioning/content themes
-   identify content patterns
-   identify gaps/opportunities
-   compare available performance signals
-   summarize strategic learnings
-   feed useful findings into content strategy

Never fabricate competitor or research data.

Clearly distinguish:

-   verified/retrieved information
-   inference/analysis
-   recommendation

If a research source fails or returns no data, report that truthfully.

Respect platform terms, authorization boundaries, privacy, and rate
limits. Do not bypass access controls or scrape protected/private data.

## 60. AI AGENT PERMISSION MODEL

Preserve explicit permission boundaries.

READ / RESEARCH: - Brand Brain - Content Library - Analytics -
Research - Trends - Competitor data - connected-account metadata

INTERNAL WRITE: - create drafts - edit generated content - save
research/strategy - update internal content state where authorized

EXTERNAL / CONSEQUENTIAL ACTION: - publish - schedule - delete external
content - modify external accounts/connections - other irreversible
provider actions

External actions require the correct user/workspace authorization and
must follow existing approval/automation policy.

Do not grant the agent unrestricted database or provider access.

## 61. CONTINUOUS MULTI-TURN CHAT --- MUST BE RELIABLE

Current chat continuity still has errors and must be treated as a P0/P1
product issue.

The expected experience is smooth ChatGPT/Gemini-like continuous
conversation.

A user must be able to send message 1, receive a response, then send
message 2, 3, 20, reopen the conversation later, refresh the browser,
reconnect after an interrupted stream, and continue without losing
context or getting stuck.

Audit the complete chain:

Chat UI → conversation selection → message persistence → run creation →
history/context reconstruction → provider stream → tool calls → tool
results → assistant persistence → run terminal state → next user turn

Fix root causes rather than UI symptoms.

## 62. CONVERSATION DATA MODEL

Use the existing schema if present; do not duplicate it.

Conceptually each conversation needs stable identity and workspace
ownership.

Relevant conversation fields may include:

-   conversationId
-   workspaceId
-   userId
-   title
-   createdAt
-   updatedAt
-   lastMessageAt
-   archived/deleted state

Relevant message fields may include:

-   messageId
-   conversationId
-   role
-   content
-   runId
-   createdAt
-   status/metadata where needed

The server/database is the source of truth, not only React
state/localStorage.

Every turn must reconstruct the relevant conversation history/context
safely.

Do not lose previous messages when tools are used.

## 63. CHAT HISTORY

Chat History must be production reliable.

Support:

-   New Chat
-   conversation sidebar/list
-   useful title
-   preview
-   updated time
-   search
-   reopen
-   continue
-   rename
-   pin if retained by current design
-   archive
-   delete
-   restore where product design supports it

History must survive:

-   page refresh
-   navigation
-   browser reconnect
-   server restart where persistence permits
-   previous run failure

Workspace isolation is mandatory.

Search must not leak another workspace's conversations.

## 64. CHAT RUN / STREAM RECOVERY

Each user turn should have a unique run identity.

Useful run states include:

QUEUED RUNNING THINKING TOOL_RUNNING GENERATING VALIDATING SAVING
SCHEDULING COMPLETED FAILED CANCELLED TIMED_OUT

After any terminal state, the conversation must remain usable.

Support:

-   Stop/Cancel
-   AbortController or equivalent cancellation
-   per-operation timeout
-   overall run timeout
-   bounded retry
-   reconnect/resume
-   stream disconnect recovery
-   persisted errors
-   no duplicate provider request on UI reconnect
-   no duplicate assistant messages
-   no duplicate tool side effects

Retrying a failed response should normally reuse the existing user
message/context and create a new run, not duplicate the user message.

Never leave Retry as a button that creates another broken/stuck run.

## 65. TOOL CALL RELIABILITY

Historical issues included provider stream failure after
`search_content_library` and schema incompatibility in `create_content`.

`create_content` has reportedly been fixed. Do not regress it.

Tool pipeline should be:

model tool call → normalize provider-specific argument shape → validate
strict schema → authorize → execute → normalize safe result → persist
relevant state → return tool result → continue agent loop

A tool error must not leave the conversation permanently unusable.

Empty search results are valid.

Keep tool results context-efficient.

## 66. PROVIDER-AGNOSTIC AI

Qurtiz AI must not be tied to one AI vendor.

Preserve/complete support architecture for providers such as:

-   Google Gemini
-   OpenAI
-   Anthropic Claude
-   Z.ai / GLM
-   MiniMax
-   NVIDIA NIM
-   OpenRouter
-   OmniRouter
-   OpenClaw
-   AutoClaw
-   Custom providers
-   Generic OpenAI-compatible endpoints

Use native adapters when APIs/capabilities differ and a generic
OpenAI-compatible adapter where appropriate.

Chat and Image models must be independently configurable.

Before operations, detect/validate capabilities such as:

-   chat
-   streaming
-   vision
-   tool calling
-   structured output
-   JSON mode
-   image generation

Do not assume all models support the same structured-output or
tool-calling semantics.

## 67. STRUCTURED AI OUTPUT

Use provider-aware structured-output handling.

Preferred order depends on provider capabilities:

native schema/structured output → JSON mode → tool call → validated JSON
extraction/fallback

Handle:

-   Markdown fences
-   malformed JSON
-   truncation
-   missing fields
-   invalid enums
-   provider limitations
-   schema mismatch

Allow only bounded repair/regeneration.

Never create fake/default content merely to hide an AI parsing failure.

## 68. CONTENT STUDIO

Content Studio must be a complete production workflow, not a generator
form.

Support the existing architecture for:

-   text
-   image
-   Carousel
-   Reel/video
-   uploaded media
-   AI-generated media
-   single generation
-   bulk generation
-   editing
-   validation
-   approval
-   scheduling
-   publishing

Typical content lifecycle:

Draft → Generating → Validation → Waiting for Approval → Approved →
Scheduled / Publishing → Published / Failed

Do not auto-publish unless explicitly enabled by user/workspace
automation policy.

## 69. BULK CREATION

Bulk Creation must use real backend AI and the unified content pipeline.

Use relevant:

-   Brand Brain
-   Content Library
-   previous posts
-   Analytics
-   Research
-   Trends
-   Competitor insights
-   keywords

Real progress must come from persisted/backend execution.

One failed item must not freeze the entire batch.

Support appropriate:

-   approve
-   reject
-   edit
-   regenerate
-   retry failed
-   schedule

## 70. BRAND BRAIN / CONTENT LIBRARY / ANALYTICS

Brand Brain is persistent workspace intelligence and should influence
important AI work automatically.

Content Library should be a real reusable source of drafts, approved,
scheduled, rejected, and published content.

The agent should use relevant previous content to reduce repetition.

Analytics must use real available provider/platform data.

Never fabricate reach, impressions, engagement, or performance.

Where analytics are unavailable, say so and continue with available
context.

## 71. RESEARCH & COMPETITOR PRODUCT EXPERIENCE

Research and Competitor functionality should not be isolated decorative
pages.

They should be usable directly by the user AND callable by the AI Agent
through controlled tools.

Useful research/competitor findings should be persistable/retrievable
where the current architecture supports it and should be usable in:

-   strategy
-   content generation
-   bulk creation
-   AI Chat
-   recommendations

Avoid repeated expensive research when fresh stored results can safely
satisfy the request.

## 72. RESPONSIVE MOBILE / TABLET / DESKTOP --- REQUIRED

The entire authenticated SaaS and public site must be intentionally
responsive.

Target:

-   desktop
-   laptop
-   tablet
-   mobile

Do not simply shrink desktop layouts.

Audit every major route at common mobile widths.

Important mobile requirements include:

-   usable navigation/sidebar/drawer
-   AI Chat input always accessible
-   chat history usable on small screens
-   no horizontal overflow
-   touch-friendly controls
-   Content Studio usable without clipped panels
-   Carousel arrows/buttons touch-friendly
-   media upload usable from mobile
-   Calendar has an intentional mobile representation
-   tables convert to responsive layouts where needed
-   modals/dialogs fit viewport and keyboard
-   forms remain usable with mobile keyboard
-   safe-area awareness where relevant
-   no critical hover-only actions
-   readable typography and spacing

Responsive fixes must preserve desktop quality.

## 73. PUBLIC SaaS LANDING PAGE --- NOW IN SCOPE

The Qurtiz AI public landing page is now part of the final project
scope.

Create/finish it using the existing application design language and
architecture.

It must present Qurtiz AI as a credible real SaaS product, not a fake
marketing mockup.

Use a modern 2026 conversion-oriented, premium, clean, fast design.

Avoid excessive gradients, glassmorphism, huge cards, animation, and
visual clutter.

Functionality and credibility come first.

## 74. LANDING PAGE CONTENT / SECTIONS

Adapt exact content to real implemented capabilities. Do not advertise
functionality that does not actually exist.

Useful sections can include:

-   Navigation
-   Hero with clear value proposition
-   Primary CTA
-   Secondary product/demo CTA where appropriate
-   product UI preview using real/current product visuals where
    practical
-   core benefits
-   AI Social Media Agent
-   Content Studio
-   Brand Brain
-   Research & Trends
-   Competitor Analysis
-   Content Library
-   Scheduling/Calendar
-   Meta/Buffer integrations
-   Analytics
-   multi-provider AI capability where appropriate
-   how it works
-   supported platforms/integrations
-   security/reliability trust section
-   pricing/plans when real plan configuration exists
-   FAQ
-   final CTA
-   footer
-   sign in
-   get started / sign up

Do not invent customer counts, revenue, awards, testimonials, logos,
reviews, certifications, or guarantees.

If testimonials/customers do not exist, omit them or use an honest
alternative.

## 75. LANDING PAGE CONVERSION

The landing page should make the product understandable within seconds.

Clearly communicate:

-   what Qurtiz AI is
-   who it is for
-   what problem it solves
-   how the AI Agent differs from a basic content generator
-   how research/competitor/brand intelligence informs content
-   how content moves from creation to approval/scheduling/publishing
-   why a user should create an account

Authentication CTAs must connect to the real auth/onboarding flow.

Pricing CTAs must connect to real plan/entitlement logic when available.

Do not create dead CTA buttons.

## 76. LANDING PAGE TECHNICAL QUALITY

Implement:

-   responsive design
-   semantic HTML
-   accessibility
-   keyboard navigation
-   sensible metadata
-   Open Graph/social metadata
-   canonical handling where appropriate
-   sitemap/robots where appropriate
-   structured data where accurate/useful
-   performance optimization
-   image optimization
-   minimal layout shift
-   good Core Web Vitals
-   no unnecessary client-side JavaScript

Public landing pages should not unnecessarily load authenticated
dashboard code.

## 77. ONBOARDING

A real SaaS needs a clear first-run experience.

Audit whether onboarding exists and complete it where needed.

A new user should be guided toward the minimum useful setup, such as:

-   account/workspace
-   Brand Brain
-   AI provider/model
-   social connection
-   first content/chat task

Do not force every optional configuration before the user can explore.

Show clear setup/connection health.

## 78. PLAN / ENTITLEMENT UX

If plan/usage architecture exists, make it coherent.

Users should be able to understand:

-   current plan
-   relevant usage
-   limits
-   why an action is blocked
-   how to upgrade when applicable

Never let the frontend claim a feature is available when the backend
will reject it for entitlement reasons.

Never enforce paid features only client-side.

## 79. SECURITY FOR A REAL SaaS

Perform a serious security review before production completion.

At minimum inspect:

-   authentication
-   authorization
-   workspace isolation
-   IDOR
-   CSRF
-   XSS
-   SSRF
-   SQL injection
-   command injection
-   file upload validation
-   MIME/content validation
-   URL validation
-   rate limiting
-   API abuse
-   AI tool authorization
-   external-action authorization
-   OAuth state/PKCE where applicable
-   token encryption
-   secret management
-   service-role usage
-   webhook validation if present
-   resource exhaustion
-   logging/redaction

Never expose provider credentials to the client unnecessarily.

## 80. FILE / MEDIA SECURITY

Because Qurtiz handles uploaded images/videos:

-   validate supported MIME/content
-   enforce size/count limits
-   verify workspace ownership
-   prevent cross-workspace asset access
-   use safe object keys/paths
-   avoid trusting filename extension
-   handle failed/partial uploads honestly
-   prevent unsafe URL fetch behavior
-   avoid public exposure beyond intended storage policy

Do not weaken the working multi-media uploader merely to simplify
publishing.

## 81. COST CONTROL / ABUSE PROTECTION

The SaaS must be economically operable.

Audit expensive operations:

-   AI chat
-   bulk AI generation
-   image generation
-   research
-   competitor analysis
-   analytics sync
-   media storage
-   publishing retries

Use appropriate:

-   quotas
-   rate limits
-   caching
-   deduplication
-   bounded retries
-   context filtering
-   model capability selection
-   usage metering

Do not make repeated expensive AI calls when stored/current data can
answer the request.

## 82. DATABASE / SUPABASE

Supabase remains the current backend/database platform unless a major
architecture decision is explicitly approved.

Preserve production-safe connection handling.

A historical production issue involved session connection exhaustion
(`EMAXCONNSESSION`).

Do not create a new database pool/client per request, server action,
worker, or hot reload path if the framework/database architecture
expects reuse.

Use the correct production pooler/connection strategy.

Inspect existing schema before creating migrations.

Protect existing data.

## 83. ENCRYPTION / CREDENTIALS

Production must require secure encryption configuration.

Do not silently fall back to a known/insecure development encryption key
in production.

Encrypted credentials must remain usable across restart/deployment.

Never log:

-   AI API keys
-   Meta access tokens
-   Buffer access tokens
-   refresh tokens
-   service-role keys
-   encryption keys

## 84. BACKGROUND JOBS / SCHEDULER

Scheduling and long-running work must not depend on the browser staying
open.

Audit:

-   job persistence
-   claiming/locking
-   retries
-   timeouts
-   cancellation
-   restart recovery
-   duplicate prevention
-   schedule timezone
-   failure reporting

Background jobs must call the same business services as interactive UI
flows.

## 85. TIMEZONE

Use workspace/user-facing timezone for display/input.

Convert to the provider-required UTC representation for execution.

Reject invalid/past scheduling times.

Preserve enough scheduling data to explain what time the user requested
and what UTC time is executed.

## 86. PRODUCTION ERROR UX

Do not show raw stack traces or vague permanent spinners.

User-facing errors should be safe and actionable.

Useful categories:

-   authentication required
-   permission required
-   connection expired
-   rate limited
-   provider unavailable
-   timeout
-   invalid model
-   unsupported capability
-   upload failed
-   AI generation failed
-   publishing failed
-   scheduling failed
-   database/service unavailable

Preserve detailed sanitized logs server-side.

## 87. OBSERVABILITY

Before final production sign-off, ensure critical workflows can be
diagnosed.

Important correlation IDs may include:

-   requestId
-   runId
-   jobId
-   conversationId
-   contentId
-   provider request/object ID

Do not expose secrets in observability data.

The system should make it possible to answer:

"What failed?" "Where?" "For which workspace/content/run?" "Was an
external side effect already created?" "Can this operation be retried
safely?"

## 88. PERFORMANCE

Audit:

-   initial dashboard load
-   landing page load
-   chat rendering
-   long chat histories
-   Content Library pagination
-   analytics queries
-   database indexes
-   media
-   bundle size
-   unnecessary re-renders
-   unnecessary API calls
-   AI context size

Use pagination/virtualization/caching where justified by real scale.

Do not over-engineer.

## 89. ACCESSIBILITY

Production UI should support:

-   keyboard navigation
-   visible focus
-   semantic controls
-   labels
-   accessible dialogs
-   adequate contrast
-   screen-reader-relevant names/status where practical
-   reduced-motion respect where relevant

Do not sacrifice accessibility for visual effects.

## 90. NO REGRESSION LIST

Unless an actual verified defect requires change, preserve:

-   working Meta OAuth/account discovery
-   working Meta Facebook/Instagram main publishing
-   working Meta First Comment
-   Meta-first / Buffer-fallback strategy
-   working Buffer GraphQL/OAuth/token logic
-   working single-image publishing
-   Content Studio multi-image upload
-   Carousel ordering via `slideIndex`
-   minimalist one-at-a-time Carousel preview
-   Reel video upload/preview
-   AI `create_content` tool fix
-   provider-agnostic AI architecture
-   Brand Brain
-   Content Library
-   approval workflow
-   scheduling architecture
-   workspace isolation
-   encrypted credentials

## 91. INITIAL CODEX AUDIT --- DO THIS BEFORE MAJOR CODE CHANGES

Read this entire `AGENTS.md`.

Then deeply inspect the actual repository.

Do not assume the handoff is perfectly current.

Create a real status map using:

COMPLETE PARTIALLY COMPLETE UI ONLY BROKEN MISSING DUPLICATED

Audit at minimum:

1.  Authentication and onboarding
2.  Workspace/multi-tenant isolation
3.  SaaS plans/entitlements/usage/billing readiness
4.  AI provider configuration
5.  AI Chat Agent
6.  multi-turn continuity
7.  Chat History
8.  tool calling
9.  Research Agent/tools
10. Competitor Agent/tools
11. Brand Brain
12. Content Library
13. Content Studio
14. Carousel/Reel upload
15. Carousel/Reel provider publishing
16. Bulk Creation
17. approval
18. Calendar
19. scheduling/background jobs
20. Meta
21. Buffer
22. Analytics
23. responsive mobile/tablet UI
24. public landing page
25. database integrity
26. security
27. cost controls
28. observability
29. deployment/build
30. critical tests

For every incomplete/broken item identify the root cause, not just the
visible symptom.

## 92. PRIORITY MODEL

Use:

P0 --- security/data-loss/tenant-isolation issues, broken auth,
duplicate external side effects, catastrophic core failures

P1 --- core customer journey blockers: AI Chat continuity, content
creation, approval, media publishing, scheduling, provider integrations,
onboarding

P2 --- SaaS commercial readiness, analytics completeness,
research/competitor depth, reliability, mobile UX, landing page,
observability, performance

P3 --- polish, secondary UX improvements, optional enhancements

Adjust priority when the repository reveals higher real risk.

## 93. IMPLEMENTATION PHASES

After audit, produce and follow a completion roadmap.

Suggested structure:

PHASE 1 --- Foundation, data integrity, auth, workspace security PHASE 2
--- Fix continuous AI Chat + Chat History + run recovery PHASE 3 ---
Enhance Agent + Research + Competitor tools/permissions PHASE 4 ---
Complete Content Studio/Bulk/Brand/Library integration PHASE 5 ---
Complete Carousel/Reel provider publishing PHASE 6 --- Complete
scheduling/background recovery PHASE 7 --- Analytics and feedback loop
PHASE 8 --- SaaS plans/entitlements/usage/billing readiness PHASE 9 ---
Onboarding + account/workspace lifecycle PHASE 10 --- Full mobile/tablet
responsiveness PHASE 11 --- Public SaaS landing page PHASE 12 ---
Security, cost control, observability, performance PHASE 13 --- Full
QA/E2E + production deployment readiness

Adapt phases to actual dependencies.

Do not blindly follow the numbering if repository reality suggests a
safer order.

## 94. IMPLEMENTATION AUTONOMY

After the audit and roadmap, continue systematically completing the
project.

Do not repeatedly ask the user for minor implementation decisions that
can be resolved safely from the repository, this document, tests, or
current official documentation.

Stop and request approval before:

-   destructive production data operations
-   replacing authentication architecture
-   replacing the database
-   removing a major working integration
-   irreversible infrastructure migration
-   changing product/business pricing
-   selecting/activating a paid billing provider with financial
    consequences
-   other major irreversible architectural changes

For normal implementation/refactoring, use senior engineering judgment.

## 95. EXTERNAL API RULE

Meta, Buffer, AI providers, Supabase, billing providers, and framework
APIs evolve.

Before changing external integrations, verify current official
documentation/schema.

Never invent fields/endpoints.

Prefer:

official current documentation/schema → actual provider response →
current repository implementation → tests

Preserve known working behavior unless current evidence shows it is
wrong.

## 96. TESTING STANDARD

Use the repository's canonical scripts.

At minimum, where applicable:

-   typecheck
-   lint
-   unit tests
-   integration tests
-   provider payload tests
-   database tests
-   security-relevant tests
-   production build
-   responsive route review
-   real E2E with configured external providers when
    credentials/environment allow

Important E2E journeys:

### New SaaS User

Sign up → workspace → onboarding → Brand Brain → AI provider → social
connection → first useful result.

### Continuous AI Chat

New conversation → multiple messages → tool call → assistant response →
next message → refresh → reopen history → continue → retry failure →
cancel run → reconnect stream.

### Research / Competitor

Ask Agent for strategy → Agent uses permitted Research/Competitor tools
→ real retrieved results → analysis → content recommendation → save/use
in generation.

### Content

Generate → edit → approve → library → schedule/publish.

### Carousel

Upload multiple images → reorder → preview → approve → schedule/publish
→ provider receives all images in order → real published result
persisted.

### Reel

Upload video → preview → approve → schedule/publish → provider receives
video correctly → real result persisted.

### Provider Fallback

Healthy Meta → Meta used. Meta unavailable + healthy compatible Buffer →
Buffer used. Both unavailable → honest failure, never fake success.

### Workspace Isolation

Two workspaces cannot access each other's chats, media, Brand Brain,
provider credentials, content, analytics, jobs, or research.

### Mobile

Landing, dashboard, chat, history, Studio, media uploader, Library,
Calendar, Connections, Settings all remain usable at mobile width.

## 97. DEFINITION OF A MONETIZABLE REAL SaaS

Qurtiz AI is ready to earn revenue only when:

-   a new customer can understand the product from the landing page
-   sign-up/onboarding works
-   the customer can configure/use the product without developer
    intervention for normal flows
-   tenant data is isolated
-   expensive features can be metered/limited
-   plan entitlements can be enforced
-   AI Chat works continuously
-   Chat History persists
-   Research/Competitor tools work honestly
-   content generation works
-   uploads work
-   Carousel/Reel workflows work
-   approval works
-   scheduling works without browser dependency
-   publishing uses real provider APIs
-   failures are recoverable
-   external side effects are idempotent
-   mobile is usable
-   secrets are protected
-   production can be monitored/debugged
-   costs/abuse are bounded
-   critical journeys are tested
-   the public site does not advertise fake/unimplemented features

## 98. FINAL DELIVERY CHECKLIST

Before declaring FINAL COMPLETE, provide a final evidence-based report
covering:

-   implemented features
-   remaining limitations
-   migrations applied
-   environment variables required
-   external provider setup required
-   SaaS plan/entitlement state
-   billing state
-   security audit findings/fixes
-   mobile/responsive verification
-   landing page verification
-   test results
-   production build result
-   real E2E results
-   provider E2E results
-   known provider limitations
-   deployment instructions
-   rollback/recovery notes where relevant

Do not write "complete" if critical production paths remain untested or
known broken.

## 99. FINAL CODEX COMMAND

Your job is to FINISH Qurtiz AI as a real, reliable, monetizable SaaS
product.

Do not restart the project. Do not downgrade working functionality. Do
not confuse UI with functionality. Do not fake results. Do not fabricate
research/analytics. Do not create duplicate architectures. Do not break
workspace isolation. Do not expose secrets. Do not create unbounded
costs. Do not leave chat continuity unreliable. Do not leave mobile as
an afterthought. Do not leave the public landing page as a mockup. Do
not declare provider publishing successful without provider
confirmation.

Inspect first. Understand the existing architecture. Preserve what
works. Fix root causes. Connect disconnected workflows. Enhance the AI
Agent. Give Research and Competitor tools controlled rights. Make
continuous Chat + Chat History reliable. Complete multi-media
publishing. Complete SaaS commercial foundations. Make the entire
product responsive. Build the real public landing page. Test the actual
customer journey. Deliver production-ready Qurtiz AI.
