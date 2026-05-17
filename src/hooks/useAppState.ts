import { create } from 'zustand';
import type { AppUser, Language, UserRole } from '@/lib/index';

interface AppState {
  currentUser: AppUser | null;
  activeRole: UserRole | null;
  language: Language;
  setCurrentUser: (user: AppUser | null) => void;
  setActiveRole: (role: UserRole | null) => void;
  setLanguage: (lang: Language) => void;
}

export const useAppState = create<AppState>((set) => ({
  currentUser: null,
  activeRole: null,
  language: 'en',
  setCurrentUser: (user) => set({ currentUser: user }),
  setActiveRole: (role) => set({ activeRole: role }),
  setLanguage: (lang) => set({ language: lang }),
}));
