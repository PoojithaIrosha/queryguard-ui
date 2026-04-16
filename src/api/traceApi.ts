import { type RequestTrace } from "../types/trace";

const baseUrl: string = import.meta.env.VITE_QUERYGUARD_API_BASE_URL ?? "/";

function apiUrl(path: string) {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

export async function fetchTraces(): Promise<RequestTrace[]> {
  const res = await fetch(apiUrl("queryguard/api/requests"));
  if (!res.ok) throw new Error("Failed to fetch traces");
  return res.json();
}

export async function fetchTraceById(id: string) {
  const res = await fetch(apiUrl(`queryguard/api/requests/${id}`));
  return res.json();
}

export async function fetchPrometheusMetrics(): Promise<string> {
  const res = await fetch(apiUrl("actuator/prometheus"));
  if (!res.ok) throw new Error("Failed to fetch Prometheus metrics");
  return res.text();
}
