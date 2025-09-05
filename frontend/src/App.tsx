import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./page/Home";

const App: React.FC = () => (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Routes>
          <Route
            path="/"
            element={
              <Home />
            }
          />
          <Route
            path="/certificates"
            element={
              <Home />
            }
          />
          <Route
            path="/uploadCert"
            element={
              <Home />
            }
          />
        </Routes>
      </div>
    </Router>
)

export default App
