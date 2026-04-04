import { create } from "zustand";

interface NavStore {
  mobileNavRevealed: boolean;
  showMobileNav: () => void;
  hideMobileNav: () => void;
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useNavStore = create<NavStore>((set) => ({
  mobileNavRevealed: false,
  showMobileNav: () => set({ mobileNavRevealed: true }),
  hideMobileNav: () => set({ mobileNavRevealed: false }),
  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
}));
