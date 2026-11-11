import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from '../db/settings';
import { onDataChanged } from '../db/database';

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (changes: Partial<Settings>) => Promise<void>;
  reloadSettings: () => Promise<void>; // after a restore replaced the stored settings
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  reloadSettings: async () => {},
});

// Loads settings once and keeps them in sync with the database.
export function SettingsProvider({ initial, children }: { initial: Settings; children: ReactNode }) {
  const [settings, setSettings] = useState(initial);

  useEffect(() => onDataChanged(() => getSettings().then(setSettings)), []);

  const updateSettings = useCallback(async (changes: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...changes })); // instant UI update
    await saveSettings(changes);
  }, []);

  const reloadSettings = useCallback(async () => {
    setSettings(await getSettings());
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, reloadSettings }}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
