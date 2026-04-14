import { type RequestTrace } from "../types/trace";

const baseUrl: string = "http://localhost:8080/";

export async function fetchTraces(): Promise<RequestTrace[]> {
  const res = await fetch(`${baseUrl}queryguard/api/requests`);
  if (!res.ok) throw new Error("Failed to fetch traces");
  return res.json();
}

export async function fetchTraceById(id: string) {
  const res = await fetch(`${baseUrl}queryguard/api/requests/${id}`);
  return res.json();
}

export async function fetchPrometheusMetrics(): Promise<string> {
  const res = await fetch(`${baseUrl}actuator/prometheus`);
  if (!res.ok) throw new Error("Failed to fetch Prometheus metrics");
  return res.text();
}
