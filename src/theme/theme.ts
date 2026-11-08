import { useColorScheme } from 'react-native';
import { useSettings } from '../lib/SettingsContext';

// Strictly black and white. Greys are only used for secondary text and lines.
const light = {
  background: '#FFFFFF',
  text: '#000000',
  muted: '#6B6B6B',
  faint: '#B5B5B5',
  border: '#E2E2E2',
  surface: '#F4F4F4',
  inverseBackground: '#000000',
  inverseText: '#FFFFFF',
};

const dark: typeof light = {
  background: '#000000',
  text: '#FFFFFF',
  muted: '#9A9A9A',
  faint: '#555555',
  border: '#262626',
  surface: '#111111',
  inverseBackground: '#FFFFFF',
  inverseText: '#000000',
};

export type Colors = typeof light;

export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
};

export function useTheme(): { colors: Colors; isDark: boolean } {
  const system = useColorScheme();
  const { settings } = useSettings();
  const isDark = settings.theme === 'system' ? system === 'dark' : settings.theme === 'dark';
  return { colors: isDark ? dark : light, isDark };
}
