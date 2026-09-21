import { create } from "zustand";
import type { AppUser, Language, UserRole } from "@/lib/index";

const LANGUAGE_KEY = "britium.rider.language";

function initialLanguage(): Language {
  if (typeof window === "undefined") return "my";
  const saved = window.localStorage.getItem(LANGUAGE_KEY);
  return saved === "en" ? "en" : "my";
}

function applyDocumentLanguage(lang: Language) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang === "my" ? "my" : "en";
}

interface AppState {
  currentUser: AppUser | null;
  activeRole: UserRole | null;
  language: Language;
  setCurrentUser: (user: AppUser | null) => void;
  setActiveRole: (role: UserRole | null) => void;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const defaultLanguage = initialLanguage();
applyDocumentLanguage(defaultLanguage);

export const useAppState = create<AppState>((set, get) => ({
  currentUser: null,
  activeRole: null,
  language: defaultLanguage,
  setCurrentUser: (user) => set({ currentUser: user }),
  setActiveRole: (role) => set({ activeRole: role }),
  setLanguage: (lang) => {
    if (typeof window !== "undefined") window.localStorage.setItem(LANGUAGE_KEY, lang);
    applyDocumentLanguage(lang);
    set({ language: lang });
  },
  toggleLanguage: () => {
    const next: Language = get().language === "my" ? "en" : "my";
    if (typeof window !== "undefined") window.localStorage.setItem(LANGUAGE_KEY, next);
    applyDocumentLanguage(next);
    set({ language: next });
  },
}));
