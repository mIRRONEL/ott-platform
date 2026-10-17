import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole && user?.role !== 'superadmin') {
    // If user is authenticated but not an admin, redirect to /browse
    return <Navigate to="/browse" replace />;
  }

  return <>{children}</>;
}
