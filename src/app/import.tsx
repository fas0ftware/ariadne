// Restore from a backup: paste the JSON that "Share backup" produced.
// The text is validated completely before anything is changed, and the user confirms first.
import { useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { restoreBackup } from '../db/backup';
import { backupSummary, parseBackup } from '../lib/backup';
import { rescheduleCheckins } from '../notifications/checkins';
import { useSettings } from '../lib/SettingsContext';
import { AppText, Button, Screen } from '../components/ui';
import { useTheme } from '../theme/theme';

export default function ImportScreen() {
  const { colors } = useTheme();
  const { reloadSettings } = useSettings();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function check() {
    const result = parseBackup(text.trim());
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    Alert.alert(
      'Replace all data?',
      `The backup has ${backupSummary(result.backup)}. Everything currently in Ariadne will be replaced.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await restoreBackup(result.backup);
              await reloadSettings();
              await rescheduleCheckins();
              Alert.alert('Restored', 'Your backup is back.');
              router.back();
            } catch (e) {
              setError(`Restore failed, nothing was changed: ${String(e)}`);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <AppText muted>
        Paste the text of a backup made with “Share backup”. It is checked completely before anything is
        changed.
      </AppText>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        autoCorrect={false}
        autoCapitalize="none"
        placeholder='{"app":"ariadne", ...}'
        placeholderTextColor={colors.faint}
        style={[styles.input, { color: colors.text, borderColor: colors.text }]}
      />
      {error ? <AppText variant="bodyStrong">{error}</AppText> : null}
      <Button title={busy ? 'Restoring…' : 'Check and restore'} variant="primary" disabled={!text.trim() || busy} onPress={check} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 200, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top', fontSize: 13 },
});
