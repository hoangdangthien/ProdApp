import React, { useState, useCallback, createContext, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation } from "react-router-dom";
import ProductionPage from "./pages/ProductionPage";
import ABCPage from "./pages/ABCPage";
import "./App.css";

const SidebarContext = createContext();
export function useSidebar() { return useContext(SidebarContext); }

function AppInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Close sidebar on route change
  React.useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <SidebarContext.Provider value={{ sidebarOpen, toggleSidebar, closeSidebar }}>
      <div className={`app ${sidebarOpen ? "sidebar-open" : ""}`}>
        <nav className="navbar">
          <button className="hamburger" onClick={toggleSidebar} aria-label="Toggle sidebar">
            <span /><span /><span />
          </button>
          <div className="navbar-brand">ResApp</div>
          <div className="navbar-links">
            <NavLink to="/" end className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              Production
            </NavLink>
            <NavLink to="/abc" className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              ABC Analysis
            </NavLink>
          </div>
        </nav>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<ProductionPage />} />
            <Route path="/abc" element={<ABCPage />} />
          </Routes>
        </main>
        {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}
      </div>
    </SidebarContext.Provider>
  );
}

function App() {
  return (
    <Router>
      <AppInner />
    </Router>
  );
}

export default App;
