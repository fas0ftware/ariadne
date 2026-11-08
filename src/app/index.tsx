// Today (home): score, streak, category breakdown, the big log button and a timeline.
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { deleteLog, listDayTotals, listLogsForDay, type LogEntry } from '../db/queries';
import { useSettings } from '../lib/SettingsContext';
import { useLoader } from '../lib/useLoader';
import { addDays, formatLongDate, formatTime, toDayKey, todayKey } from '../lib/dates';
import { currentStreak, dayMessage, dayScore, formatPoints, scoresByDay } from '../lib/scoring';
import { slotsForDay } from '../lib/slots';
import { AppText, Button, Divider, Screen, Section } from '../components/ui';
import { useTheme } from '../theme/theme';

export default function TodayScreen() {
  const { settings } = useSettings();

  const data = useLoader(async () => {
    const day = todayKey();
    return {
      day,
      logs: await listLogsForDay(day),
      // Enough history for any realistic streak.
      totals: await listDayTotals(toDayKey(addDays(new Date(), -400))),
    };
  });

  if (!data) return <Screen padTop>{null}</Screen>;

  const positive = data.logs.filter((l) => l.points > 0).reduce((sum, l) => sum + l.points, 0);
  const negative = data.logs.filter((l) => l.points < 0).reduce((sum, l) => sum + l.points, 0);
  const score = dayScore(positive, negative, settings.penaltyCap);
  const streak = currentStreak(scoresByDay(data.totals, settings.penaltyCap), settings.targetScore);
  const capReached = negative < settings.penaltyCap;

  return (
    <Screen padTop>
      <AppText variant="label" muted>
        ARIADNE
      </AppText>
      <AppText variant="heading">{formatLongDate(new Date())}</AppText>

      {/* Score */}
      <View style={{ marginTop: 8 }}>
        <AppText variant="score">{score}</AppText>
        <AppText muted>points today · target {settings.targetScore}</AppText>
      </View>

      <View style={styles.statsRow}>
        <Stat label="Streak" value={`${streak} ${streak === 1 ? 'day' : 'days'}`} />
        <Stat label="Logged" value={String(data.logs.length)} />
      </View>

      <AppText>{dayMessage(score, settings.targetScore, data.logs.length)}</AppText>
      {capReached ? (
        <AppText variant="small" muted>
          Penalty cap reached ({settings.penaltyCap}). Further minus points do not count today.
        </AppText>
      ) : null}

      <Button title="Log activity" variant="primary" size="big" onPress={() => router.push('/log')} />

      <CategoryBreakdown logs={data.logs} />
      <Timeline logs={data.logs} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { borderColor: colors.border }]}>
      <AppText variant="label" muted>
        {label.toUpperCase()}
      </AppText>
      <AppText variant="heading">{value}</AppText>
    </View>
  );
}

function CategoryBreakdown({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) return null;
  const byCategory = new Map<string, number>();
  for (const log of logs) {
    byCategory.set(log.category_name, (byCategory.get(log.category_name) ?? 0) + log.points);
  }
  return (
    <Section title="By category">
      {[...byCategory.entries()].map(([name, points]) => (
        <View key={name} style={styles.line}>
          <AppText>{name}</AppText>
          <AppText variant="bodyStrong">{formatPoints(points)}</AppText>
        </View>
      ))}
    </Section>
  );
}

type TimelineItem =
  | { kind: 'log'; time: number; log: LogEntry }
  | { kind: 'unlogged'; time: number };

// Logs plus check-in slots that passed without an answer (shown, never penalized).
function Timeline({ logs }: { logs: LogEntry[] }) {
  const { settings } = useSettings();
  const now = Date.now();
  const intervalMs = settings.intervalMin * 60_000;

  const items: TimelineItem[] = logs.map((log) => ({ kind: 'log', time: log.logged_at, log }));
  for (const slot of slotsForDay(new Date(), settings)) {
    if (slot > now) break;
    const answered = logs.some(
      (l) => l.slot_start === slot || (l.logged_at >= slot && l.logged_at < slot + intervalMs),
    );
    if (!answered) items.push({ kind: 'unlogged', time: slot });
  }
  items.sort((a, b) => b.time - a.time);

  function confirmDelete(log: LogEntry) {
    Alert.alert('Remove this log?', `${log.activity_name} at ${formatTime(log.logged_at)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteLog(log.id) },
    ]);
  }

  return (
    <Section title="Timeline">
      {items.length === 0 ? <AppText muted>Nothing yet today.</AppText> : null}
      {items.map((item, index) => (
        <View key={item.kind === 'log' ? `log-${item.log.id}` : `slot-${item.time}`}>
          {index > 0 ? <Divider /> : null}
          {item.kind === 'log' ? (
            <Pressable onLongPress={() => confirmDelete(item.log)} style={styles.timelineRow}>
              <AppText muted style={styles.time}>
                {formatTime(item.time)}
              </AppText>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{item.log.activity_name}</AppText>
                <AppText variant="small" muted>
                  {item.log.category_name}
                </AppText>
              </View>
              <AppText variant="bodyStrong">{formatPoints(item.log.points)}</AppText>
            </Pressable>
          ) : (
            <View style={styles.timelineRow}>
              <AppText faint style={styles.time}>
                {formatTime(item.time)}
              </AppText>
              <AppText faint>Not logged</AppText>
            </View>
          )}
        </View>
      ))}
      {logs.length > 0 ? (
        <AppText variant="small" faint>
          Long-press a log to remove it.
        </AppText>
      ) : null}
    </Section>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, gap: 2 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, gap: 14 },
  time: { width: 48 },
});
