import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProjectState {
  selectedProjectId: string | null;
  selectedProjectName: string | null;
  setSelectedProject: (id: string | null, name?: string | null) => void;
  clear: () => void;
}

/**
 * Tracks the globally-selected project id used across pages (health, risks,
 * WBS, timeline, simulation...). Persisted so the control-tower selection
 * survives navigation and refresh.
 */
export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      selectedProjectId: null,
      selectedProjectName: null,
      setSelectedProject: (id, name = null) =>
        set({ selectedProjectId: id, selectedProjectName: name }),
      clear: () => set({ selectedProjectId: null, selectedProjectName: null }),
    }),
    { name: "sentinel-project" },
  ),
);
