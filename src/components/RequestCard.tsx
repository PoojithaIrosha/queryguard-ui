import { useState } from "react";
import { type RequestTrace } from "../types/trace";

export default function RequestCard({ trace }: { trace: RequestTrace }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      onClick={() => setOpen(!open)}
      className="bg-secondary/80 border border-white/10 rounded-xl p-4 mb-3 cursor-pointer hover:bg-primary/70 transition"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-accent">
            {trace.method} {trace.endpoint}
          </div>
          <div className="text-sm text-gray-300">
            {trace.queries.length} queries • {trace.totalExecutionTimeMs.toFixed(2)} ms
          </div>
        </div>

        <div className="flex items-center gap-3">
          {trace.nplusOneDetected && (
            <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
              N+1
            </span>
          )}
          <span className="text-xs text-gray-400">
            {new Date(trace.startTime).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {open && (
        <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
          {trace.queries.map((q, i) => (
            <div
              key={i}
              className="bg-dark/60 border border-white/5 rounded-lg p-3 text-sm"
            >
              <div className="text-accent font-medium">
                {q.executionTimeMs.toFixed(2)} ms
              </div>
              <div className="text-gray-300 break-all font-mono text-xs mt-1">
                {q.sql}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}