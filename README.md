# AIValue Use Case Tracker

This repository contains a full-stack TypeScript starter for tracking product use cases. It includes a React 18 + Vite frontend styled with Tailwind and shadcn/ui primitives, and a Node + Express backend using Drizzle ORM with a Neon PostgreSQL database (including the pgvector extension).

## Project Structure

```
.
├── frontend/        # React 18 + Vite client
├── backend/         # Express + Drizzle API server
└── README.md
```

### Frontend
- React 18 with Vite and TypeScript
- Tailwind CSS with shadcn/ui-inspired components
- Zustand for state management

The development server runs on **http://localhost:5173**.

### Backend
- Node.js + Express with TypeScript
- Drizzle ORM targeting Neon PostgreSQL with pgvector support
- REST API exposing `/usecases` endpoints

The development server runs on **http://localhost:5000**.

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm, npm, or yarn package manager
- PostgreSQL database (Neon recommended) with the `vector` extension enabled

### Backend Setup

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```
2. Copy the example environment file and update it with your credentials:
   ```bash
   cp .env.example .env
   ```
3. Ensure your database has the `vector` extension enabled and run the migration:
   ```bash
   npm run migrate
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

The backend exposes the following routes:
- `POST /usecases` – create a new use case (expects `{ title, problem }`)
- `GET /usecases` – list existing use cases ordered by creation time (descending)

### Frontend Setup

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. (Optional) Configure the backend URL by creating a `.env` file:
   ```bash
   echo "VITE_API_URL=http://localhost:5000" > .env
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

The UI provides a form to add new use cases and a table displaying those returned by the API.

## Drizzle ORM
- `backend/src/db/schema.ts` defines the `use_cases` table with `uuid` IDs, `title`, `problem`, optional `embedding` vector, and `createdAt` columns.
- Migrations live in `backend/drizzle/migrations`. The initial migration both enables the `vector` extension and creates the table.

## Scripts

### Backend
- `npm run dev` – start Express server with automatic reload
- `npm run build` – compile TypeScript to `dist/`
- `npm run start` – run the compiled server
- `npm run migrate` – run Drizzle migrations
- `npm run generate` – generate SQL migrations from the schema

### Frontend
- `npm run dev` – start the Vite dev server
- `npm run build` – type-check and build the React app
- `npm run preview` – preview the production build

## License

This project is provided as a starter template. Adapt it to suit your product needs.
