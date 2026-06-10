import { ReactNode } from "react";
import { Navigate } from "react-router-dom";

export function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthed = typeof window !== "undefined" && localStorage.getItem("auth_admin") === "1";
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
