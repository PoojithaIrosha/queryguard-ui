import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fetchPrometheusMetrics, fetchTraces } from "../api/traceApi";
import { type RequestTrace } from "../types/trace";

const POLL_MS = 5_000;
const TIME_RANGE_OPTIONS = [
  { label: "5m", value: 5 * 60 * 1000 },
  { label: "15m", value: 15 * 60 * 1000 },
  { label: "30m", value: 30 * 60 * 1000 },
  { label: "1h", value: 60 * 60 * 1000 },
  { label: "6h", value: 6 * 60 * 60 * 1000 },
];
const DEFAULT_TIME_RANGE_MS = TIME_RANGE_OPTIONS[0].value;
const MAX_HISTORY_MS = TIME_RANGE_OPTIONS.at(-1)?.value ?? DEFAULT_TIME_RANGE_MS;

type MetricTotals = {
  requestsTotal: number;
  nplusOneTotal: number;
  criticalTotal: number;
  metricNames: {
    requests?: string;
    nplusOne?: string;
    critical?: string;
  };
  queryguardMetrics: Record<string, number>;
};

type MetricPoint = MetricTotals & {
  timestamp: number;
  requestRate: number;
  nplusOneRate: number;
  criticalRate: number;
  nplusOneRatePercent: number;
  criticalRatePercent: number;
};

type Series = {
  label: string;
  color: string;
  values: number[];
};

const METRIC_CANDIDATES = {
  requests: [
    "queryguard_requests_total",
    "queryguard_request_total",
    "queryguard_requests",
    "queryguard_request_count",
  ],
  nplusOne: [
    "queryguard_nplusone_total",
    "queryguard_n_plus_one_total",
    "queryguard_nplusone_queries_total",
    "queryguard_nplusone_requests_total",
    "queryguard_nplusone",
  ],
  critical: [
    "queryguard_critical_total",
    "queryguard_critical_issues_total",
    "queryguard_criticals_total",
    "queryguard_critical",
  ],
};

function formatNumber(value: number, digits = 0) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatPercent(value: number) {
  return `${formatNumber(value, 1)}%`;
}

function formatAxisValue(value: number) {
  if (value >= 100) return formatNumber(value, 0);
  if (value >= 10) return formatNumber(value, 1);
  if (value >= 1) return formatNumber(value, 2);
  return formatNumber(value, 3);
}

function formatTimeLabel(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function parsePrometheusMetrics(text: string): MetricTotals {
  const totals: MetricTotals = {
    requestsTotal: 0,
    nplusOneTotal: 0,
    criticalTotal: 0,
    metricNames: {},
    queryguardMetrics: {},
  };

  text.split("\n").forEach((line) => {
    if (line.startsWith("#")) return;

    const match = line.match(
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{[^}]*\})?\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/
    );
    if (!match) return;

    const [, metricName, rawValue] = match;
    const value = Number(rawValue);

    if (!Number.isFinite(value)) return;

    if (metricName.startsWith("queryguard_") && !metricName.endsWith("_created")) {
      totals.queryguardMetrics[metricName] =
        (totals.queryguardMetrics[metricName] ?? 0) + value;
    }
  });

  const requestsMetric = pickMetric(totals.queryguardMetrics, METRIC_CANDIDATES.requests);
  const nplusOneMetric = pickMetric(totals.queryguardMetrics, METRIC_CANDIDATES.nplusOne);
  const criticalMetric = pickMetric(totals.queryguardMetrics, METRIC_CANDIDATES.critical);

  totals.requestsTotal = requestsMetric.value;
  totals.nplusOneTotal = nplusOneMetric.value;
  totals.criticalTotal = criticalMetric.value;
  totals.metricNames = {
    requests: requestsMetric.name,
    nplusOne: nplusOneMetric.name,
    critical: criticalMetric.name,
  };

  return totals;
}

function pickMetric(metrics: Record<string, number>, candidates: string[]) {
  const exactName = candidates.find((candidate) => metrics[candidate] !== undefined);

  if (exactName) {
    return { name: exactName, value: metrics[exactName] };
  }

  return { name: undefined, value: 0 };
}

function calculateRate(current: number, previous: number | undefined, seconds: number) {
  if (previous === undefined || seconds <= 0) return 0;
  return Math.max(current - previous, 0) / seconds;
}

function calculateRatePercent(partRate: number, totalRate: number) {
  if (totalRate <= 0) return 0;
  return (partRate / totalRate) * 100;
}

function createMetricPoint(totals: MetricTotals, previous?: MetricPoint): MetricPoint {
  const timestamp = Date.now();
  const seconds = previous ? (timestamp - previous.timestamp) / 1000 : 0;
  const requestRate = calculateRate(
    totals.requestsTotal,
    previous?.requestsTotal,
    seconds
  );
  const nplusOneRate = calculateRate(
    totals.nplusOneTotal,
    previous?.nplusOneTotal,
    seconds
  );
  const criticalRate = calculateRate(
    totals.criticalTotal,
    previous?.criticalTotal,
    seconds
  );

  return {
    ...totals,
    timestamp,
    requestRate,
    nplusOneRate,
    criticalRate,
    nplusOneRatePercent: calculateRatePercent(nplusOneRate, requestRate),
    criticalRatePercent: calculateRatePercent(criticalRate, requestRate),
  };
}

function prunePoints(points: MetricPoint[], rangeMs: number) {
  const latest = points.at(-1);

  if (!latest) return points;
  return points.filter((point) => latest.timestamp - point.timestamp <= rangeMs);
}

function getVisiblePoints(points: MetricPoint[], rangeMs: number) {
  return prunePoints(points, rangeMs);
}

function getCounterDelta(
  points: MetricPoint[],
  metric: keyof Pick<
    MetricPoint,
    "requestsTotal" | "nplusOneTotal" | "criticalTotal"
  >
) {
  const first = points[0];
  const latest = points.at(-1);

  if (!first || !latest) return 0;
  return Math.max(latest[metric] - first[metric], 0);
}

function getWindowRatePercent(
  points: MetricPoint[],
  partMetric: keyof Pick<MetricPoint, "nplusOneTotal" | "criticalTotal">,
  totalMetric: keyof Pick<MetricPoint, "requestsTotal">
) {
  const first = points[0];

  if (!first) return [];

  return points.map((point) => {
    const partDelta = Math.max(point[partMetric] - first[partMetric], 0);
    const totalDelta = Math.max(point[totalMetric] - first[totalMetric], 0);
    return totalDelta > 0 ? (partDelta / totalDelta) * 100 : 0;
  });
}

function getNplusOneEndpointCounts(traces: RequestTrace[]) {
  const counts = traces.reduce<Record<string, number>>((acc, trace) => {
    if (!trace.nplusOneDetected) return acc;
    acc[trace.endpoint] = (acc[trace.endpoint] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([endpoint, value]) => ({ endpoint, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-950">{title}</h2>
        {subtitle && <div className="mt-1 text-xs text-gray-500">{subtitle}</div>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function StatCard({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "neutral" | "good" | "warn" | "danger" | "info";
}) {
  const toneClass = {
    neutral: "text-gray-950 bg-gray-50 border-gray-200",
    good: "text-emerald-700 bg-emerald-50 border-emerald-200",
    warn: "text-amber-700 bg-amber-50 border-amber-200",
    danger: "text-red-700 bg-red-50 border-red-200",
    info: "text-cyan-700 bg-cyan-50 border-cyan-200",
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-70">
        {label}
      </div>
      <div className="mt-4 font-mono text-4xl font-semibold leading-none">
        {value}
      </div>
      <div className="mt-3 text-xs opacity-70">{helper}</div>
    </div>
  );
}

function LineChart({
  series,
  timestamps,
  height = 240,
}: {
  series: Series[];
  timestamps: number[];
  height?: number;
}) {
  const width = 760;
  const padding = {
    top: 18,
    right: 22,
    bottom: 36,
    left: 54,
  };
  const values = series.flatMap((item) => item.values);
  const maxValue = Math.max(...values, 1);
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const xTicks = timestamps.length <= 1
    ? [0]
    : Array.from(
        new Set([
          0,
          Math.floor((timestamps.length - 1) / 2),
          timestamps.length - 1,
        ])
      );

  const toPath = (items: number[]) => {
    if (items.length === 0) return "";

    return items
      .map((value, index) => {
        const x =
          padding.left +
          (items.length === 1 ? chartWidth : (index / (items.length - 1)) * chartWidth);
        const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  };

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        className="h-60 w-full"
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3, 4].map((line) => {
          const y = padding.top + (line / 4) * chartHeight;
          const value = maxValue - (maxValue / 4) * line;
          return (
            <g key={line}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-gray-500 font-mono text-[10px]"
              >
                {formatAxisValue(value)}
              </text>
            </g>
          );
        })}
        <line
          x1={padding.left}
          x2={padding.left}
          y1={padding.top}
          y2={padding.top + chartHeight}
          stroke="#d1d5db"
        />
        <line
          x1={padding.left}
          x2={width - padding.right}
          y1={padding.top + chartHeight}
          y2={padding.top + chartHeight}
          stroke="#d1d5db"
        />
        {series.map((item) => (
          <path
            key={item.label}
            d={toPath(item.values)}
            fill="none"
            stroke={item.color}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {series.map((item) => {
          const latest = item.values.at(-1);

          if (latest === undefined || item.values.length === 0) return null;

          const x =
            padding.left +
            (item.values.length === 1
              ? chartWidth
              : ((item.values.length - 1) / (item.values.length - 1)) * chartWidth);
          const y = padding.top + chartHeight - (latest / maxValue) * chartHeight;

          return (
            <circle
              key={`${item.label}-dot`}
              cx={x}
              cy={y}
              r="3.5"
              fill={item.color}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
          );
        })}
        {xTicks.map((index) => {
          const x =
            padding.left +
            (timestamps.length <= 1
              ? 0
              : (index / (timestamps.length - 1)) * chartWidth);

          return (
            <g key={index}>
              <line
                x1={x}
                x2={x}
                y1={padding.top}
                y2={padding.top + chartHeight}
                stroke="#f3f4f6"
              />
              <text
                x={x}
                y={height - 10}
                textAnchor={index === 0 ? "start" : index === timestamps.length - 1 ? "end" : "middle"}
                className="fill-gray-500 font-mono text-[10px]"
              >
                {timestamps[index] ? formatTimeLabel(timestamps[index]) : "--"}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
        {series.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ items }: { items: { endpoint: string; value: number }[] }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  if (items.length === 0) {
    return <div className="text-sm text-gray-500">No N+1 endpoints yet.</div>;
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.endpoint} className="grid grid-cols-[minmax(0,220px)_1fr_auto] items-center gap-3">
          <div className="truncate font-mono text-xs text-gray-700">
            {item.endpoint}
          </div>
          <div className="h-8 overflow-hidden rounded bg-gray-100">
            <div
              className="flex h-full items-center justify-end rounded bg-amber-400 pr-2 font-mono text-xs font-semibold text-amber-950"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            >
              {item.value}
            </div>
          </div>
          <div className="font-mono text-xs font-semibold text-gray-700">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricInventory({ metrics }: { metrics: Record<string, number> }) {
  const entries = Object.entries(metrics).sort(([left], [right]) =>
    left.localeCompare(right)
  );

  if (entries.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No queryguard_* metrics were found in the Prometheus response.
      </div>
    );
  }

  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {entries.map(([name, value]) => (
        <div
          key={name}
          className="rounded border border-gray-200 bg-gray-50 px-3 py-2"
        >
          <div className="truncate font-mono text-[11px] font-semibold text-gray-700">
            {name}
          </div>
          <div className="mt-1 font-mono text-xs text-gray-950">
            {formatNumber(value, Number.isInteger(value) ? 0 : 3)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [traces, setTraces] = useState<RequestTrace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRangeMs, setSelectedRangeMs] = useState(DEFAULT_TIME_RANGE_MS);

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);

    const [metricsResult, tracesResult] = await Promise.allSettled([
      fetchPrometheusMetrics(),
      fetchTraces(),
    ]);

    if (metricsResult.status === "fulfilled") {
      const totals = parsePrometheusMetrics(metricsResult.value);
      setPoints((current) => {
        const nextPoint = createMetricPoint(totals, current.at(-1));
        return prunePoints([...current, nextPoint], MAX_HISTORY_MS);
      });
    }

    if (tracesResult.status === "fulfilled") {
      setTraces(tracesResult.value);
    }

    const failed = [metricsResult, tracesResult]
      .filter((result) => result.status === "rejected")
      .map((result) => (result as PromiseRejectedResult).reason?.message ?? "Request failed");

    setError(failed.length > 0 ? failed.join(". ") : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrometheusMetrics()
      .then((text) => parsePrometheusMetrics(text))
      .then((totals) => {
        setPoints((current) =>
          prunePoints([...current, createMetricPoint(totals)], MAX_HISTORY_MS)
        );
      })
      .catch((reason: Error) => setError(reason.message));

    fetchTraces()
      .then(setTraces)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refresh(false);
    }, POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const latest = points.at(-1);
  const visiblePoints = getVisiblePoints(points, selectedRangeMs);
  const selectedRangeLabel =
    TIME_RANGE_OPTIONS.find((option) => option.value === selectedRangeMs)?.label ??
    "5m";
  const latestMetrics = latest?.queryguardMetrics ?? {};
  const nplusOneEndpoints = useMemo(
    () => getNplusOneEndpointCounts(traces),
    [traces]
  );
  const nplusOneTraceCount = traces.filter(
    (trace) => trace.nplusOneDetected
  ).length;
  const observedRequests = getCounterDelta(visiblePoints, "requestsTotal");
  const observedNplusOne = getCounterDelta(visiblePoints, "nplusOneTotal");
  const observedCriticals = getCounterDelta(visiblePoints, "criticalTotal");
  const nplusOneRateRequestCount = traces.length > 0 ? traces.length : observedRequests;
  const criticalTraceCount = traces.filter((trace) => trace.issues.length > 0).length;
  const criticalRateRequestCount = traces.length > 0 ? traces.length : observedRequests;
  const criticalAffectedRequestCount =
    criticalTraceCount > 0
      ? criticalTraceCount
      : Math.min(observedCriticals, criticalRateRequestCount);
  const observedNplusOnePercent =
    nplusOneRateRequestCount > 0
      ? Math.min((nplusOneTraceCount / nplusOneRateRequestCount) * 100, 100)
      : 0;
  const observedCriticalPercent =
    criticalRateRequestCount > 0
      ? Math.min((criticalAffectedRequestCount / criticalRateRequestCount) * 100, 100)
      : 0;
  const nplusOneRateSeries = getWindowRatePercent(
    visiblePoints,
    "nplusOneTotal",
    "requestsTotal"
  );
  const chartTimestamps = visiblePoints.map((point) => point.timestamp);

  return (
    <div className="min-h-screen bg-gray-100 text-black">
      <div className="border-b border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/"
                aria-label="Back to requests"
                title="Back to requests"
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-gray-700 shadow-sm transition hover:bg-gray-50 hover:text-gray-950"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
                  <path
                    d="M12.5 4.5 7 10l5.5 5.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-gray-950">
                  Live Dashboard
                </h1>
                <div className="mt-1 text-xs text-gray-500">
                  Prometheus metrics from /actuator/prometheus
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm">
              Time range
              <select
                value={selectedRangeMs}
                onChange={(event) => setSelectedRangeMs(Number(event.target.value))}
                className="bg-white font-mono text-xs text-gray-950 outline-none"
              >
                {TIME_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">
              Auto 5s
            </span>
            <button
              type="button"
              onClick={() => refresh(true)}
              className="rounded border border-gray-200 bg-gray-950 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-white shadow-sm transition hover:bg-gray-800"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <main className="space-y-4 px-5 py-5">
        {error && (
          <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
            Loading live metrics...
          </div>
        )}

        <div className="rounded border border-gray-200 bg-white px-4 py-3 text-xs text-gray-600 shadow-sm">
          Showing samples from the last {selectedRangeLabel}. Longer ranges fill
          as this page stays open because Spring Actuator exposes an instant
          Prometheus scrape, not historical query_range data.
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Observed Requests"
            value={formatNumber(observedRequests)}
            helper={latest?.metricNames.requests ?? "request metric not exposed"}
            tone="good"
          />
          <StatCard
            label="Observed N+1"
            value={formatNumber(observedNplusOne)}
            helper={latest?.metricNames.nplusOne ?? "N+1 metric not exposed"}
            tone={observedNplusOne > 0 ? "warn" : "good"}
          />
          <StatCard
            label="N+1 Rate"
            value={formatPercent(observedNplusOnePercent)}
            helper={`${nplusOneTraceCount} of ${nplusOneRateRequestCount} requests affected`}
            tone={observedNplusOnePercent > 0 ? "warn" : "good"}
          />
          <StatCard
            label="Observed Criticals"
            value={formatNumber(observedCriticals)}
            helper={latest?.metricNames.critical ?? "critical metric not exposed"}
            tone={observedCriticals > 0 ? "danger" : "good"}
          />
          <StatCard
            label="Critical Rate"
            value={formatPercent(observedCriticalPercent)}
            helper={`${criticalAffectedRequestCount} of ${criticalRateRequestCount} requests affected`}
            tone={observedCriticalPercent > 0 ? "danger" : "good"}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Traffic vs N+1 Impact" subtitle={`Rolling rate over ${selectedRangeLabel}`}>
            <LineChart
              timestamps={chartTimestamps}
              series={[
                {
                  label: "Total Requests",
                  color: "#0891b2",
                  values: visiblePoints.map((point) => point.requestRate),
                },
                {
                  label: "N+1 Queries",
                  color: "#d97706",
                  values: visiblePoints.map((point) => point.nplusOneRate),
                },
              ]}
            />
          </Panel>

          <Panel title="N+1 Rate (%)" subtitle={`N+1 increase divided by request increase over ${selectedRangeLabel}`}>
            <LineChart
              timestamps={chartTimestamps}
              series={[
                {
                  label: "N+1 Rate",
                  color: "#d97706",
                  values: nplusOneRateSeries,
                },
              ]}
            />
          </Panel>
        </div>

        <Panel title="Detected QueryGuard Metrics" subtitle="Parsed directly from Spring Actuator Prometheus output">
          <MetricInventory metrics={latestMetrics} />
        </Panel>

        <Panel title="Top N+1 Endpoints" subtitle="Derived from request traces with nplusOneDetected=true">
          <BarChart items={nplusOneEndpoints} />
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel
            title="Requests (req/s)"
            subtitle={
              latest?.metricNames.requests
                ? `Rate from ${latest.metricNames.requests} over ${selectedRangeLabel}`
                : "Request metric not exposed"
            }
          >
            <LineChart
              timestamps={chartTimestamps}
              series={[
                {
                  label: "Requests",
                  color: "#0891b2",
                  values: visiblePoints.map((point) => point.requestRate),
                },
              ]}
            />
          </Panel>

          <Panel title="Total Requests vs N+1" subtitle="Request traces in the UI cache">
            <LineChart
              timestamps={chartTimestamps}
              series={[
                {
                  label: "All Requests",
                  color: "#0891b2",
                  values: visiblePoints.map(() => traces.length),
                },
                {
                  label: "N+1 Requests",
                  color: "#d97706",
                  values: visiblePoints.map(() => nplusOneTraceCount),
                },
              ]}
            />
          </Panel>

          <Panel
            title="Critical Issues (req/s)"
            subtitle={
              latest?.metricNames.critical
                ? `Rate from ${latest.metricNames.critical} over ${selectedRangeLabel}`
                : "Critical metric not exposed"
            }
          >
            <LineChart
              timestamps={chartTimestamps}
              series={[
                {
                  label: "Critical Issues",
                  color: "#dc2626",
                  values: visiblePoints.map((point) => point.criticalRate),
                },
              ]}
            />
          </Panel>

          <Panel
            title="N+1 Queries (req/s)"
            subtitle={
              latest?.metricNames.nplusOne
                ? `Rate from ${latest.metricNames.nplusOne} over ${selectedRangeLabel}`
                : "N+1 metric not exposed"
            }
          >
            <LineChart
              timestamps={chartTimestamps}
              series={[
                {
                  label: "N+1 Queries",
                  color: "#d97706",
                  values: visiblePoints.map((point) => point.nplusOneRate),
                },
              ]}
            />
          </Panel>
        </div>
      </main>
    </div>
  );
}
