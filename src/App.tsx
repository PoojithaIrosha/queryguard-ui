import Home from "./pages/Home";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import TraceDetail from "./pages/TraceDetail";
import Dashboard from "./pages/Dashboard";

function normalizeRouterBase(value: string | undefined) {
  if (!value || value === "/") return "/";

  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

const routerBase = normalizeRouterBase(
  import.meta.env.VITE_QUERYGUARD_UI_BASE_PATH
);

function App() {
  return (
    <BrowserRouter basename={routerBase}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trace/:traceId" element={<TraceDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
