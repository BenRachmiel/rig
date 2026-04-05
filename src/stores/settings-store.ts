import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Settings {
  theme: "dark" | "light" | "system";
  normalizationEnabled: boolean;
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: "dark",
      normalizationEnabled: true,
      set: (key, value) => set({ [key]: value }),
    }),
    {
      name: "rig:settings",
      onRehydrateStorage: () => () => {
        if (typeof window === "undefined") return;
        const old = localStorage.getItem("rig:normalize");
        if (old !== null) {
          useSettingsStore.setState({ normalizationEnabled: old !== "false" });
          localStorage.removeItem("rig:normalize");
        }
      },
    },
  ),
);
