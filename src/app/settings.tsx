import { useCallback, useState } from 'react';
import { Alert, Linking, Share, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { Settings } from '../db/settings';
import { useSettings } from '../lib/SettingsContext';
import { formatMinutes, formatTime, todayKey } from '../lib/dates';
import { useNow } from '../lib/useNow';
import {
  hasPermission,
  requestPermission,
  rescheduleCheckins,
  sendTestCheckin,
} from '../notifications/checkins';
import { AppText, Button, Divider, Row, Screen, Section, Segmented, Stepper, Toggle } from '../components/ui';
import { exportBackup, exportCsvRows } from '../db/backup';
import { backupSummary, logsToCsv } from '../lib/backup';

const SNOOZE_OPTIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
];

export default function SettingsScreen() {
  const { settings, updateSettings } = useSettings();
  const [permission, setPermission] = useState<boolean | null>(null);
  const now = useNow(15_000);

  useFocusEffect(
    useCallback(() => {
      hasPermission().then(setPermission);
    }, []),
  );

  // Changes that affect check-in times also reschedule the notifications.
  async function changeSchedule(changes: Partial<Settings>) {
    await updateSettings(changes);
    await rescheduleCheckins();
  }

  async function askPermission() {
    const granted = await requestPermission();
    setPermission(granted);
    if (granted) {
      await rescheduleCheckins();
    } else {
      // Android won't show the prompt again after a refusal; the system settings still work.
      Alert.alert('Notifications are off', 'You can turn them on in the system settings for Ariadne.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
    }
  }

  async function testCheckin() {
    await sendTestCheckin();
    Alert.alert('Test sent', 'A check-in will arrive in about 5 seconds. Try locking the phone.');
  }

  // Uses the system share sheet: save to Files/Drive, send to yourself, or copy. No extra permissions.
  async function shareBackup() {
    try {
      const backup = await exportBackup();
      await Share.share({ title: `ariadne-backup-${todayKey()}.json`, message: JSON.stringify(backup) });
      await updateSettings({ lastBackupAt: Date.now() });
      Alert.alert('Backup ready', backupSummary(backup));
    } catch (error) {
      Alert.alert('Backup failed', String(error));
    }
  }

  async function shareCsv() {
    try {
      const csv = logsToCsv(await exportCsvRows());
      await Share.share({ title: `ariadne-logs-${todayKey()}.csv`, message: csv });
    } catch (error) {
      Alert.alert('Export failed', String(error));
    }
  }

  const snoozed = settings.snoozeUntil > now;

  return (
    <Screen>
      <Section title="Appearance">
        <Segmented
          options={[
            { label: 'System', value: 'system' },
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
          ]}
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
        />
      </Section>

      <Section title="Check-ins">
        {permission === false ? (
          <View style={{ gap: 8 }}>
            <AppText muted>Notifications are not allowed yet, so check-ins cannot reach you.</AppText>
            <Button title="Allow notifications" variant="primary" onPress={askPermission} />
          </View>
        ) : null}

        <Row label="Pause check-ins" hint={settings.paused ? 'No check-ins until you turn this off' : undefined}>
          <Toggle value={settings.paused} onChange={(paused) => changeSchedule({ paused })} />
        </Row>
        <Divider />
        <Row label="First check-in">
          <Stepper
            value={settings.wakeStartMin}
            display={formatMinutes(settings.wakeStartMin)}
            step={30}
            min={0}
            max={settings.wakeEndMin - 30}
            onChange={(wakeStartMin) => changeSchedule({ wakeStartMin })}
          />
        </Row>
        <Divider />
        <Row label="Last check-in">
          <Stepper
            value={settings.wakeEndMin}
            display={formatMinutes(settings.wakeEndMin)}
            step={30}
            min={settings.wakeStartMin + 30}
            max={23 * 60 + 30}
            onChange={(wakeEndMin) => changeSchedule({ wakeEndMin })}
          />
        </Row>
        <Divider />
        <AppText variant="bodyStrong">Every</AppText>
        <Segmented
          options={[
            { label: '30 m', value: 30 },
            { label: '60 m', value: 60 },
            { label: '90 m', value: 90 },
            { label: '120 m', value: 120 },
          ]}
          value={settings.intervalMin}
          onChange={(intervalMin) => changeSchedule({ intervalMin })}
        />

        <AppText variant="bodyStrong" style={{ marginTop: 8 }}>
          Snooze
        </AppText>
        {snoozed ? (
          <Row label={`Snoozed until ${formatTime(settings.snoozeUntil)}`}>
            <Button title="Resume" size="small" onPress={() => changeSchedule({ snoozeUntil: 0 })} />
          </Row>
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {SNOOZE_OPTIONS.map((option) => (
              <Button
                key={option.minutes}
                title={option.label}
                style={{ flex: 1 }}
                onPress={() => changeSchedule({ snoozeUntil: Date.now() + option.minutes * 60_000 })}
              />
            ))}
          </View>
        )}

        <Button title="Send a test check-in" variant="ghost" onPress={testCheckin} />
      </Section>

      <Section title="Scoring">
        <Row label="Daily target" hint="Reach it to keep your streak going">
          <Stepper
            value={settings.targetScore}
            step={5}
            min={0}
            max={500}
            onChange={(targetScore) => updateSettings({ targetScore })}
          />
        </Row>
        <Divider />
        <Row label="Penalty cap" hint="Minus points per day never go below this">
          <Stepper
            value={settings.penaltyCap}
            step={5}
            min={-200}
            max={0}
            onChange={(penaltyCap) => updateSettings({ penaltyCap })}
          />
        </Row>
      </Section>

      <Section title="Activities">
        <Button title="Edit categories and activities" onPress={() => router.push('/activities')} />
      </Section>

      <Section title="Backup">
        <AppText variant="small" muted>
          Your data only lives on this phone. Uninstalling the app deletes it, so keep a backup.
          {settings.lastBackupAt ? ` Last backup: ${new Date(settings.lastBackupAt).toLocaleDateString()}.` : ' No backup yet.'}
        </AppText>
        <Button title="Share backup (JSON)" variant="primary" onPress={shareBackup} />
        <Button title="Export logs as CSV" onPress={shareCsv} />
        <Button title="Restore from backup" variant="ghost" onPress={() => router.push('/import')} />
      </Section>
    </Screen>
  );
}
