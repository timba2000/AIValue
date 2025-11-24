# AIValue Use Case Tracker

## Overview

AIValue Use Case Tracker is a full-stack TypeScript application for managing business process intelligence and automation opportunities. The system enables organizations to track companies, business units, processes, pain points, and use cases to identify and prioritize automation initiatives. It provides a structured approach to capturing process metrics, identifying inefficiencies, and evaluating potential AI/automation solutions.

## User Preferences

Preferred communication style: Simple, everyday language.

## Database Schema Management

**For Development:**
- Use `npm run db:push` to sync schema changes directly to the database
- If conflicts occur, use `npm run db:push --force` to force sync
- Never manually write SQL migration files

**For Production Deployment:**
- `backend/src/seed-migrations.ts` automatically tracks all existing migrations on first deployment
- This prevents re-running migrations that have already been applied
- The script scans all .sql files in `backend/drizzle/migrations/` and marks them as applied in `__drizzle_migrations` table
- Future migrations (if any) will be applied normally via migrate.ts
- Note: There may be schema drift warnings which are safely ignored during deployment due to mixed migration history

## Recent Changes

**November 24, 2025:**
- **Fixed deployment migration failures:**
  - Root cause: Production database's `__drizzle_migrations` table was empty, causing migrations to re-run and fail with "column already exists" errors
  - Created smart one-time migration backfill script (`backend/src/seed-migrations.ts`):
    - Detects first deployment (empty migration tracking table)
    - Checks if database is fresh (no tables) or existing (has schema applied)
    - For existing databases: backfills 8 known baseline migrations to prevent re-running them
    - For fresh databases: skips backfill, lets normal migration process create tables
    - Subsequent deployments: sees migrations already tracked, no action needed
  - Enhanced `backend/src/migrate.ts` to handle schema drift errors gracefully:
    - Catches PostgreSQL duplicate column/table errors (codes 42P07, 42701, 2BP01)
    - Logs them as expected on first deployment with existing database
    - Still fails on unexpected migration errors
  - Updated `backend/start.sh` to run seed-migrations first, then migrate, then start app
  - Future new migrations (e.g., 0008_xxx.sql) will execute normally since they're not in the baseline list
- **Built tabbed Dashboard with Analytics and Opportunities views:**
  - Renamed "Opportunities Dashboard" to "Dashboard" in navigation and created tab-based interface
  - **Analytics Tab** displays executive summary metrics and prioritization matrix:
    - Created MetricsCards component showing: Total Pain Points, Total Use Cases, Coverage % (pain points with linked solutions), Total Hours/Month being addressed, and Total FTE Impacted
    - Built PrioritizationMatrix component with canvas-based scatter plot visualization
    - X-axis: Effort to Solve (1-10), Y-axis: Impact of Pain Point (1-10), bubble size represents total hours per month
    - Color coding: blue bubbles for pain points with linked use cases, red for those without solutions
    - Created optimized backend endpoint `/api/pain-point-links/stats` that returns aggregated link counts in a single query (eliminates N+1 query pattern)
  - **Opportunities Tab** contains the linking functionality:
    - Cascading filter system: Business → Business Unit → Process (downstream filters disabled until parent selected)
    - Process-filtered pain points display with visual cards showing impact, effort, and total hours
    - Modal-based "Link Use Case" interface with use case selector, percentage solved input (0-100%), and optional notes
    - Real-time UI updates using React Query mutations with proper cache invalidation
  - Added GET endpoint for business units (`/api/business-units`) to enable dropdown population
  - All link mutations (create, update, delete) now invalidate stats query for immediate analytics refresh
  - Task-oriented workflow: view analytics to identify priorities, switch to opportunities tab to link solutions to specific pain points

**November 23, 2025:**
- **Fixed deployment database migration conflicts:**
  - Created programmatic migration runner (`backend/src/migrate.ts`) using Drizzle's migrate function
  - Added startup script (`backend/start.sh`) that runs migrations before starting the app
  - Updated deployment configuration to use startup script for automatic migration on publish
  - Updated build process to copy migration files to dist folder for production deployment
  - Added migration file (0007_use_case_schema_update.sql) to Drizzle migrations folder
  - Production deployments now automatically apply all pending database migrations before starting
- Restructured Use Cases form with significant field changes:
  - Removed Process dropdown and made `processId` optional (use cases no longer required to be linked to a process)
  - Renamed "Description" field to "Solution Provider" (text input)
  - Changed "Expected Benefits" to percentage input (0-100%) with numeric storage
  - Converted "Data Requirements" to multi-select checkboxes (Structured Data, Unstructured Data)
  - Changed "Risks" to dropdown with predefined values (High, Medium, Low)
  - Changed "Systems Impacted" from multi-select to comma-delimited text input
  - Removed "Value Drivers", "FTE Hours", and "ROI Estimate" fields
- Updated Use Cases database schema via manual SQL migration (0007):
  - Renamed `description` → `solution_provider` (text)
  - Renamed `expected_benefits` → numeric type (was text, now stores 0-100 percentage)
  - Changed `data_requirements` to text array (supports multiple selections)
  - Made `process_id` nullable (allows use cases without process association)
  - Dropped `value_drivers`, `estimated_fte_hours`, and `roi_estimate` columns
- Enhanced backend API to properly convert Drizzle numeric types to JavaScript numbers for `expectedBenefits` field across all endpoints (GET, POST, PUT)
- Updated Use Cases table display: removed Process filter, added "Solution Provider" and "Expected Benefits (%)" columns
- Enhanced Pain Points form with comprehensive updates:
  - Renamed "Magnitude (1-10)" to "Impact of Pain Point (1-10)" with descriptive helper text (1 = Low impact, 10 = High impact)
  - Renamed "Opportunity Potential (1-10)" to "Effort in Solving (1-10)" with helper text (1 = Low effort, 10 = High effort)
  - Converted Impact Type from single-select to multi-select checkboxes (users can now select multiple impact types per pain point)
  - Added "Time Required per unit (Hrs)" field for tracking time spent per occurrence
  - Added "# FTE on painpoint" field for tracking full-time equivalents working on the issue
  - Implemented automatic calculation of "Total Hours per Month" (Frequency × Time per unit) displayed in form and table
- Updated Pain Points database schema:
  - Changed `impact_type` from text to text array to support multiple selections
  - Renamed `opportunity_potential` column to `effort_solving`
  - Added `time_per_unit`, `total_hours_per_month`, and `fte_count` numeric columns
  - Applied migration to preserve existing data while converting to new schema
- Enhanced pain points table display to show total hours per month and multiple impact type badges
- Updated Use Cases page layout for cleaner, modal-based form interaction:
  - Removed always-visible sidebar form from desktop view for cleaner full-width layout
  - Added "New Usecase" button in page header
  - Form now only appears when needed - in a modal dialog when clicking "New Usecase" or editing an existing use case
  - Modal properly manages state between create and edit modes
  - Consistent behavior across all screen sizes

**November 22, 2025:**
- Fixed database schema sync issue: dropped and recreated use_cases table with correct "name" column
- Built complete Pain Points management feature with full CRUD functionality:
  - Created pain points types (PainPoint, PainPointPayload, ImpactType, RiskLevel)
  - Implemented frontend page with list view, search, and modal form
  - Added backend API endpoints (GET, POST, PUT, DELETE) with validation
  - Supports tracking: statement, impact type, risk level, magnitude, frequency, root cause, workarounds, dependencies, and opportunity potential
- Added industry dropdown to company form with 19 standardized ANZSIC industry categories (A-S)
- Implemented auto-population of ANZSIC division codes when selecting an industry
- Added backward compatibility for companies with legacy custom industry values
- Fixed API configuration to use Vite proxy for frontend-backend communication (changed default VITE_API_URL from localhost:3000 to relative URLs)
- Added volume unit dropdown to process form with three standardized options: "per day", "per month", "per year"

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with Vite for fast development and optimized production builds
- TypeScript for type safety across the application
- Tailwind CSS for utility-first styling with a custom design system
- shadcn/ui-inspired component primitives for consistent UI patterns

**State Management:**
- Zustand for lightweight global state management
- TanStack Query (React Query) for server state management, caching, and optimistic updates
- Local component state for form handling and UI interactions

**Routing:**
- Custom lightweight router implementation (`wouter`) for client-side navigation
- Route-based code organization with dedicated pages for each entity type

**Design Decisions:**
- Component-based architecture with reusable UI primitives in `/components/ui`
- Feature-specific components in domain folders (`/components/business`, `/components/navigation`)
- Type-safe API layer with centralized axios instances
- Responsive mobile-first design with collapsible sidebar navigation

### Backend Architecture

**Technology Stack:**
- Node.js with Express for RESTful API server
- TypeScript with ES modules for type safety and modern JavaScript features
- Drizzle ORM for type-safe database queries and migrations
- PostgreSQL (Neon recommended) for relational data storage with pgvector support

**API Design:**
- RESTful endpoints organized by resource type (`/api/companies`, `/api/business-units`, `/api/processes`, `/api/pain-points`, `/api/use-cases`)
- CRUD operations with proper HTTP methods (GET, POST, PUT, DELETE)
- Request validation and error handling middleware
- CORS configuration for cross-origin requests from frontend

**Database Schema:**
- Hierarchical data model: Companies → Business Units → Processes → Pain Points/Use Cases
- UUID primary keys for all entities
- Cascading deletes for maintaining referential integrity
- Timestamp tracking (createdAt, updatedAt) for audit trails
- Many-to-many relationships managed through junction tables (process_pain_points, process_use_cases)

**Service Layer:**
- LLM classifier service for automated categorization of use cases by industry, solution pattern, and automation level
- Opportunity scoring service for calculating ROI and business value metrics
- Separation of business logic from route handlers

**Key Architectural Decisions:**

*Problem:* Need for flexible database schema evolution
*Solution:* Drizzle ORM with migration support
*Rationale:* Provides type-safe queries while maintaining migration history; supports PostgreSQL-specific features like vector extensions

*Problem:* Managing complex entity relationships
*Solution:* Normalized relational schema with cascade delete policies
*Rationale:* Ensures data integrity; simplifies deletion of parent entities; supports complex filtering and joins

*Problem:* Frontend-backend type consistency
*Solution:* Shared TypeScript types and centralized API client
*Rationale:* Reduces type mismatches; provides autocomplete; catches errors at compile time

### External Dependencies

**Database:**
- Neon PostgreSQL (or compatible PostgreSQL provider)
- Requires `vector` extension for pgvector support (used for potential embedding-based features)
- Connection via DATABASE_URL environment variable with SSL support

**Third-Party APIs:**
- OpenAI-compatible LLM endpoint for use case classification
- Configured via LLM_CLASSIFIER_MODEL environment variable
- Defaults to gpt-4o-mini model

**NPM Packages:**

*Frontend:*
- `@tanstack/react-query` - Server state management
- `axios` - HTTP client
- `zustand` - Global state management
- `lucide-react` - Icon library
- `class-variance-authority` & `clsx` & `tailwind-merge` - Dynamic styling utilities
- `@radix-ui/react-label` - Accessible form primitives

*Backend:*
- `drizzle-orm` & `drizzle-kit` - Database ORM and migrations
- `pg` & `pgvector` - PostgreSQL driver and vector extension support
- `express` & `cors` - Web server and cross-origin support
- `dotenv` - Environment variable management
- `tsx` - TypeScript execution for development

**Environment Configuration:**
- `DATABASE_URL` - PostgreSQL connection string (required)
- `CLIENT_ORIGIN` - Allowed CORS origins (defaults to localhost:5000)
- `PORT` - Backend server port (defaults to 3000)
- `VITE_API_URL` - Frontend API base URL (defaults to empty string for relative URLs; Vite proxy forwards /api requests to backend)
- `LLM_CLASSIFIER_MODEL` - Model identifier for classification service

**Development Tools:**
- Vite dev server with hot module replacement
- TypeScript compiler for type checking
- tsx for running TypeScript in development