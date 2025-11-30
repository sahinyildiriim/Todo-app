import React from "react";
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  if (!token) {
    // Token yoksa login sayfasına yönlendir
    return <Navigate to="/login" replace />;
  }
  // Token varsa component render
  return children;
}
