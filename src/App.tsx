import Home from "./pages/Home";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TraceDetail from "./pages/TraceDetail";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trace/:traceId" element={<TraceDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
