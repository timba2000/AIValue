# AIValue Use Case Tracker

## Overview

AIValue Use Case Tracker is a full-stack TypeScript application for managing business process intelligence and automation opportunities. The system enables organizations to track companies, business units, processes, pain points, and use cases to identify and prioritize automation initiatives. It provides a structured approach to capturing process metrics, identifying inefficiencies, and evaluating potential AI/automation solutions.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**November 23, 2025:**
- Enhanced Pain Points form with comprehensive updates:
  - Renamed "Magnitude (1-10)" to "Impact of Pain Point (1-10)" with descriptive helper text (1 = Low impact, 10 = High impact)
  - Renamed "Opportunity Potential (1-10)" to "Effort in Solving (1-10)" with helper text (1 = Low effort, 10 = High effort)
  - Converted Impact Type from single-select to multi-select checkboxes (users can now select multiple impact types per pain point)
  - Added "Time Required per unit (Hrs)" field for tracking time spent per occurrence
  - Added "# FTE on painpoint" field for tracking full-time equivalents working on the issue
  - Implemented automatic calculation of "Total Hours per Month" (Frequency × Time per unit) displayed in form and table
- Updated database schema:
  - Changed `impact_type` from text to text array to support multiple selections
  - Renamed `opportunity_potential` column to `effort_solving`
  - Added `time_per_unit`, `total_hours_per_month`, and `fte_count` numeric columns
  - Applied migration to preserve existing data while converting to new schema
- Enhanced pain points table display to show total hours per month and multiple impact type badges

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