import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import axios from "axios";

// Auto-attach token to every request
const user = localStorage.getItem("user");
if (user) {
  axios.defaults.headers.common["Authorization"] = `Bearer ${JSON.parse(user).token}`;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);