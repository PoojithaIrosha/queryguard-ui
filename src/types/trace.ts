export interface QueryExecution {
  sql: string;
  executionTimeMs: number;
  timestamp: number;
  startTimeNs: number;
  endTimeNs: number;
}

export interface RequestTrace {
  traceId: string;
  endpoint: string;
  method: string;
  startTime: number;
  totalExecutionTimeMs: number;
  nplusOneDetected: boolean;
  queries: QueryExecution[];
  issues: string[];
}
