# Developer Notes

## Key Decisions

- The app is a client-only Vite React application. It does not include server-side rendering, API route handlers, or a backend proxy.
- Backend integration is centralized in `src/api/traceApi.ts`, and the base URL is read from `VITE_QUERYGUARD_API_BASE_URL`.
- Development builds use `http://localhost:8080/`; production builds use `/` so the bundled UI can be served by the Spring Boot app on the same origin.
- Routing is intentionally simple and route-level pages are kept in `src/pages`.
- Shared trace data shapes are defined in `src/types/trace.ts` and imported by pages and components.
- Dashboard charts are rendered with inline SVG instead of a charting dependency. This keeps the dependency tree small, but places chart behavior and scaling logic inside `Dashboard.tsx`.
- Prometheus parsing happens in the browser and only reads the current scrape output from `/actuator/prometheus`.
- The dashboard stores metric samples in local React state. Time ranges beyond the first instant fill only while the dashboard page remains open.
- Slow-query tagging currently uses a fixed frontend threshold of `5ms`.
- Duplicate-query detection compares exact SQL strings.
- N+1 query tagging in the timeline adds an `N+1` tag when `trace.nplusOneDetected` is true and the SQL string contains `?`.

## Trade-Offs

- Vite mode-specific env files keep development and production backend URLs separate, but the value is compiled into the static build and must be set before building.
- Inline SVG charts avoid a third-party charting library, but increase the size and responsibility of `Dashboard.tsx`.
- Client-side polling is simple and transparent, but each open dashboard tab independently polls both traces and Prometheus metrics every 5 seconds.
- Exact SQL string matching is predictable, but it may miss semantically duplicate queries that differ by whitespace, formatting, aliases, or literal values.
- The UI assumes the backend returns complete trace payloads with query timing fields. There is no runtime schema validation.

## Known Limitations

- No automated tests are present in the repository.
- Dashboard history is not persisted across reloads.
- Client-side routing requires hosting fallback configuration for direct visits to `/dashboard` or `/trace/:traceId`.

## Performance Considerations

- Request filtering, summary calculation, sorting, and dashboard endpoint aggregation use `useMemo` where the current code performs derived calculations from trace arrays.
- The request table paginates visible rows to reduce DOM size for larger trace lists.
- The trace timeline uses a horizontally scrollable layout with fixed-width query labels, which is better suited for desktop debugging than small mobile screens.
- Dashboard polling runs every 5 seconds and calls both the Prometheus endpoint and trace endpoint.
- Very large traces with many SQL statements may produce a large number of timeline rows and inline elements.

## Future Improvements

- Add deployment automation that copies `dist/` into the Spring Boot resources directory.
- Add request-level error states and retry controls for the home and trace detail screens.
- Check `res.ok` consistently across all API functions.
- Add unit tests for Prometheus parsing, trace summary calculations, duplicate SQL detection, and rate calculations.
- Add component or integration tests for routing, table sorting, pagination, and trace detail rendering.
- Extract dashboard parsing and chart helpers from `Dashboard.tsx` into reusable modules.
- Normalize SQL before duplicate detection to improve grouping accuracy.
- Make thresholds such as slow-query duration configurable.
- Persist dashboard samples or integrate with a historical metrics API when longer time windows are required.
