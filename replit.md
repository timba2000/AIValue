# AIValue Use Case Tracker

## Overview

AIValue Use Case Tracker is a full-stack TypeScript application designed to manage business process intelligence and automation opportunities. Its primary purpose is to help organizations identify, track, and prioritize AI and automation initiatives by managing companies, business units, processes, pain points, and use cases. The system provides tools for capturing process metrics, identifying inefficiencies, and evaluating potential solutions, thereby streamlining the path to automation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18, Vite, TypeScript
- Tailwind CSS with a custom design system and shadcn/ui-inspired primitives

**State Management:**
- Zustand for global state (including theme persistence)
- TanStack Query (React Query) for server state, caching, and optimistic updates

**Routing:**
- Custom lightweight `wouter` implementation for client-side navigation

**Design Decisions:**
- Component-based architecture with reusable UI primitives
- Feature-specific component organization
- Type-safe API layer with centralized axios instances
- Responsive mobile-first design with collapsible sidebar navigation
- Consolidated Dashboard with single scrollable layout (MetricsCards, PrioritizationMatrix, PainPointsOverviewTable)
- Modal-based forms for cleaner interaction and consistent UX across screen sizes.
- Global filter context using Zustand with localStorage persistence for cross-page filter synchronization.
- Link management modal with inline edit/delete controls for existing linked solutions.

**Theming System:**
- Light/Dark/System mode support with CSS variables
- Theme state managed via Zustand (`themeStore.ts`) with localStorage persistence
- CSS custom properties defined in `index.css` for both light and dark modes
- Modern contemporary design with:
  - Gradient backgrounds for primary elements (purple to indigo)
  - Glassmorphism effects with backdrop-blur
  - Smooth transitions and micro-animations
  - Rounded corners (border-radius: 2xl for cards, xl for buttons)
  - Shadow depth with color tints
- Theme toggle in sidebar with sun/moon/monitor icons

**Linking System:**
- Pain points can be linked to use cases with percentage solved and notes
- 100% allocation cap: validates that total percentage solved across all linked solutions cannot exceed 100% per pain point
- Link management available from Pain Points page, Use Cases page, and Dashboard
- Visual indicators show linked/not linked status with color-coded badges
- Impact calculations use percentageSolved from links (set when linking) to calculate potential hours saved
- Use Cases table shows average % solved across all linked pain points

### Backend Architecture

**Technology Stack:**
- Node.js with Express for RESTful API
- TypeScript with ES modules
- Drizzle ORM for type-safe database queries and schema management
- PostgreSQL (Neon recommended) for data storage, with pgvector support

**API Design:**
- RESTful endpoints organized by resource type (e.g., `/api/companies`, `/api/pain-points`)
- CRUD operations with standard HTTP methods
- Request validation and error handling middleware
- CORS configuration

**Database Schema:**
- Hierarchical data model: Companies → Business Units (3-level hierarchy) → Processes → Pain Points/Use Cases
- Business units support parent/child relationships with maximum 3 levels of nesting
- UUID primary keys, cascading deletes, and timestamp tracking
- Many-to-many relationships via junction tables
- Flexible schema evolution via Drizzle ORM with automatic schema syncing for deployments.

**Service Layer:**
- LLM classifier service for automated categorization
- Opportunity scoring service for ROI and business value metrics
- Separation of business logic from route handlers

**Key Architectural Decisions:**
- **Flexible Database Schema Evolution:** Drizzle ORM with migration support for type-safe queries and PostgreSQL-specific features.
- **Complex Entity Relationship Management:** Normalized relational schema with cascade delete policies for data integrity and simplified deletions.
- **Frontend-Backend Type Consistency:** Shared TypeScript types and a centralized API client to reduce type mismatches and catch errors at compile time.

## External Dependencies

**Database:**
- Neon PostgreSQL (or compatible PostgreSQL)
- Requires `vector` extension for pgvector support
- Configured via `DATABASE_URL` environment variable

**Third-Party APIs:**
- OpenAI-compatible LLM endpoint for use case classification (e.g., `gpt-4o-mini`)
- Configured via `LLM_CLASSIFIER_MODEL` environment variable

**NPM Packages:**
- **Frontend:** `@tanstack/react-query`, `axios`, `zustand`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-label`
- **Backend:** `drizzle-orm`, `drizzle-kit`, `pg`, `pgvector`, `express`, `cors`, `dotenv`, `tsx`

**Environment Configuration:**
- `DATABASE_URL`
- `CLIENT_ORIGIN`
- `PORT`
- `VITE_API_URL`
- `LLM_CLASSIFIER_MODEL`

## Recent Changes

- Added comprehensive light/dark mode theming system with system preference detection
- Implemented modern contemporary UI design with gradient effects and glassmorphism
- Updated all components to use CSS variable-based theming
- Added theme toggle in sidebar with light/dark/system mode options
- Enhanced animations and transitions throughout the application
- Updated PrioritizationMatrix canvas to render appropriately in both themes
- **Hierarchical Business Units (Dec 2025):**
  - Added 3-level hierarchy support for business units within companies (e.g., Division → Department → Team)
  - Business units can now have parent/child relationships with parentId field
  - API validation ensures: same company, max 3 levels deep, no circular references
  - FTE validation: children's FTE cannot exceed parent's FTE capacity
    - When creating a child: validates total children FTE + new FTE <= parent FTE
    - When updating FTE: cannot reduce below sum of children's FTE
    - When changing parent: validates new parent has sufficient FTE capacity
  - Cannot delete a business unit that has children (must reassign or delete children first)
  - Businesses page displays units as collapsible tree with level indicators
  - Filter dropdowns show hierarchical indentation for visual clarity
  - Dashboard metrics aggregate data from all descendant units when parent is selected
  - Pain Points and Processes pages also aggregate descendant data in filters
- **Code Quality Improvements (Nov 2025):**
  - Created shared API hooks (`useApiData.ts`) for companies, business units, and processes
  - Refactored PainPointList, ProcessList, and BusinessesPage to use React Query consistently
  - Removed all console.error statements from production code
  - Added proper error handling with user-visible error messages
  - Enhanced theme transitions with 200ms animations and reduced-motion support
  - Combined "Linked Pain Points & Solutions" table and "Pain Points Overview" cards into a unified PainPointsOverviewTable component showing all metrics in one place
