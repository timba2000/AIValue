# AI_Pipeline

## Overview

AI_Pipeline is a full-stack TypeScript application designed to manage business process intelligence and automation opportunities. Its primary purpose is to help organizations identify, track, and prioritize AI and automation initiatives by managing companies, business units, processes, pain points, and use cases. The system provides tools for capturing process metrics, identifying inefficiencies, and evaluating potential solutions, thereby streamlining the path to automation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui-inspired primitives.
**State Management:** Zustand for global state, TanStack Query for server state.
**Routing:** Custom lightweight `wouter` implementation.
**Design Decisions:** Component-based architecture, type-safe API layer, responsive mobile-first design, consolidated Dashboard, modal-based forms, global filter context, comprehensive light/dark mode theming with modern contemporary design principles (gradients, glassmorphism, smooth transitions).
**Linking System:** Pain points link to use cases with percentage solved validation and impact calculations.
**Admin Features:** Secure admin section with Replit Auth, user management, bulk Excel uploads/exports for pain points, processes, and taxonomy, manual taxonomy management, and auto-detection/addition of missing entities during uploads. Complete Data Export feature generates a multi-sheet Excel workbook with: Pain Points (with company hierarchy, taxonomy, linked solutions, total % solved), Solutions (with linked pain point counts and hours addressed), Links (pain point to solution mappings), and Company Structure (full hierarchy with metrics per level).
**AI Assistant Features:** AI chat is now integrated directly into the /dashboard page as a collapsible side panel. The AI is context-aware and dynamically adjusts based on the current Filter by Context selections (company, business unit, process). Features include persistent chat history, searchable conversation sidebar, ability to continue previous conversations, expand/minimize panel controls. AI uses persona and rules configured in /admin/ai settings. AI responses render with full markdown support including tables, syntax-highlighted code blocks, lists, headers, and links via react-markdown with remark-gfm and rehype-highlight. Uses GPT-5-mini by default with optional "Thinking Mode" toggle that switches to GPT-5.1-thinking for complex reasoning tasks. Supports file attachments including images (analyzed via GPT-5 vision), PDFs, Excel, Word documents, and CSV files with automatic text extraction.
**AI Context Performance (Dec 2025):** Filter-aware data fetching uses targeted queries (WHERE processId = X, etc.) instead of full-table scans. Unfiltered overview cached with 2-minute TTL. Context includes taxonomy paths (L1 > L2 > L3), linked solutions with percentage solved, and calculated opportunity scores (0-100) based on hours/month, magnitude, frequency, risk level, and effort to solve. Section limits prevent token overflow: process view shows 20 pain points with 5 solutions each, BU view shows 25 pain points, company view shows 15 top pain points by opportunity score. All entities include citations ([PP:xxxxxxxx], [UC:xxxxxxxx], [PROC:xxxxxxxx], [BU:xxxxxxxx], [CO:xxxxxxxx]) for traceability. Pain point lists are sorted by opportunity score before truncation to show highest-value items first. Scores display "(estimated)" when required fields are missing.
**LLM-Powered Text-to-SQL (Dec 2025):** AI assistant uses GPT-4o-mini to dynamically generate SQL queries from natural language questions. The system provides comprehensive database schema context to the LLM including table structures, column types, relationships, and key concepts (like linked vs unlinked pain points). Questions like "which pain points are linked with the Adobe solution?", "list unlinked pain points", or "show me the top 10 business units by hours per month" are automatically translated to SQL, executed via the read-only SQL executor (with security checks, row limits, and timeouts), and results are formatted as markdown tables. The isDataQuestion detector uses pattern-based heuristics requiring domain-specific entities combined with action words to avoid triggering on generic conversation. The text-to-SQL service (backend/src/services/textToSql.ts) includes automatic retry with error context if the first query fails.
**Live SQL Execution (Dec 2025):** AI responses containing SQL code blocks can be executed directly from the chat interface via "Run Query" button. Read-only SQL execution service at POST /api/ai/execute-sql with comprehensive security: blocks write operations (INSERT/UPDATE/DELETE/DROP/etc.), enforces 100-row limit via string-aware parser that ignores LIMIT in string literals, 10-second query timeout, single-statement validation, SQL injection pattern blocking. Audit logging tracks all queries at GET /api/ai/admin/sql-audit-logs (admin only). Frontend SQLExecutor component renders results as formatted tables with execution time and row counts.
**Admin Chat History Management (Dec 2025):** Administrators can view and delete AI chat history from /admin/ai. Features include: list all conversations across all users with title, user name, message count, and last updated date; checkbox selection for individual or bulk selection; delete selected conversations; delete all conversations with confirmation dialog. Cascading deletes automatically clean up related messages and file uploads.
**Knowledge Graph Visualization (Dec 2025):** Interactive canvas-based knowledge graph on the dashboard showing company > business unit > process > pain point > solution relationships. Pain points are color-coded by linked status: green for linked (has solutions), red for unlinked (no solutions). Node size scales dynamically based on hours/month impact (12-28px radius range). High-impact unlinked pain points (50+ hours/month without solutions) display a red glow effect for visual emphasis. Directional green arrows indicate pain point-to-solution connections. Interactive filter controls include: status filter dropdown (All/Linked/Unlinked) and minimum hours/month threshold slider. Enhanced tooltips display hours/month, solution count, and linked status for pain points. Legend includes color-coding explanation and high-impact indicator badge. Toggle controls for processes, pain points, and solutions visibility.

### Backend Architecture

**Technology Stack:** Node.js with Express, TypeScript, Drizzle ORM, PostgreSQL (with pgvector).
**API Design:** RESTful endpoints, CRUD operations, validation, error handling, CORS.
**Database Schema:** Hierarchical data model (Companies → Business Units → Processes → Pain Points/Use Cases), UUID primary keys, cascading deletes, timestamp tracking, many-to-many relationships, flexible schema evolution via Drizzle ORM. Business units support 3-level nesting with parent/child relationships and FTE validation. Pain points can be linked directly to business units. Solutions (use cases) can be associated with companies, business units, or processes (or any combination).
**Service Layer:** LLM classifier service for categorization, opportunity scoring service.
**Key Architectural Decisions:** Flexible Database Schema Evolution with Drizzle ORM, Complex Entity Relationship Management, Frontend-Backend Type Consistency.
**Authentication:** Mandatory authentication using Replit Auth (OpenID Connect) with session-based authentication and PostgreSQL session store. Admin authorization via `ADMIN_USER_IDS` environment variable.
**Role-Based Access Control (Dec 2025):** Three-tier permission system with Reader, Editor, and Admin roles. Readers can view all data but cannot modify anything. Editors can create, update, and delete companies, business units, processes, pain points, and solutions. Admins have full access including user management, role changes, user deletion, and system configuration. Role is stored in users table with default 'reader'. Backend middleware (`isEditorOrAdmin`) protects all mutation routes (POST/PUT/DELETE). Frontend `useAuth` hook exposes `role`, `isEditor`, `canEdit` for UI gating. Admin user management page allows role changes via dropdown and user deletion with two-step confirmation. Safeguards prevent self-deletion and demoting/deleting the last admin.

## External Dependencies

**Database:**
- Neon PostgreSQL (or compatible PostgreSQL) with `vector` extension for pgvector. Configured via `DATABASE_URL`.

**Third-Party APIs:**
- OpenAI-compatible LLM endpoint for use case classification. Configured via `LLM_CLASSIFIER_MODEL`.

**NPM Packages:**
- **Frontend:** `@tanstack/react-query`, `axios`, `zustand`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-label`.
- **Backend:** `drizzle-orm`, `drizzle-kit`, `pg`, `pgvector`, `express`, `cors`, `dotenv`, `tsx`, `multer`, `pdf-parse`, `mammoth`, `xlsx`, `exceljs`.

**Environment Configuration:**
- `DATABASE_URL`, `CLIENT_ORIGIN`, `PORT`, `VITE_API_URL`, `LLM_CLASSIFIER_MODEL`, `SESSION_SECRET`, `ADMIN_USER_IDS`.