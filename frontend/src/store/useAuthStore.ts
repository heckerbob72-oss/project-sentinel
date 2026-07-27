import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/lib/types";

interface AuthState {
  token: string | null;
  user: User | null;
  hasHydrated: boolean;
  setAuth: (token: string, user?: User | null) => void;
  setUser: (user: User | null) => void;
  setHasHydrated: (value: boolean) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

/**
 * Auth store — persists the access token + user to localStorage so a page
 * refresh keeps the session. The API client reads `token` via getState().
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      hasHydrated: false,
      setAuth: (token, user = null) => set({ token, user }),
      setUser: (user) => set({ user }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      logout: () => set({ token: null, user: null }),
      isAuthenticated: () => Boolean(get().token),
    }),
    {
      name: "sentinel-auth",
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
