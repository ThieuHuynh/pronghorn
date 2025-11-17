import { createContext, useContext, useState, ReactNode } from "react";

interface AdminContextType {
  isAdmin: boolean;
  requestAdminAccess: () => Promise<boolean>;
  logout: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  const requestAdminAccess = async (): Promise<boolean> => {
    const key = prompt("Enter admin key:");
    if (!key) return false;

    // Verify against the ADMIN_KEY environment variable
    const expectedKey = import.meta.env.VITE_ADMIN_KEY;
    
    if (key === expectedKey) {
      setIsAdmin(true);
      sessionStorage.setItem("admin_access", "true");
      return true;
    } else {
      alert("Invalid admin key");
      return false;
    }
  };

  const logout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem("admin_access");
  };

  // Check session storage on mount
  useState(() => {
    const hasAccess = sessionStorage.getItem("admin_access") === "true";
    setIsAdmin(hasAccess);
  });

  return (
    <AdminContext.Provider value={{ isAdmin, requestAdminAccess, logout }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return context;
}
