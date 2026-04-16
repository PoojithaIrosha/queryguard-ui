# QueryGuard UI

QueryGuard UI is a React frontend for inspecting SQL request traces collected by a QueryGuard backend. It helps developers and performance-focused teams identify request-level query behavior, N+1 patterns, duplicate SQL execution, slow queries, and live QueryGuard metrics exposed through Spring Actuator Prometheus output.

The app is intended for local or internal observability workflows where engineers need a browser-based view of request traces and database query timing.

## Tech Stack

- React 19
- TypeScript 6
- Vite 8
- React Router 7
- Tailwind CSS 3
- PostCSS and Autoprefixer
- ESLint 9 with TypeScript, React Hooks, and React Refresh rules
- Native `fetch` API for backend communication

## Features

- Request trace list with search, sorting, pagination, and manual refresh.
- Optional auto-refresh intervals for the request list.
- N+1-only filtering for focused investigation.
- Summary metrics for request count, SQL query count, total duration, duplicate SQLs, and N+1 detections.
- Trace detail view with per-query timing, SQL text, duplicate query tags, slow query tags, and N+1 indicators.
- Timeline visualization of query execution offsets, query durations, and application gaps.
- Live dashboard polling Prometheus metrics every 5 seconds.
- Rolling dashboard views for request rate, N+1 rate, critical issue rate, top affected endpoints, and detected `queryguard_*` metrics.

## Project Structure

```text
.
├── .env.development
├── .env.example
├── .env.production
├── public/
│   ├── favicon.png
│   ├── favicon.svg
│   ├── icons.svg
│   └── logo.png
├── src/
│   ├── api/
│   │   └── traceApi.ts
│   ├── components/
│   │   ├── RequestCard.tsx
│   │   ├── RequestTable.tsx
│   │   └── Timeline.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Home.tsx
│   │   └── TraceDetail.tsx
│   ├── types/
│   │   └── trace.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── docs/
│   └── DEVELOPER_NOTES.md
├── index.html
├── tailwind.config.js
├── vite.config.ts
└── package.json
```

### Architecture

- `src/App.tsx` defines the route map:
  - `/` renders the request list.
  - `/index.html` redirects to `/`.
  - `/dashboard` renders live metric charts.
  - `/trace/:traceId` renders a single trace timeline.
- `src/api/traceApi.ts` centralizes backend calls.
- `vite.config.ts` reads `VITE_QUERYGUARD_UI_BASE_PATH` and uses it as the Vite `base` path for generated asset URLs.
- `src/types/trace.ts` defines the trace and query data contracts consumed across the UI.
- `src/pages` contains route-level screens.
- `src/components` contains reusable presentation and interaction components for tables, trace cards, and timelines.
- Styling is implemented with Tailwind utility classes and a small Tailwind theme extension.

## Getting Started

### Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`
- npm

The Node version requirement comes from the installed Vite package. No `.nvmrc`, `.node-version`, or package manager override is present in the repository.

### Installation

```bash
npm install
```

### Running the App

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

With the current production base path, the previewed app is served under:

```text
http://localhost:4173/queryguard-ui/
```

Run lint checks:

```bash
npm run lint
```

## Environment Variables

The application uses Vite environment variables for backend URL and frontend base-path configuration.

| Variable | Required | Development | Production | Description |
| --- | --- | --- | --- | --- |
| `VITE_QUERYGUARD_API_BASE_URL` | Yes | `http://localhost:8080/` | `/` | Base URL used by the frontend API client. |
| `VITE_QUERYGUARD_UI_BASE_PATH` | Yes | `/` | `/queryguard-ui/` | Base path used for built assets and React Router. |

Vite loads the correct file by mode:

- `.env.development` is used by `npm run dev`.
- `.env.production` is used by `npm run build`.

Current environment files:

```bash
# .env.development
VITE_QUERYGUARD_API_BASE_URL=http://localhost:8080/
VITE_QUERYGUARD_UI_BASE_PATH=/
```

```bash
# .env.production
VITE_QUERYGUARD_API_BASE_URL=/
VITE_QUERYGUARD_UI_BASE_PATH=/queryguard-ui/
```

The production API value is `/` because production builds are intended to use the same origin as the Spring Boot backend. The production UI base path is `/queryguard-ui/` because the built frontend is served from `resources/static/queryguard-ui/`.

## API Integration

The frontend API client reads `VITE_QUERYGUARD_API_BASE_URL` in `src/api/traceApi.ts`.

In development, requests are sent to `http://localhost:8080/`. In production, requests are relative to the current Spring Boot origin.

| Function | Endpoint | Response |
| --- | --- | --- |
| `fetchTraces` | `GET /queryguard/api/requests` | `RequestTrace[]` JSON |
| `fetchTraceById` | `GET /queryguard/api/requests/:id` | `RequestTrace` JSON |
| `fetchPrometheusMetrics` | `GET /actuator/prometheus` | Prometheus text format |

The dashboard parses `queryguard_*` Prometheus metrics in the browser and recognizes candidate metric names for request totals, N+1 totals, and critical issue totals.

No authentication, authorization headers, token storage, or session handling are implemented in the current frontend code.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Starts the Vite development server. |
| `npm run build` | Runs TypeScript project build checks with `tsc -b`, then creates a Vite production build. |
| `npm run lint` | Runs ESLint against the repository. |
| `npm run preview` | Serves the production build locally with Vite preview. |

## UI/UX Notes

- The UI uses Tailwind utility classes directly in React components.
- The request list is table-like, sortable, paginated, and optimized for dense trace inspection.
- The trace timeline uses horizontal scrolling with a sticky query column and sticky detail footer for large SQL traces.
- Dashboard charts are implemented with inline SVG and local browser state; no charting library is used.
- The dashboard keeps only client-side samples from the current browser session. Historical ranges fill as the page stays open.
- `RequestCard.tsx` exists as a reusable card-style trace component, but the current home page uses `RequestTable.tsx`.

## Deployment

Create a production build:

```bash
npm run build
```

The compiled static assets are emitted to `dist/`.

Deploy the `dist/` directory to a static hosting location that matches `VITE_QUERYGUARD_UI_BASE_PATH`.

For the intended Spring Boot deployment, copy the production build output into:

```text
src/main/resources/static/queryguard-ui/
```

Do not copy the production build files directly into `src/main/resources/static/` unless `VITE_QUERYGUARD_UI_BASE_PATH` is changed back to `/`.

The resulting structure should look like:

```text
src/main/resources/static/queryguard-ui/
├── index.html
├── favicon.png
├── logo.png
└── assets/
    ├── index-*.css
    └── index-*.js
```

The app should be available at:

```text
http://localhost:8080/queryguard-ui/
```

If directly opening `/queryguard-ui/index.html`, the app redirects internally to `/queryguard-ui/`.

For nested routes such as `/queryguard-ui/dashboard` and `/queryguard-ui/trace/:traceId`, Spring Boot must forward those routes to `/queryguard-ui/index.html`.

## Contributing

1. Install dependencies with `npm install`.
2. Keep changes scoped to the relevant page, component, or API module.
3. Run `npm run lint` before opening a pull request.
4. Run `npm run build` when changing TypeScript types, routing, data parsing, or production-facing behavior.
5. Update this README and `docs/DEVELOPER_NOTES.md` when setup steps, backend contracts, or architecture decisions change.

## License

This project is licensed under the Apache License 2.0. See `LICENSE` for details.

## Additional Documentation

- [Developer Notes](docs/DEVELOPER_NOTES.md)
