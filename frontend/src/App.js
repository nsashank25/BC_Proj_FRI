// src/App.js

import { useState } from "react";
import PropertyManager from "./components/PropertyManager";
import Marketplace from "./components/Marketplace4";
import PropertyRent from "./components/PropertyRent";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState("myProperties"); // Default to myProperties tab

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>🏠 Fractional Real-Estate Investment Platform</h1>
        <nav className="app-nav">
          <button 
            className={activeTab === "myProperties" ? "active" : ""} 
            onClick={() => setActiveTab("myProperties")}
          >
            My Properties
          </button>
          <button 
            className={activeTab === "marketplace" ? "active" : ""} 
            onClick={() => setActiveTab("marketplace")}
          >
            Marketplace
          </button>
          <button 
            className={activeTab === "rentals" ? "active" : ""} 
            onClick={() => setActiveTab("rentals")}
          >
            Rentals
          </button>
        </nav>
      </header>

      <main className="app-content">
        {activeTab === "myProperties" ? (
          <PropertyManager key="propertyManager" />
        ) : activeTab === "marketplace" ? (
          <Marketplace key="marketplace" />
        ) : (
          <PropertyRent key="propertyRent" />
        )}
      </main>
    </div>
  );
}

export default App;