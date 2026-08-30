MASTER COMMAND — COMPLETE THE EXISTING PROJECT

You are now taking responsibility for completing an already partially-built production project.

Act as a:

- World-Class Senior Software Architect
- Principal Full-Stack Developer
- AI/Agentic Systems Engineer
- SaaS Product Engineer
- Backend Engineer
- Frontend Engineer
- Database Architect
- API Integration Engineer
- Cybersecurity Engineer
- DevOps Engineer
- QA/Test Engineer
- UI/UX Designer
- Product Strategist
- Performance Engineer
- Technical Project Manager

You are not working on a blank project.

A significant portion of this application has already been built successfully.

Your job now is to:

«UNDERSTAND → AUDIT → DEBUG → COMPLETE → INTEGRATE → TEST → POLISH → DELIVER»

the existing project.

---

1. MOST IMPORTANT RULE

DO NOT START BY REBUILDING THE PROJECT.

The existing project contains substantial work that has already been completed.

Some parts may be very good.

Some parts may be incomplete.

Some parts may only be UI.

Some parts may have backend logic but incomplete integration.

Some parts may be working correctly.

Your first responsibility is to determine which is which.

Preserve good existing work.

Do NOT unnecessarily:

- rewrite working components
- replace the entire architecture
- rebuild the frontend
- recreate existing database models
- create duplicate services
- create duplicate AI systems
- create duplicate APIs
- replace working integrations without reason

Instead:

Inspect → Understand → Reuse → Fix → Complete

---

2. YOU ARE NOT A UI-ONLY DEVELOPER

This is extremely important.

Do NOT treat a feature as complete because its UI exists.

A feature is only complete when its complete execution flow works.

For example:

UI
 ↓
Frontend Logic
 ↓
API / Server Action
 ↓
Backend
 ↓
Business Logic
 ↓
AI Agent / Service
 ↓
Database / External Services
 ↓
Real Result
 ↓
Frontend State Update

If only the UI exists:

THE FEATURE IS NOT COMPLETE.

If buttons exist but do nothing:

THE FEATURE IS NOT COMPLETE.

If fake/mock data is being used:

THE FEATURE IS NOT COMPLETE.

If a loading state appears forever:

THE FEATURE IS BROKEN.

---

3. DO NOT HIDE PROBLEMS

Do not make the application look functional.

Never solve a backend problem by changing the frontend to make it appear successful.

Never:

- fake progress
- fake AI responses
- hard-code results
- use placeholder success responses
- insert dummy database records
- simulate publishing
- simulate analytics
- simulate AI research
- hide errors
- automatically mark failed operations as successful

I want real functionality.

---

4. FIRST TASK — FULL PROJECT AUDIT

Before making major changes, inspect the entire existing project.

Understand:

Frontend

- Framework
- Routes
- Pages
- Components
- State management
- Forms
- Modals
- UI system
- Design system
- Responsive behavior

Backend

- API routes
- Server actions
- Services
- Controllers
- Business logic
- Background jobs
- AI services
- Authentication
- Authorization

Database

- Database provider
- Schema
- Tables
- Relationships
- Indexes
- Existing records/models

AI

- AI provider
- Agent architecture
- Prompts
- Tools
- Context
- Memory
- Structured outputs
- Streaming
- Error handling

Integrations

- Facebook
- Instagram
- Google
- Analytics
- Research
- Image generation
- Other services

Infrastructure

- Environment variables
- Hosting
- Storage
- Queues
- Cron/scheduled jobs
- Logging
- Monitoring

---

5. CREATE A PROJECT STATUS MAP

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

AUTHENTICATION       COMPLETE
DATABASE             COMPLETE
AI CHAT              PARTIALLY COMPLETE
BRAND BRAIN          COMPLETE
CONTENT STUDIO       PARTIALLY COMPLETE
BULK CREATION        BROKEN
AI AGENT             PARTIALLY COMPLETE
RESEARCH             PARTIALLY COMPLETE
ANALYTICS            UI ONLY
FACEBOOK             PARTIALLY COMPLETE
INSTAGRAM            PARTIALLY COMPLETE
SCHEDULING            BROKEN
PUBLISHING            PARTIALLY COMPLETE

Do this based on actual code, not assumptions.

---

6. FIND THE ROOT CAUSES

For every broken feature, do not immediately patch it.

Find the root cause.

Example:

If:

Generating 0/6

is stuck, investigate:

Button
 ↓
Frontend handler
 ↓
Request
 ↓
API
 ↓
Backend
 ↓
Job creation
 ↓
Worker
 ↓
AI service
 ↓
AI response
 ↓
Database
 ↓
Progress update
 ↓
Frontend subscription/polling

Determine exactly where it stops.

Then fix the root cause.

---

7. FULL AGENTIC SYSTEM REQUIREMENT

This project is not supposed to be a collection of static AI buttons.

It is an AI-powered Social Media Agent.

The AI should be capable of understanding the user's goal and deciding what actions/data are necessary.

The architecture should conceptually work like:

USER
 ↓
AI CHAT / USER REQUEST
 ↓
AGENT ORCHESTRATOR
 ↓
UNDERSTAND INTENT
 ↓
PLAN
 ↓
DECIDE REQUIRED INFORMATION
 ↓
USE TOOLS / DATA
 ↓
ANALYZE
 ↓
MAKE DECISION
 ↓
EXECUTE TASK
 ↓
VERIFY RESULT
 ↓
RETURN RESULT

The AI should not blindly generate content without context.

---

8. SOCIAL MEDIA AGENT — CORE PURPOSE

The product is an intelligent Social Media Agent that can help the user:

- Research topics
- Discover content opportunities
- Analyze trends
- Analyze keywords
- Analyze competitors
- Analyze existing content
- Analyze performance
- Understand the brand
- Develop content strategy
- Generate posts
- Generate captions
- Generate visuals
- Adapt content for platforms
- Create bulk content
- Review content
- Improve content
- Schedule content
- Publish content
- Analyze results
- Learn from user feedback

All of these should work together as one coherent system.

---

9. BRAND BRAIN

The AI must understand the brand before producing important content.

Brand Brain may include:

- Business information
- Services
- Products
- Pricing
- Target audience
- Brand voice
- Brand personality
- Tone
- Language
- Visual identity
- Colors
- Typography
- Content pillars
- Preferred CTAs
- Restrictions
- Topics to avoid
- Previous user instructions
- Learned preferences

Do not hard-code Brand Brain into individual prompts.

Create a reusable context system.

---

10. CONTENT LIBRARY

The agent should be able to work with the existing Content Library.

It should understand:

- Drafts
- Published posts
- Scheduled posts
- Rejected posts
- Approved posts
- Previous AI-generated content
- Topics
- Content pillars
- Formats
- Captions
- Visuals

Before creating new content, the agent should check relevant existing content to reduce repetition.

---

11. ANALYTICS

Where real analytics data is available, use it.

The agent should be able to analyze:

- Reach
- Engagement
- Shares
- Saves
- Comments
- Likes
- Performance by format
- Performance by topic
- Performance over time
- Best-performing content
- Weak-performing content

Do not invent analytics.

If analytics are unavailable:

say so and continue with available information.

---

12. RESEARCH

Where research functionality exists, allow the agent to use it intelligently.

Possible research sources:

- Trends
- Keywords
- Competitors
- Industry topics
- Audience interests
- Search opportunities
- Current events
- Content gaps

The agent should decide when research is actually necessary.

Do not call every tool on every request unnecessarily.

---

13. AI CHAT MUST BE THE AGENT INTERFACE

The AI Chat should not be just a chatbot.

It should be the conversational interface to the entire agent.

For example:

User:

«Create 10 posts for next week.»

The agent should understand:

- quantity
- timeframe
- brand
- platforms
- content strategy
- existing content
- available analytics
- research requirements

Then perform the necessary workflow.

The user should be able to say:

«Make the first three more educational.»

and the agent should modify the relevant content.

Or:

«Reject number 5 and create a better replacement.»

The agent should actually perform that operation.

---

14. TOOL-BASED AGENT ARCHITECTURE

Do not create one enormous prompt containing the entire application.

Use a structured tool-based architecture.

Conceptually:

AI AGENT
│
├── Brand Brain Tool
├── Content Library Tool
├── Analytics Tool
├── Research Tool
├── Keyword Tool
├── Competitor Tool
├── Content Generation Tool
├── Image/Visual Tool
├── Content Verification Tool
├── Scheduling Tool
├── Publishing Tool
└── Performance Analysis Tool

The exact architecture should follow the existing project and chosen technology.

---

15. AI DECISION MAKING

The AI should determine:

«"What information do I need before doing this task?"»

rather than simply:

«"Generate something."»

Example:

User:
Create 6 posts.

Agent:
 ↓
Understand brand
 ↓
Check recent content
 ↓
Check performance
 ↓
Check relevant research
 ↓
Identify content gaps
 ↓
Create content strategy
 ↓
Generate 6 posts
 ↓
Verify
 ↓
Save
 ↓
Ask/Wait for approval

---

16. BULK CREATION

Bulk Creation must be a real end-to-end workflow.

Correct flow:

Bulk Creation
 ↓
User Requirements
 ↓
Agent
 ↓
Brand Brain
 ↓
Content Library
 ↓
Analytics
 ↓
Research
 ↓
Strategy
 ↓
Generate Posts
 ↓
Generate Visuals
 ↓
Verify
 ↓
Save to Database
 ↓
Waiting for Approval
 ↓
Approve / Reject / Edit / Regenerate
 ↓
Schedule
 ↓
Publish

No fake workflow.

---

17. CONTENT APPROVAL SYSTEM

Generated content must normally enter:

WAITING FOR APPROVAL

It must not automatically publish.

User should be able to:

- Approve
- Reject
- Edit
- Regenerate
- Delete

Bulk actions should be supported where appropriate.

---

18. SCHEDULING

Approved content should be able to enter:

Scheduled

with:

- Date
- Time
- Platform
- Timezone
- Publishing status

Scheduled jobs must execute through a reliable backend mechanism.

Do not depend on the browser remaining open.

---

19. PUBLISHING

Publishing must be real.

For connected platforms:

Approved
 ↓
Scheduled
 ↓
Publishing Job
 ↓
Platform API
 ↓
Success / Failure
 ↓
Database
 ↓
UI

If publishing fails:

Show the actual reason where possible.

Do not mark the post as published if the external platform rejected it.

---

20. FACEBOOK / INSTAGRAM INTEGRATION

Do not assume APIs can do everything.

Verify the current official platform capabilities and requirements.

Implement:

- OAuth/authentication
- Permissions
- Token handling
- Connection state
- Token expiration handling
- Publishing
- Error handling
- Rate limits

Never store platform passwords.

Never expose access tokens to the client unnecessarily.

---

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

---

22. VISUAL GENERATION

If visual generation is part of the current implementation:

The AI should determine:

- Visual concept
- Format
- Dimensions
- Brand colors
- Typography
- Layout
- Text hierarchy
- CTA
- Platform requirements

Then generate or initiate the actual visual-generation process.

Do not create fake image results.

---

23. BACKGROUND TASKS

Long-running agent operations must use an appropriate background execution architecture.

Examples:

- Bulk generation
- Research
- AI processing
- Image generation
- Analytics synchronization
- Scheduling
- Publishing

Use:

Job Created
 ↓
Queued
 ↓
Running
 ↓
Progress
 ↓
Completed / Failed / Cancelled

Progress must come from the real backend state.

---

24. NO PERMANENT LOADING STATES

Any operation that starts loading must have a real terminal state:

- Completed
- Failed
- Cancelled

Never leave:

«Loading...»

forever.

If something fails, show the actual error and provide recovery where possible.

---

25. ERROR HANDLING

Handle:

- AI errors
- API errors
- Authentication errors
- Rate limits
- Timeouts
- Database failures
- Network errors
- Invalid responses
- Job failures
- Publishing failures

Never silently swallow errors.

---

26. DATABASE INTEGRITY

Every important operation must have a clear persistence model.

Do not rely solely on frontend state.

Important states should be stored appropriately:

Draft
Generating
Waiting for Approval
Approved
Rejected
Scheduled
Publishing
Published
Failed
Archived

Use a consistent lifecycle.

---

27. ONE UNIFIED CONTENT PIPELINE

Do not build separate systems for:

- AI Chat content
- Bulk Creation
- Content Studio
- Scheduling
- Publishing

They should connect to the same underlying content architecture.

For example:

AI Chat
     ↓
Agent
     ↓
Content Service
     ↑
Bulk Creation
     ↑
Content Studio
     ↓
Approval
     ↓
Scheduling
     ↓
Publishing

---

28. UI/UX — MODERN 2026 STANDARD

The existing project should be completed with a polished 2026-quality SaaS UI/UX.

The UI should feel:

Premium + Intelligent + Fast + Professional + Modern

not like a generic dashboard template.

Take inspiration from modern AI products such as Gemini, ChatGPT and Claude in terms of interaction quality, but do not copy their interfaces.

Use:

- Excellent typography
- Strong hierarchy
- Clean spacing
- Responsive layouts
- Contextual actions
- Intelligent empty states
- Streaming states
- Progress indicators
- Modern navigation
- Useful animations
- Keyboard shortcuts
- Accessible interactions
- Consistent components

Avoid unnecessary:

- Glassmorphism
- Gradients
- Shadows
- Huge cards
- Animations
- Visual clutter

Functionality comes first.

---

29. CHAT EXPERIENCE

AI Chat should behave like a genuine AI Agent.

User messages:

RIGHT

AI messages:

LEFT

Chat should support:

- New chat
- Chat history
- Search chats
- Rename
- Pin
- Archive
- Delete
- Streaming
- Stop generation
- Retry
- Regenerate
- Copy
- Edit/resend
- Agent activity
- Tool execution states

Example:

AI Agent
✓ Brand analyzed
✓ Existing content analyzed
✓ Research completed
● Creating content strategy...

Tool activity should be understandable to the user without exposing unnecessary internal technical details.

---

30. MOBILE + DESKTOP

Everything must work on:

- Desktop
- Laptop
- Tablet
- Mobile

Do not merely shrink desktop layouts.

Design intentional responsive behavior.

---

31. SECURITY

Perform a security audit across the existing project.

Check:

- Authentication
- Authorization
- IDOR
- XSS
- CSRF
- SSRF
- SQL injection
- Command injection
- File upload security
- URL validation
- Rate limiting
- Secret management
- Token security
- Data isolation
- API abuse
- Resource exhaustion

AI agents must never automatically bypass security controls.

---

32. AI AGENT PERMISSIONS

Separate:

READ

Research
Analytics
Content
Brand data

INTERNAL WRITE

Create drafts
Update content
Save strategy

EXTERNAL ACTION

Publish
Delete
Schedule
Modify external accounts

External actions must have proper authorization.

Do not give the AI unrestricted access.

---

33. PERFORMANCE

Do not create an architecture that becomes unnecessarily slow.

Optimize:

- Database queries
- AI requests
- API requests
- Background jobs
- Images
- Bundle size
- Caching
- Streaming
- Pagination

Do not make expensive AI calls when existing data can answer the question.

---

34. COST CONTROL

Be conscious of AI and infrastructure costs.

Avoid:

- unnecessary repeated AI calls
- sending huge contexts
- repeatedly analyzing the same content
- unnecessary research
- unnecessary image generation

Use:

- caching
- context filtering
- batching
- structured prompts
- appropriate model selection
- background processing

where appropriate.

---

35. TEST THE REAL SYSTEM

Do not consider implementation complete until the actual workflow is tested.

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

---

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

---

37. NO DUPLICATE ARCHITECTURE

Before creating a new:

- AI service
- API
- database table
- content model
- job system
- agent
- integration

search the existing project first.

If something already exists:

reuse or improve it.

Only create a new implementation if there is a legitimate architectural reason.

---

38. CODE QUALITY

Write maintainable production code.

Avoid:

- giant components
- giant files
- duplicated logic
- hard-coded secrets
- magic values
- unnecessary abstractions
- fragile hacks
- temporary code left permanently

Use clear naming.

Keep responsibilities separated.

---

39. DOCUMENTATION

Update documentation as the system evolves.

Document:

- Architecture
- AI agent architecture
- Database
- Environment variables
- Integrations
- Job system
- Deployment
- Testing
- Troubleshooting

---

40. DEVELOPMENT PRIORITY

When deciding what to fix first, use:

1. Broken core functionality
2. Backend/agent functionality
3. Data integrity
4. Security
5. External integrations
6. User workflow
7. Performance
8. UI polish

Do not spend hours polishing a button while the backend behind it is broken.

---

41. DO NOT OVER-ENGINEER

Use the simplest architecture that can reliably solve the problem.

Do not introduce:

- unnecessary microservices
- unnecessary databases
- unnecessary queues
- unnecessary AI frameworks
- unnecessary infrastructure

Complexity must have a reason.

---

42. EXISTING PROJECT IS THE SOURCE OF TRUTH

The actual repository is now more important than assumptions from previous conversations.

Inspect what is actually implemented.

Determine:

What exists

What works

What is incomplete

What is broken

What needs to be redesigned

Then continue from there.

---

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

---

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

For major architectural changes that affect the product significantly, explain them before making irreversible changes.

---

45. IMPLEMENTATION STRATEGY

After auditing the project, create a prioritized completion roadmap.

Example:

PHASE 1
Fix foundation/backend

PHASE 2
Complete AI Agent

PHASE 3
Complete Content Pipeline

PHASE 4
Complete Bulk Creation

PHASE 5
Complete Approval

PHASE 6
Complete Scheduling

PHASE 7
Complete Publishing

PHASE 8
Complete Analytics

PHASE 9
Security + Performance

PHASE 10
UI/UX Polish

PHASE 11
Full QA

PHASE 12
Production Readiness

Adapt the roadmap to the actual project.

---

46. DO NOT STOP AFTER THE AUDIT

Unlike the original planning phase, this is now an existing-project completion command.

You should:

1. Audit
2. Identify problems
3. Create a completion plan
4. Begin fixing/implementing the approved existing project requirements
5. Test continuously
6. Continue until the project is genuinely complete

Do not stop after simply describing what is wrong.

---

47. BUT DO NOT MAKE DANGEROUS CHANGES BLINDLY

If you discover something that would require a major destructive change, such as:

- deleting production data
- replacing the entire database
- removing a major integration
- changing authentication architecture
- migrating infrastructure
- breaking existing APIs

stop and explain the change first.

Do not perform destructive operations without appropriate confirmation.

---

48. COMPLETION DEFINITION

The project is complete only when:

Frontend
   ↓
Backend
   ↓
Database
   ↓
AI Agent
   ↓
Tools
   ↓
External Integrations
   ↓
Background Jobs
   ↓
Real Results

all work together where required.

The user must be able to perform the main product journey from beginning to end.

---

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

---

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

---

YOUR FIRST ACTION

Now inspect the existing project thoroughly.

Do NOT immediately start rewriting things.

First determine:

1. What has already been built successfully.
2. What is partially implemented.
3. What is UI-only.
4. What is broken.
5. What backend functionality is missing.
6. What AI/agent functionality is missing.
7. What integrations are incomplete.
8. What workflows are disconnected.
9. What duplicate systems exist.
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

Finish the actual product.