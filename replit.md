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
- `SESSION_SECRET` - Secret key for session encryption (required for authentication)
- `ADMIN_USER_IDS` - Comma-separated list of Replit user IDs that have admin access

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
- **Code Quality Improvements (Dec 2025):**
  - Created shared API hooks (`useApiData.ts`) for companies, business units, and processes
  - Refactored PainPointList, ProcessList, and BusinessesPage to use React Query consistently
  - Removed all console.error statements from production code
  - Added proper error handling with user-visible error messages
  - Enhanced theme transitions with 200ms animations and reduced-motion support
  - Combined "Linked Pain Points & Solutions" table and "Pain Points Overview" cards into a unified PainPointsOverviewTable component showing all metrics in one place
- **Shared Utilities & Bug Fixes (Dec 2025):**
  - Created `frontend/src/utils/hierarchy.ts` with shared `getDescendantIds` function for business unit hierarchy traversal
  - Fixed critical bug where hierarchy filtering failed for middle-level nodes (was only working for root and leaf units)
  - Refactored OpportunitiesDashboard and PainPointList to use the shared hierarchy utility
  - Created `backend/src/utils/parsing.ts` with shared `parseOptionalNumber` and `parseOptionalNumberOrUndefined` functions
  - Refactored useCases.ts and processes.ts routes to use shared parsing utilities
  - Cleaned up dead code: removed unused BusinessList.tsx and pg.d.ts
  - All form elements properly use CSS variables for light/dark mode theming (border-border, bg-background, text-foreground)
- **Secure Admin Section with Replit Auth (Dec 2025):**
  - Integrated Replit Auth for secure admin access using OpenID Connect (login via Google, GitHub, Apple, or email/password)
  - Created users and sessions database tables for authentication persistence
  - Session-based authentication with PostgreSQL session store and secure httpOnly cookies
  - Admin authorization via ADMIN_USER_IDS environment variable (comma-separated list of Replit user IDs)
  - Protected admin API endpoints (/api/admin/stats, /api/admin/users) return 401 for unauthenticated and 403 for non-admin users
  - AdminPage with system overview showing counts of companies, business units, processes, pain points, solutions, and users
  - Frontend auth state management via useAuth hook with automatic redirect to login for protected pages
  - Sidebar Admin link with Shield icon and "Active" badge for authenticated admins
  - Session refresh tokens for extended login sessions
- **Admin Pain Point Excel Export (Dec 2025):**
  - Added GET /api/admin/pain-points/export endpoint to download all pain points as Excel file
  - Export includes all pain point fields matching the import template format
  - Supports many-to-many process relationships (comma-separated process names)
  - Includes taxonomy L1/L2/L3 category names from related taxonomy categories
  - Download button added to Admin Pain Point Upload page for easy backup/template access
- **Admin Taxonomy Upload/Download (Dec 2025):**
  - Added GET /api/admin/taxonomy/export endpoint to download taxonomy as Excel (Level 1, Level 2, Level 3 columns)
  - Added POST /api/admin/taxonomy/preview and /import endpoints for bulk taxonomy import
  - Import creates L1→L2→L3 hierarchy, skips duplicates based on name matching
  - Taxonomy Management section added to Admin Pain Point Upload page with upload/download UI
  - Preview table shows new vs existing entries before import
- **Missing Taxonomy Category Detection & Addition (Dec 2025):**
  - Pain point upload preview now detects missing L2/L3 taxonomy categories from Excel files
  - Missing categories shown with orange warning banner in preview UI
  - "Add All Missing" button to bulk-add all missing categories at once
  - Individual add buttons for each missing category
  - POST /api/admin/pain-points/add-taxonomy endpoint creates categories with proper parent hierarchy validation
  - Feedback shows count of added categories and any errors
  - Preview auto-refreshes after adding categories to re-validate import
- **Admin User Management (Dec 2025):**
  - Added user management table to Admin page showing all registered users
  - Displays email, name, join date, and admin status for each user
  - Toggle button to grant/revoke admin access via PATCH /api/admin/users/:id endpoint
  - Safety check prevents admins from revoking their own admin status
  - Proper error handling with user-visible error messages and retry functionality
  - Loading states for both user list fetching and individual toggle operations
- **Mandatory Authentication (Dec 2025):**
  - All pages now require login - unauthenticated users are redirected to /login
  - Created ProtectedRoute component that wraps all protected routes in App.tsx
  - Added isAuthenticated middleware to all backend API routes (companies, business-units, processes, pain-points, use-cases, taxonomy)
  - Only /login, /api/auth/* endpoints, and /health remain publicly accessible
  - Backend returns 401 Unauthorized for all protected API requests without valid session
- **Manual Taxonomy Management (Dec 2025):**
  - "Manage Taxonomy Categories" section in Admin → Taxonomy Management tab
  - L1/L2/L3 cascading dropdown selects to browse existing taxonomy hierarchy
  - Badge displays showing existing L2 categories under selected L1, and L3 categories under selected L2
  - Form to add new L2 sub-category under any selected L1 category
  - Form to add new L3 description under any selected L1+L2 combination
  - L1 selection is required (indicated by red asterisk and helper text) - all new L2/L3 must be linked to L1
  - Success/error feedback banners for add operations
  - Automatic refresh of taxonomy data after adding new categories
  - Uses existing POST /api/admin/pain-points/add-taxonomy endpoint for category creation
- **Admin Process Bulk Upload (Dec 2025):**
  - New admin page at /admin/processes-upload for bulk importing processes via Excel
  - Select company and business unit before uploading to specify where processes are created
  - Excel format supports L1, L2, L3 process hierarchy columns that auto-combine into process name
  - Preview data validation before import with duplicate detection
  - Backend endpoints: GET /api/admin/processes/template, /export, POST /preview, /import
  - Export existing processes as Excel with hierarchy breakdown
  - "Manage Processes" button in Admin Quick Actions now navigates to the upload page
- **Direct Business Unit Linking for Pain Points (Dec 2025):**
  - Pain points can now be linked directly to a business unit (in addition to process-based linking)
  - Added business_unit_id column to pain_points table
  - GET /api/pain-points uses OR semantics: returns pain points linked via processes OR directly via businessUnitId
  - POST/PUT endpoints accept and store businessUnitId
  - Excel import matches business unit names and stores the ID
  - Excel export includes business unit information
  - Frontend PainPointForm includes business unit dropdown selector
  - PainPointList displays business unit column with name lookup
  - Filtering by company or business unit includes both process-linked and directly-linked pain points
