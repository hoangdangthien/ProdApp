import React from "react";
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import ProductionPage from "./pages/ProductionPage";
import ABCPage from "./pages/ABCPage";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
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
      </div>
    </Router>
  );
}

export default App;
