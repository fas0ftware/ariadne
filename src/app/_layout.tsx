import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { getDb } from '../db/database';
import { getSettings, type Settings } from '../db/settings';
import { SettingsProvider } from '../lib/SettingsContext';
import { fonts, useTheme } from '../theme/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  const [initialSettings, setInitialSettings] = useState<Settings | null>(null);

  // Open the database (runs migrations) and load settings before showing anything.
  useEffect(() => {
    getDb()
      .then(getSettings)
      .then(setInitialSettings)
      .catch((error) => console.error('Database failed to open', error));
  }, []);

  const ready = (fontsLoaded || fontError) && initialSettings;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SettingsProvider initial={initialSettings}>
      <AppStack />
    </SettingsProvider>
  );
}

function AppStack() {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.semibold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}
