import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { tryInitialRefresh } from "./api/axios";
import { BrowserRouter } from "react-router-dom";

(async () => {
  // сначала пробуем тихо освежить токен
  await tryInitialRefresh();

  // потом уже монтируем приложение
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
})();
