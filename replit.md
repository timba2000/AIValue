# AIValue Use Case Tracker

## Overview

AIValue Use Case Tracker is a full-stack TypeScript application designed to manage business process intelligence and automation opportunities. Its primary purpose is to help organizations identify, track, and prioritize AI and automation initiatives by managing companies, business units, processes, pain points, and use cases. The system provides tools for capturing process metrics, identifying inefficiencies, and evaluating potential solutions, thereby streamlining the path to automation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui-inspired primitives.
**State Management:** Zustand for global state, TanStack Query for server state.
**Routing:** Custom lightweight `wouter` implementation.
**Design Decisions:** Component-based architecture, type-safe API layer, responsive mobile-first design, consolidated Dashboard, modal-based forms, global filter context, comprehensive light/dark mode theming with modern contemporary design principles (gradients, glassmorphism, smooth transitions).
**Linking System:** Pain points link to use cases with percentage solved validation and impact calculations.
**Admin Features:** Secure admin section with Replit Auth, user management, bulk Excel uploads/exports for pain points, processes, and taxonomy, manual taxonomy management, and auto-detection/addition of missing entities during uploads.
**AI Assistant Features:** Conversational AI with persistent chat history, searchable conversation sidebar, ability to continue previous conversations. AI uses persona and rules configured in /admin/ai settings. AI responses render with full markdown support including tables, syntax-highlighted code blocks, lists, headers, and links via react-markdown with remark-gfm and rehype-highlight. Uses GPT-5-mini by default with optional "Thinking Mode" toggle that switches to GPT-5.1-thinking for complex reasoning tasks.

### Backend Architecture

**Technology Stack:** Node.js with Express, TypeScript, Drizzle ORM, PostgreSQL (with pgvector).
**API Design:** RESTful endpoints, CRUD operations, validation, error handling, CORS.
**Database Schema:** Hierarchical data model (Companies → Business Units → Processes → Pain Points/Use Cases), UUID primary keys, cascading deletes, timestamp tracking, many-to-many relationships, flexible schema evolution via Drizzle ORM. Business units support 3-level nesting with parent/child relationships and FTE validation. Pain points can be linked directly to business units. Solutions (use cases) can be associated with companies, business units, or processes (or any combination).
**Service Layer:** LLM classifier service for categorization, opportunity scoring service.
**Key Architectural Decisions:** Flexible Database Schema Evolution with Drizzle ORM, Complex Entity Relationship Management, Frontend-Backend Type Consistency.
**Authentication:** Mandatory authentication using Replit Auth (OpenID Connect) with session-based authentication and PostgreSQL session store. Admin authorization via `ADMIN_USER_IDS` environment variable.

## External Dependencies

**Database:**
- Neon PostgreSQL (or compatible PostgreSQL) with `vector` extension for pgvector. Configured via `DATABASE_URL`.

**Third-Party APIs:**
- OpenAI-compatible LLM endpoint for use case classification. Configured via `LLM_CLASSIFIER_MODEL`.

**NPM Packages:**
- **Frontend:** `@tanstack/react-query`, `axios`, `zustand`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-label`.
- **Backend:** `drizzle-orm`, `drizzle-kit`, `pg`, `pgvector`, `express`, `cors`, `dotenv`, `tsx`.

**Environment Configuration:**
- `DATABASE_URL`, `CLIENT_ORIGIN`, `PORT`, `VITE_API_URL`, `LLM_CLASSIFIER_MODEL`, `SESSION_SECRET`, `ADMIN_USER_IDS`.