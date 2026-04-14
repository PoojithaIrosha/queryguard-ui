import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchTraces } from "../api/traceApi";
import { type RequestTrace } from "../types/trace";
import RequestTable from "../components/RequestTable";

const AUTO_REFRESH_OPTIONS = [
  { label: "Manual", value: 0 },
  { label: "Every 5s", value: 5_000 },
  { label: "Every 10s", value: 10_000 },
  { label: "Every 30s", value: 30_000 },
  { label: "Every 60s", value: 60_000 },
];

function formatMs(value: number, digits = 1) {
  return `${value.toFixed(digits)}ms`;
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "warn" | "danger" | "info";
}) {
  const toneClass = {
    neutral: "text-gray-950",
    good: "text-emerald-700",
    warn: "text-amber-700",
    danger: "text-red-700",
    info: "text-cyan-700",
  }[tone];

  return (
    <div className="border-r border-gray-200 px-4 py-3 last:border-r-0">
      <div className={`text-xl font-semibold leading-none ${toneClass}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.12em] text-gray-500">
        {label}
      </div>
    </div>
  );
}

function getDuplicateSqlCount(trace: RequestTrace) {
  const counts = trace.queries.reduce<Record<string, number>>((acc, query) => {
    acc[query.sql] = (acc[query.sql] ?? 0) + 1;
    return acc;
  }, {});

  return Object.values(counts).filter((count) => count > 1).length;
}

export default function Home() {
  const [traces, setTraces] = useState<RequestTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [onlyNPlusOne, setOnlyNPlusOne] = useState(false);
  const [autoRefreshMs, setAutoRefreshMs] = useState(0);

  const loadData = useCallback(() => {
    setLoading(true);
    fetchTraces()
      .then(setTraces)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTraces()
      .then(setTraces)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (autoRefreshMs === 0) return;

    const intervalId = window.setInterval(() => {
      loadData();
    }, autoRefreshMs);

    return () => window.clearInterval(intervalId);
  }, [autoRefreshMs, loadData]);

  const filtered = useMemo(() => {
    const value = search.trim().toLowerCase();

    return traces.filter((trace) => {
      const matchesSearch =
        value.length === 0 ||
        trace.endpoint?.toLowerCase().includes(value) ||
        trace.method?.toLowerCase().includes(value) ||
        trace.traceId?.toLowerCase().includes(value);

      const matchesNPlus = !onlyNPlusOne || trace.nplusOneDetected;

      return matchesSearch && matchesNPlus;
    });
  }, [onlyNPlusOne, search, traces]);

  const summary = useMemo(() => {
    const totalQueries = traces.reduce(
      (sum, trace) => sum + trace.queries.length,
      0
    );
    const totalDuration = traces.reduce(
      (sum, trace) => sum + trace.totalExecutionTimeMs,
      0
    );
    const nplusOneCount = traces.filter((trace) => trace.nplusOneDetected).length;
    const duplicateCount = traces.filter(
      (trace) => getDuplicateSqlCount(trace) > 0
    ).length;

    return {
      totalQueries,
      totalDuration,
      nplusOneCount,
      duplicateCount,
    };
  }, [traces]);

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <div className="border-b border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt=""
              className="h-9 w-9 rounded object-contain"
            />
            <div>
              <div className="text-sm font-semibold text-gray-950">
                QueryGuard
              </div>
              <div className="mt-1 text-xs text-gray-500">
                SQL request traces
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/dashboard"
              className="rounded border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-cyan-700 shadow-sm transition hover:bg-cyan-100"
            >
              Live Dashboard
            </Link>
            <button
              type="button"
              onClick={loadData}
              className="rounded border border-gray-200 bg-gray-950 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white shadow-sm transition hover:bg-gray-800"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="px-5 py-5">
        <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 px-4 py-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-950">
                Request List
              </h1>
              <div className="mt-1 text-xs text-gray-500">
                {filtered.length} of {traces.length} requests
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {summary.nplusOneCount > 0 && (
                <span className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700">
                  {summary.nplusOneCount} N+1
                </span>
              )}
              {summary.duplicateCount > 0 && (
                <span className="rounded border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-fuchsia-700">
                  {summary.duplicateCount} duplicate
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-gray-200 bg-gray-50 sm:grid-cols-4">
            <Metric label="Requests" value={traces.length} />
            <Metric label="Queries" value={summary.totalQueries} tone="info" />
            <Metric
              label="N+1"
              value={summary.nplusOneCount}
              tone={summary.nplusOneCount > 0 ? "warn" : "good"}
            />
            <Metric
              label="Total time"
              value={formatMs(summary.totalDuration, 1)}
              tone="neutral"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <label className="min-w-64 flex-1">
              <span className="sr-only">Search requests</span>
              <input
                type="text"
                placeholder="Search endpoint, method, trace..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-950 outline-none transition placeholder:text-gray-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
              <input
                type="checkbox"
                checked={onlyNPlusOne}
                onChange={(event) => setOnlyNPlusOne(event.target.checked)}
                className="h-3.5 w-3.5 accent-amber-600"
              />
              N+1 only
            </label>

            <label className="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
              Auto refresh
              <select
                value={autoRefreshMs}
                onChange={(event) =>
                  setAutoRefreshMs(Number(event.target.value))
                }
                className="bg-white font-mono text-xs text-gray-950 outline-none"
              >
                {AUTO_REFRESH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={loadData}
              className="rounded border border-gray-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-gray-700 shadow-sm transition hover:bg-gray-50"
            >
              Run Query
            </button>
          </div>
        </div>

        {loading && (
          <div className="mb-3 rounded border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
            Loading requests...
          </div>
        )}

        {!loading && filtered.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-600 shadow-sm">
            No requests found.
          </div>
        ) : (
          <RequestTable traces={filtered} />
        )}
      </main>
    </div>
  );
}
