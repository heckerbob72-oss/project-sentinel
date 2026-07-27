import { create } from "zustand";

interface UIState {
  mobileNavOpen: boolean;
  openMobileNav: () => void;
  closeMobileNav: () => void;
  toggleMobileNav: () => void;
}

/**
 * Ephemeral UI state shared between the Sidebar and TopNav — not persisted,
 * since a menu open/closed state shouldn't survive a refresh.
 */
export const useUIStore = create<UIState>()((set) => ({
  mobileNavOpen: false,
  openMobileNav: () => set({ mobileNavOpen: true }),
  closeMobileNav: () => set({ mobileNavOpen: false }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
}));
