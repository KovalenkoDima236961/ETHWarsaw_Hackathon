import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from "./page/Home";
import { CivicAuthProvider } from "@civic/auth-web3/react";

const App: React.FC = () => (
  <CivicAuthProvider clientId={import.meta.env.VITE_CIVIC_CLIENT_ID as string}>
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
  </CivicAuthProvider>
)

export default App
