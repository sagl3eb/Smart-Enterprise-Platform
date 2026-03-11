import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// App component will be added in Session 7
function App() {
  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0E0B1F] text-[#1E1B2E] dark:text-[#EDE9FE] font-sans">
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-accent mb-2 font-serif">
            Nexus
          </h1>
          <p className="text-lg text-[#4C4566] dark:text-[#B8AEDD]">
            Smart Enterprise Platform
          </p>
          <p className="mt-4 text-sm text-[#9B93B8] dark:text-[#6B5F8F]">
            Foundation ready — Session 1 complete
          </p>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
