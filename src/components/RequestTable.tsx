import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type RequestTrace } from "../types/trace";

type SortKey = "endpoint" | "startTime" | "queryCount" | "duration" | "issues";
type SortOrder = "asc" | "desc";

const SLOW_THRESHOLD_MS = 5;
const PAGE_SIZES = [10, 25, 50];

function formatMs(value: number, digits = 1) {
  return `${value.toFixed(digits)}ms`;
}

function getDuplicateSqlCount(trace: RequestTrace) {
  const counts = trace.queries.reduce<Record<string, number>>((acc, query) => {
    acc[query.sql] = (acc[query.sql] ?? 0) + 1;
    return acc;
  }, {});

  return Object.values(counts).filter((count) => count > 1).length;
}

function getSlowQueryCount(trace: RequestTrace) {
  return trace.queries.filter(
    (query) => query.executionTimeMs > SLOW_THRESHOLD_MS
  ).length;
}

function getDbTime(trace: RequestTrace) {
  return trace.queries.reduce((sum, query) => sum + query.executionTimeMs, 0);
}

function getSortValue(trace: RequestTrace, key: SortKey): string | number {
  switch (key) {
    case "endpoint":
      return trace.endpoint;
    case "startTime":
      return trace.startTime;
    case "queryCount":
      return trace.queries.length;
    case "duration":
      return trace.totalExecutionTimeMs;
    case "issues":
      return trace.issues.length + (trace.nplusOneDetected ? 10 : 0);
  }
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">
      {method}
    </span>
  );
}

function IssueBadge({ label, tone }: { label: string; tone: "red" | "amber" | "fuchsia" }) {
  const classes = {
    red: "border-red-200 bg-red-50 text-red-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    fuchsia: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
  }[tone];

  return (
    <span
      className={`rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${classes}`}
    >
      {label}
    </span>
  );
}

function SortButton({
  label,
  sortKey,
  activeKey,
  sortOrder,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  sortOrder: SortOrder;
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortKey === activeKey;

  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`text-[10px] font-bold uppercase tracking-[0.14em] transition ${
        isActive ? "text-cyan-700" : "text-gray-500 hover:text-gray-800"
      }`}
    >
      {label}
      {isActive && (
        <span className="ml-1 font-mono">
          {sortOrder === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
  );
}

export default function RequestTable({ traces }: { traces: RequestTrace[] }) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("startTime");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);

  const sorted = useMemo(() => {
    return [...traces].sort((a, b) => {
      const valA = getSortValue(a, sortKey);
      const valB = getSortValue(b, sortKey);

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [sortKey, sortOrder, traces]);

  const totalPages = Math.max(Math.ceil(sorted.length / pageSize), 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, sorted.length);
  const paginated = sorted.slice(pageStart, pageEnd);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      setCurrentPage(1);
      return;
    }

    setSortKey(key);
    setSortOrder("desc");
    setCurrentPage(1);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-[1.7fr_0.9fr_0.7fr_1.2fr_0.9fr_auto] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <SortButton
          label="Request"
          sortKey="endpoint"
          activeKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
        <SortButton
          label="Started"
          sortKey="startTime"
          activeKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
        <SortButton
          label="Queries"
          sortKey="queryCount"
          activeKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
        <SortButton
          label="Duration"
          sortKey="duration"
          activeKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
        <SortButton
          label="Issues"
          sortKey="issues"
          activeKey={sortKey}
          sortOrder={sortOrder}
          onSort={handleSort}
        />
        <div />
      </div>

      <div className="divide-y divide-gray-100">
        {paginated.map((trace) => {
          const slowCount = getSlowQueryCount(trace);
          const duplicateSqlCount = getDuplicateSqlCount(trace);
          const dbTime = getDbTime(trace);
          const durationPercent = Math.min(
            (trace.totalExecutionTimeMs / 1000) * 100,
            100
          );

          return (
            <button
              key={trace.traceId}
              type="button"
              onClick={() => navigate(`/trace/${trace.traceId}`)}
              className="grid w-full grid-cols-[1.7fr_0.9fr_0.7fr_1.2fr_0.9fr_auto] items-center gap-4 px-4 py-4 text-left transition hover:bg-cyan-50/50"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <MethodBadge method={trace.method} />
                  <span className="break-all font-mono text-sm font-semibold text-gray-950">
                    {trace.endpoint}
                  </span>
                </div>
                <div className="mt-2 truncate font-mono text-[11px] text-gray-500">
                  {trace.traceId}
                </div>
              </div>

              <div className="text-xs text-gray-600">
                <div className="font-medium text-gray-900">
                  {new Date(trace.startTime).toLocaleDateString()}
                </div>
                <div className="mt-1 font-mono text-[11px] text-gray-500">
                  {new Date(trace.startTime).toLocaleTimeString()}
                </div>
              </div>

              <div>
                <div className="font-mono text-xl font-semibold leading-none text-gray-950">
                  {trace.queries.length}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-gray-500">
                  SQL
                </div>
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded bg-gray-100">
                    <div
                      className={`h-full rounded ${
                        trace.totalExecutionTimeMs > 300
                          ? "bg-red-500"
                          : "bg-cyan-600"
                      }`}
                      style={{ width: `${durationPercent}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-mono text-xs font-semibold text-gray-950">
                    {formatMs(trace.totalExecutionTimeMs, 1)}
                  </span>
                </div>
                <div className="mt-2 font-mono text-[11px] text-gray-500">
                  DB {formatMs(dbTime, 2)}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {trace.nplusOneDetected && (
                  <IssueBadge label="N+1" tone="amber" />
                )}
                {duplicateSqlCount > 0 && (
                  <IssueBadge label={`${duplicateSqlCount} dup`} tone="fuchsia" />
                )}
                {slowCount > 0 && (
                  <IssueBadge label={`${slowCount} slow`} tone="red" />
                )}
                {!trace.nplusOneDetected && duplicateSqlCount === 0 && slowCount === 0 && (
                  <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                    clear
                  </span>
                )}
              </div>

              <div className="rounded border border-gray-200 bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-700 shadow-sm">
                Inspect
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3">
        <div className="text-xs text-gray-500">
          Showing{" "}
          <span className="font-mono font-semibold text-gray-900">
            {sorted.length === 0 ? 0 : pageStart + 1}-{pageEnd}
          </span>{" "}
          of{" "}
          <span className="font-mono font-semibold text-gray-900">
            {sorted.length}
          </span>{" "}
          requests
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            Rows
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage === 1}
              className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              First
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(safeCurrentPage - 1, 1))}
              disabled={safeCurrentPage === 1}
              className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 font-mono text-xs font-semibold text-gray-700">
              {safeCurrentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentPage(Math.min(safeCurrentPage + 1, totalPages))
              }
              disabled={safeCurrentPage === totalPages}
              className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage === totalPages}
              className="rounded border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
