import Home from "./pages/Home";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TraceDetail from "./pages/TraceDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/trace/:traceId" element={<TraceDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;