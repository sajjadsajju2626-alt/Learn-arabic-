export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'arabic_ml_theme_v1';

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface ClassListLike {
  add: (...tokens: string[]) => void;
  remove: (...tokens: string[]) => void;
}

export interface DocumentRootLike {
  classList: ClassListLike;
  style?: { colorScheme?: string };
}

export function normalizeThemeMode(raw: unknown): ThemeMode {
  return raw === 'dark' ? 'dark' : 'light';
}

export function readPersistedTheme(
  storage: StorageLike | null,
  storageKey: string = THEME_STORAGE_KEY
): ThemeMode {
  if (!storage) return 'light';
  try {
    return normalizeThemeMode(storage.getItem(storageKey));
  } catch {
    return 'light';
  }
}

export function persistTheme(
  storage: StorageLike | null,
  theme: ThemeMode,
  storageKey: string = THEME_STORAGE_KEY
): ThemeMode {
  const normalized = normalizeThemeMode(theme);
  if (storage) {
    try {
      storage.setItem(storageKey, normalized);
    } catch {
      // Ignore storage quota or private-mode errors
    }
  }
  return normalized;
}

export function toggleThemeMode(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}

export function applyThemeToDocument(
  root: DocumentRootLike | null | undefined,
  theme: ThemeMode
): ThemeMode {
  const normalized = normalizeThemeMode(theme);
  if (root) {
    if (normalized === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (root.style) {
      root.style.colorScheme = normalized;
    }
  }
  return normalized;
}
