import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_STORAGE_KEY,
  normalizeThemeMode,
  readPersistedTheme,
  persistTheme,
  toggleThemeMode,
  applyThemeToDocument,
  type StorageLike,
  type DocumentRootLike,
  type ThemeMode,
} from './theme';

test('normalizeThemeMode maps dark explicitly and defaults everything else to light', () => {
  assert.equal(normalizeThemeMode('dark'), 'dark');
  assert.equal(normalizeThemeMode('light'), 'light');
  assert.equal(normalizeThemeMode('system'), 'light');
  assert.equal(normalizeThemeMode(''), 'light');
  assert.equal(normalizeThemeMode(null), 'light');
  assert.equal(normalizeThemeMode(undefined), 'light');
});

test('toggleThemeMode switches between light and dark', () => {
  assert.equal(toggleThemeMode('light'), 'dark');
  assert.equal(toggleThemeMode('dark'), 'light');
});

test('readPersistedTheme and persistTheme round-trip safely through storage', () => {
  const store = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, val) => {
      store.set(key, val);
    },
  };

  assert.equal(readPersistedTheme(mockStorage), 'light');

  persistTheme(mockStorage, 'dark');
  assert.equal(store.get(THEME_STORAGE_KEY), 'dark');
  assert.equal(readPersistedTheme(mockStorage), 'dark');

  persistTheme(mockStorage, 'light');
  assert.equal(store.get(THEME_STORAGE_KEY), 'light');
  assert.equal(readPersistedTheme(mockStorage), 'light');
});

test('readPersistedTheme and persistTheme tolerate storage exceptions and null storage', () => {
  const throwingStorage: StorageLike = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };

  assert.equal(readPersistedTheme(null), 'light');
  assert.equal(readPersistedTheme(throwingStorage), 'light');
  assert.doesNotThrow(() => persistTheme(throwingStorage, 'dark'));
  assert.equal(persistTheme(null, 'dark'), 'dark');
});

test('applyThemeToDocument toggles .dark class and colorScheme on document root', () => {
  const classes = new Set<string>();
  const root: DocumentRootLike = {
    classList: {
      add: (...tokens: string[]) => tokens.forEach((t) => classes.add(t)),
      remove: (...tokens: string[]) => tokens.forEach((t) => classes.delete(t)),
    },
    style: { colorScheme: '' },
  };

  const apply = (mode: ThemeMode) => applyThemeToDocument(root, mode);

  assert.equal(apply('dark'), 'dark');
  assert.equal(classes.has('dark'), true);
  assert.equal(root.style?.colorScheme, 'dark');

  assert.equal(apply('light'), 'light');
  assert.equal(classes.has('dark'), false);
  assert.equal(root.style?.colorScheme, 'light');
});
