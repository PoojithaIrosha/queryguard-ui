import { useMemo, useState, type CSSProperties } from "react";
import { type QueryExecution, type RequestTrace } from "../types/trace";

const SLOW_THRESHOLD_MS = 5;
const TICK_COUNT = 6;
const MIN_BAR_WIDTH_PERCENT = 0.45;

const tagStyles: Record<string, string> = {
  SLOW: "border-red-200 bg-red-50 text-red-700",
  "N+1": "border-amber-200 bg-amber-50 text-amber-700",
  DUP: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
};

function formatMs(value: number, digits = 2) {
  return `${value.toFixed(digits)}ms`;
}

function nsToMs(value: number) {
  return value / 1_000_000;
}

function buildSqlCounts(queries: QueryExecution[]) {
  return queries.reduce<Record<string, number>>((counts, query) => {
    counts[query.sql] = (counts[query.sql] ?? 0) + 1;
    return counts;
  }, {});
}

function getQueryTags(
  query: QueryExecution,
  sqlCounts: Record<string, number>,
  nplusOneDetected: boolean
) {
  const tags: string[] = [];

  if ((sqlCounts[query.sql] ?? 0) > 1) {
    tags.push("DUP");
  }

  if (nplusOneDetected && query.sql.includes("?")) {
    tags.push("N+1");
  }

  if (query.executionTimeMs > SLOW_THRESHOLD_MS) {
    tags.push("SLOW");
  }

  return tags;
}

function Tag({ label }: { label: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
        tagStyles[label] ?? "border-gray-200 bg-gray-50 text-gray-600"
      } border`}
    >
      {label}
    </span>
  );
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

function getBarStyle(left: number, width: number): CSSProperties {
  return {
    left: `${left}%`,
    width: `${Math.max(width, MIN_BAR_WIDTH_PERCENT)}%`,
  };
}

export default function Timeline({ trace }: { trace: RequestTrace }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const timeline = useMemo(() => {
    if (trace.queries.length === 0) {
      return null;
    }

    const baseStart = Math.min(...trace.queries.map((q) => q.startTimeNs));
    const baseEnd = Math.max(...trace.queries.map((q) => q.endTimeNs));
    const totalNs = Math.max(baseEnd - baseStart, 1);
    const sqlCounts = buildSqlCounts(trace.queries);
    const totalDbMs = trace.queries.reduce(
      (sum, query) => sum + query.executionTimeMs,
      0
    );
    const slowCount = trace.queries.filter(
      (query) => query.executionTimeMs > SLOW_THRESHOLD_MS
    ).length;
    const duplicateSqlCount = Object.values(sqlCounts).filter(
      (count) => count > 1
    ).length;
    const duplicateQueryCount = trace.queries.filter(
      (query) => (sqlCounts[query.sql] ?? 0) > 1
    ).length;

    return {
      baseStart,
      totalNs,
      sqlCounts,
      totalDbMs,
      slowCount,
      duplicateSqlCount,
      duplicateQueryCount,
    };
  }, [trace.queries]);

  if (!timeline) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
        No SQL queries were captured for this request.
      </div>
    );
  }

  const selectedQueryIndex = Math.min(selectedIndex, trace.queries.length - 1);
  const selectedQuery = trace.queries[selectedQueryIndex];
  const selectedTags = getQueryTags(
    selectedQuery,
    timeline.sqlCounts,
    trace.nplusOneDetected
  );
  const hasDuplicates = timeline.duplicateSqlCount > 0;
  const timeRangeMs = nsToMs(timeline.totalNs);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-200 bg-white px-4 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">
              {trace.method}
            </span>
            <h2 className="break-all font-mono text-sm font-semibold text-gray-950">
              {trace.endpoint}
            </h2>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>
              trace{" "}
              <span className="font-mono text-gray-700">
                {trace.traceId.slice(0, 12)}...
              </span>
            </span>
            <span>
              request{" "}
              <span className="font-semibold text-gray-800">
                {formatMs(trace.totalExecutionTimeMs, 1)}
              </span>
            </span>
            <span>
              visible window{" "}
              <span className="font-semibold text-gray-800">
                {formatMs(timeRangeMs, 1)}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {trace.nplusOneDetected && (
            <span className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700">
              N+1 detected
            </span>
          )}
          {hasDuplicates && (
            <span className="rounded border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-fuchsia-700">
              duplicates
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-gray-200 bg-gray-50 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Queries" value={trace.queries.length} />
        <Metric
          label={`Slow > ${SLOW_THRESHOLD_MS}ms`}
          value={timeline.slowCount}
          tone={timeline.slowCount > 0 ? "danger" : "good"}
        />
        <Metric
          label="Duplicate SQLs"
          value={timeline.duplicateSqlCount}
          tone={timeline.duplicateSqlCount > 0 ? "warn" : "good"}
        />
        <Metric
          label="DB time"
          value={formatMs(timeline.totalDbMs, 1)}
          tone="info"
        />
        <Metric
          label="Overall"
          value={formatMs(trace.totalExecutionTimeMs, 1)}
        />
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1080px]">
          <div className="flex h-9 border-b border-gray-200 bg-gray-50">
            <div className="sticky left-0 z-20 flex w-80 shrink-0 items-center border-r border-gray-200 bg-gray-50 px-4 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 shadow-[8px_0_14px_rgba(15,23,42,0.06)]">
              Query
            </div>

            <div className="relative flex-1">
              {Array.from({ length: TICK_COUNT + 1 }).map((_, index) => {
                const percent = (index / TICK_COUNT) * 100;
                const tickMs = (timeRangeMs / TICK_COUNT) * index;

                return (
                  <div key={index}>
                    <div
                      className="absolute top-0 h-full w-px bg-gray-200"
                      style={{ left: `${percent}%` }}
                    />
                    <div
                      className="absolute top-2 -translate-x-1/2 font-mono text-[10px] text-gray-500"
                      style={{ left: `${percent}%` }}
                    >
                      {formatMs(tickMs, 1)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {trace.queries.map((query, index) => {
            const startOffsetNs = query.startTimeNs - timeline.baseStart;
            const durationNs = query.endTimeNs - query.startTimeNs;
            const left = (startOffsetNs / timeline.totalNs) * 100;
            const width = (durationNs / timeline.totalNs) * 100;
            const isSelected = index === selectedIndex;
            const tags = getQueryTags(
              query,
              timeline.sqlCounts,
              trace.nplusOneDetected
            );
            const isSlow = query.executionTimeMs > SLOW_THRESHOLD_MS;

            let gapLeft = 0;
            let gapWidth = 0;
            let gapMs = 0;

            if (index > 0) {
              const previous = trace.queries[index - 1];
              const gapNs = query.startTimeNs - previous.endTimeNs;

              if (gapNs > 0) {
                gapLeft =
                  ((previous.endTimeNs - timeline.baseStart) /
                    timeline.totalNs) *
                  100;
                gapWidth = (gapNs / timeline.totalNs) * 100;
                gapMs = nsToMs(gapNs);
              }
            }

            return (
              <button
                key={`${query.startTimeNs}-${index}`}
                type="button"
                onClick={() => setSelectedIndex(index)}
                className={`flex min-h-20 w-full border-b border-gray-100 text-left transition ${
                  isSelected
                    ? "bg-cyan-50/70"
                    : index % 2 === 0
                    ? "bg-white hover:bg-gray-50"
                    : "bg-gray-50/50 hover:bg-gray-50"
                }`}
              >
                <div
                  className={`sticky left-0 z-10 flex w-80 shrink-0 flex-col gap-2 border-r px-4 py-3 shadow-[8px_0_14px_rgba(15,23,42,0.05)] ${
                    isSelected
                      ? "border-r-cyan-200 border-l-2 border-l-cyan-600 bg-cyan-50"
                      : index % 2 === 0
                      ? "border-r-gray-200 border-l-2 border-l-transparent bg-white"
                      : "border-r-gray-200 border-l-2 border-l-transparent bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 font-mono text-[11px] font-bold text-gray-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {tags.map((tag) => (
                        <Tag key={tag} label={tag} />
                      ))}
                    </div>
                  </div>
                  <div className="line-clamp-2 break-all font-mono text-[11px] leading-5 text-gray-700">
                    {query.sql}
                  </div>
                </div>

                <div className="relative min-h-20 flex-1">
                  {Array.from({ length: TICK_COUNT + 1 }).map((_, tick) => (
                    <div
                      key={tick}
                      className="absolute top-0 h-full w-px bg-gray-100"
                      style={{ left: `${(tick / TICK_COUNT) * 100}%` }}
                    />
                  ))}

                  {gapWidth > 0 && (
                    <div
                      className="absolute top-[calc(50%+12px)] h-1 rounded bg-slate-300"
                      style={getBarStyle(gapLeft, gapWidth)}
                      title={`App gap ${formatMs(gapMs, 3)}`}
                    />
                  )}

                  <div
                    className={`absolute top-1/2 h-4 -translate-y-1/2 rounded shadow-sm ${
                      isSlow
                        ? "bg-red-500 shadow-red-100"
                        : "bg-emerald-500 shadow-emerald-100"
                    }`}
                    style={getBarStyle(left, width)}
                    title={`${formatMs(query.executionTimeMs, 3)} - ${query.sql}`}
                  />

                  <div
                    className={`absolute top-[calc(50%-24px)] -translate-x-1/2 whitespace-nowrap font-mono text-[10px] font-bold ${
                      isSlow ? "text-red-700" : "text-emerald-700"
                    }`}
                    style={{ left: `${left + Math.max(width, MIN_BAR_WIDTH_PERCENT) / 2}%` }}
                  >
                    {formatMs(query.executionTimeMs, 2)}
                  </div>

                  {gapMs > 1 && (
                    <div
                      className="absolute top-[calc(50%+19px)] -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-slate-500"
                      style={{ left: `${gapLeft + gapWidth / 2}%` }}
                    >
                      gap {formatMs(gapMs, 1)}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 z-10 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500">
                Query #{selectedQueryIndex + 1} detail
              </span>
              {selectedTags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
            <pre className="m-0 max-h-24 overflow-auto whitespace-pre-wrap break-all font-mono text-xs leading-5 text-gray-800">
              {selectedQuery.sql}
            </pre>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-2 text-xs">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                Execution
              </div>
              <div className="font-mono font-semibold text-gray-950">
                {formatMs(selectedQuery.executionTimeMs, 3)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                Start offset
              </div>
              <div className="font-mono font-semibold text-gray-950">
                {formatMs(nsToMs(selectedQuery.startTimeNs - timeline.baseStart), 3)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                Duration ns
              </div>
              <div className="font-mono font-semibold text-gray-950">
                {selectedQuery.endTimeNs - selectedQuery.startTimeNs}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-500">
                Duplicates
              </div>
              <div className="font-mono font-semibold text-gray-950">
                {timeline.sqlCounts[selectedQuery.sql] ?? 1}x
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-2 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-emerald-500" />
            Fast query
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-red-500" />
            Slow query
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-5 rounded bg-slate-300" />
            App gap
          </span>
          <span className="ml-auto font-mono text-gray-400">
            Duplicate query rows: {timeline.duplicateQueryCount}
          </span>
        </div>
      </div>
    </div>
  );
}
