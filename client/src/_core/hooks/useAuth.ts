import { getLoginUrl } from '../../const';
import { trpc } from '../../lib/trpc';
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

type MockUser = {
  id: string;
  email: string;
  name: string;
  avatar: string;
};

// Mock user for development
const MOCK_USER: MockUser = {
  id: import.meta.env.VITE_MOCK_USER_ID || 'dev-user-123',
  email: import.meta.env.VITE_MOCK_USER_EMAIL || 'dev@example.com',
  name: import.meta.env.VITE_MOCK_USER_NAME || 'Development User',
  avatar: import.meta.env.VITE_MOCK_USER_AVATAR || 'https://i.pravatar.cc/150?u=dev@example.com',
};

export function useAuth(options?: UseAuthOptions) {
  const isDev = import.meta.env.DEV;
  const [mockUser, setMockUser] = useState<MockUser | null>(null);
  const { redirectOnUnauthenticated = false, redirectPath = isDev ? '/login' : getLoginUrl() } = options ?? {};
  const utils = trpc.useUtils();

  // Use mock data in development
  const meQuery = isDev 
    ? { 
        data: mockUser, 
        isLoading: false, 
        isError: false, 
        refetch: async () => {
          setMockUser(MOCK_USER);
          return { data: MOCK_USER, error: null };
        } 
      } 
    : trpc.auth.me.useQuery(undefined, {
        retry: false,
        refetchOnWindowFocus: false,
      });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    if (isDev) {
      setMockUser(null);
      localStorage.removeItem('mockAuth');
      return;
    }
    try {
      await logoutMutation.mutateAsync();
      utils.auth.me.setData(undefined);
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  }, [utils, isDev]);

  useEffect(() => {
    if (isDev && !mockUser && localStorage.getItem('mockAuth')) {
      setMockUser(MOCK_USER);
    }
  }, [isDev, mockUser]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: isDev ? mockUser : meQuery.data,
      isLoading: isDev ? false : meQuery.isLoading,
      isAuthenticated: isDev ? !!mockUser : !!meQuery.data,
      logout,
      refresh: isDev ? () => {
        setMockUser(MOCK_USER);
        return Promise.resolve({ data: MOCK_USER, error: null });
      } : meQuery.refetch,
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    isDev,
    mockUser,
  ]);

  const login = useCallback(async () => {
    if (isDev) {
      setMockUser(MOCK_USER);
      localStorage.setItem('mockAuth', 'true');
      return;
    }
    if (redirectPath) {
      window.location.href = redirectPath;
    }
  }, [redirectPath, isDev]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
