// History: week and month totals, then every logged day with its score.
// Tap a day to see what was logged.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { listDayTotals, listLogsForDay, type DayTotals, type LogEntry } from '../db/queries';
import { onDataChanged } from '../db/database';
import { useSettings } from '../lib/SettingsContext';
import { useLoader } from '../lib/useLoader';
import { formatShortDate, formatTime, fromDayKey, startOfMonth, startOfWeek, toDayKey, todayKey } from '../lib/dates';
import { dayScore, formatPoints, scoresByDay, sumScores } from '../lib/scoring';
import { AppText, Divider, Screen } from '../components/ui';
import { useTheme } from '../theme/theme';

export default function HistoryScreen() {
  const { settings } = useSettings();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const totals = useLoader(() => listDayTotals());

  if (!totals) return <Screen>{null}</Screen>;

  const scores = scoresByDay(totals, settings.penaltyCap);
  const today = todayKey();
  const week = sumScores(scores, toDayKey(startOfWeek(new Date())), today);
  const month = sumScores(scores, toDayKey(startOfMonth(new Date())), today);

  return (
    <Screen>
      <View style={styles.statsRow}>
        <Stat label="This week" value={week} />
        <Stat label="This month" value={month} />
      </View>

      {totals.length === 0 ? <AppText muted>No days logged yet.</AppText> : null}

      {totals.map((day, index) => (
        <View key={day.day}>
          {index > 0 ? <Divider /> : null}
          <DayRow
            day={day}
            score={dayScore(day.positive, day.negative, settings.penaltyCap)}
            target={settings.targetScore}
            open={openDay === day.day}
            onPress={() => setOpenDay(openDay === day.day ? null : day.day)}
          />
        </View>
      ))}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { borderColor: colors.border }]}>
      <AppText variant="label" muted>
        {label.toUpperCase()}
      </AppText>
      <AppText variant="title">{value}</AppText>
    </View>
  );
}

function DayRow(props: { day: DayTotals; score: number; target: number; open: boolean; onPress: () => void }) {
  const { day, score, target, open, onPress } = props;
  const isToday = day.day === todayKey();
  return (
    <View>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.dayRow, { opacity: pressed ? 0.6 : 1 }]}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{isToday ? 'Today' : formatShortDate(fromDayKey(day.day))}</AppText>
          <AppText variant="small" muted>
            {day.count} {day.count === 1 ? 'log' : 'logs'}
            {score >= target ? ' · target reached' : ''}
          </AppText>
        </View>
        <AppText variant="heading">{score}</AppText>
      </Pressable>
      {open ? <DayDetails day={day.day} /> : null}
    </View>
  );
}

function DayDetails({ day }: { day: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const load = () => listLogsForDay(day).then(setLogs);
    load();
    return onDataChanged(load);
  }, [day]);

  return (
    <View style={{ paddingBottom: 12, gap: 6 }}>
      {logs.map((log) => (
        <View key={log.id} style={styles.logRow}>
          <AppText muted style={{ width: 48 }}>
            {formatTime(log.logged_at)}
          </AppText>
          <AppText style={{ flex: 1 }}>{log.activity_name}</AppText>
          <AppText variant="bodyStrong">{formatPoints(log.points)}</AppText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14 },
  dayRow: { flexDirection: 'row', alignItems: 'center', minHeight: 64 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
