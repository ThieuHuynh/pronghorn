import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AdminProvider } from "@/contexts/AdminContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AdminProvider>
        <BrowserRouter>
          <App />
          <Toaster />
        </BrowserRouter>
      </AdminProvider>
    </QueryClientProvider>
  </StrictMode>
);
