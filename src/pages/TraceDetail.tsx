import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { type RequestTrace } from "../types/trace";
import { fetchTraceById } from "../api/traceApi";
import Timeline from "../components/Timeline";

function formatMs(value: number, digits = 1) {
  return `${value.toFixed(digits)}ms`;
}

export default function TraceDetail() {
  const { traceId } = useParams();

  const [trace, setTrace] = useState<RequestTrace | null>(null);

  useEffect(() => {
    if (!traceId) return;
    fetchTraceById(traceId).then(setTrace);
  }, [traceId]);

  if (!trace) {
    return (
      <div className="min-h-screen bg-gray-100 p-5 text-sm text-gray-600">
        Loading trace...
      </div>
    );
  }

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
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                >
                  <path
                    d="M12.5 4.5 7 10l5.5 5.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                {trace.method}
              </span>
              <h1 className="break-all font-mono text-sm font-semibold text-gray-950">
                {trace.endpoint}
              </h1>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
              <span>
                duration{" "}
                <span className="font-semibold text-gray-800">
                  {formatMs(trace.totalExecutionTimeMs, 1)}
                </span>
              </span>
              <span>
                queries{" "}
                <span className="font-semibold text-gray-800">
                  {trace.queries.length}
                </span>
              </span>
              <span>
                trace{" "}
                <span className="font-mono text-gray-700">{trace.traceId}</span>
              </span>
            </div>
          </div>

          {trace.nplusOneDetected && (
            <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-amber-700">
              N+1 detected
            </div>
          )}
        </div>
      </div>

      <main className="grid gap-4 p-5">
        <Timeline trace={trace} />

        {/* <aside className="h-fit rounded-lg border border-gray-200 bg-white p-4 text-xs shadow-sm">
          <div className="mb-3 font-semibold text-gray-950">Request Info</div>

          <div className="space-y-2 text-gray-600">
            <div>
              Endpoint:{" "}
              <span className="break-all font-mono text-gray-950">
                {trace.endpoint}
              </span>
            </div>
            <div>
              Method:{" "}
              <span className="font-mono font-semibold text-gray-950">
                {trace.method}
              </span>
            </div>
            <div>
              Start:{" "}
              <span className="text-gray-950">
                {new Date(trace.startTime).toLocaleString()}
              </span>
            </div>
          </div>

          {trace.issues?.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 font-semibold text-red-700">Issues</div>

              <div className="space-y-2">
                {trace.issues.map((issue, index) => (
                  <div
                    key={`${issue}-${index}`}
                    className="rounded border border-red-200 bg-red-50 px-2 py-1 text-red-700"
                  >
                    {issue}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside> */}
      </main>
    </div>
  );
}
