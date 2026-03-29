import { create } from "zustand";

interface NavStore {
  mobileNavRevealed: boolean;
  showMobileNav: () => void;
  hideMobileNav: () => void;
}

export const useNavStore = create<NavStore>((set) => ({
  mobileNavRevealed: false,
  showMobileNav: () => set({ mobileNavRevealed: true }),
  hideMobileNav: () => set({ mobileNavRevealed: false }),
}));
