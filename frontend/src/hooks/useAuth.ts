import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios, { AxiosError } from "axios";
import { useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

type UserRole = "reader" | "editor" | "admin";

interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  role: UserRole;
}

export function useAuth() {
  const queryClient = useQueryClient();
  
  const { data: user, isLoading, isFetching, error } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    queryFn: async () => {
      const response = await axios.get<AuthUser>(`${API_BASE}/api/auth/user`, {
        withCredentials: true,
      });
      return response.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (error && (error as AxiosError)?.response?.status === 401) {
      queryClient.setQueryData(["/api/auth/user"], null);
    }
  }, [error, queryClient]);

  const isInitialLoading = isLoading && user === undefined;

  const role = user?.role ?? "reader";
  
  return {
    user: user ?? null,
    isLoading: isInitialLoading,
    isFetching,
    isAuthenticated: !!user,
    isAdmin: role === "admin",
    isEditor: role === "editor" || role === "admin",
    isReader: role === "reader",
    canEdit: role === "editor" || role === "admin",
    role,
    error,
  };
}
