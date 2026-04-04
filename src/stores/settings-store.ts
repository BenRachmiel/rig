import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Settings {
  theme: "dark" | "light" | "system";
  landingPage: "/" | "/download" | "/library" | "/reverb" | "/credentials";
  normalizationEnabled: boolean;
  offlineCacheEnabled: boolean;
  offlineCacheMaxMB: number;
}

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      theme: "dark",
      landingPage: "/download",
      normalizationEnabled: true,
      offlineCacheEnabled: false,
      offlineCacheMaxMB: 200,
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
