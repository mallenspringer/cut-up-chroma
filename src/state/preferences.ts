export type WorkbenchTheme = 'cutting_mat' | 'drafting' | 'clean_gray';
export type PaperTextureType = 'none' | 'bristol' | 'watercolor';

export interface UserPreferences {
  workbenchTheme: WorkbenchTheme;
  paperTexture: PaperTextureType;
  paperTextureOpacity: number; // 0..100 % (Texture Prominence)
  shadowDepth: number; // 0..16 px
  shadowOpacity: number; // 0..70 % (Shadow Darkness)
  shadowColor: string; // Hex color e.g. #000000
  autoUnderlap: boolean;
  showUnderlapDashes: boolean;
  enableCookiePersistence: boolean;
  cookieConsentAccepted: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  workbenchTheme: 'drafting',
  paperTexture: 'none',
  paperTextureOpacity: 15,
  shadowDepth: 4,
  shadowOpacity: 25,
  shadowColor: '#000000',
  autoUnderlap: true,
  showUnderlapDashes: true,
  enableCookiePersistence: true,
  cookieConsentAccepted: true,
};

const STORAGE_KEY = 'cutup_chroma_preferences_v1';

export function loadUserPreferences(): UserPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (prefs.enableCookiePersistence) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Could not save user preferences to localStorage', e);
  }
}
