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
- Zustand for global state
- TanStack Query (React Query) for server state, caching, and optimistic updates

**Routing:**
- Custom lightweight `wouter` implementation for client-side navigation

**Design Decisions:**
- Component-based architecture with reusable UI primitives
- Feature-specific component organization
- Type-safe API layer with centralized axios instances
- Responsive mobile-first design with collapsible sidebar navigation
- Dashboard with Analytics and Opportunities views, including a prioritization matrix visualization.
- Tab-based interface for different views, with localStorage persistence for selections.
- Modal-based forms for cleaner interaction and consistent UX across screen sizes.

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
- Hierarchical data model: Companies → Business Units → Processes → Pain Points/Use Cases
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