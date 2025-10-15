// src/auth/RequireActiveResident.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthBootstrap } from './useAuthBootstrap';

export default function RequireActiveResident({ children }) {
  const { ready, allowed } = useAuthBootstrap();
  if (!ready) return null;               // можно показать сплэш
  if (!allowed) return <Navigate to="/login" replace />;
  return children;
}
