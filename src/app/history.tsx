// History: week and month totals, then every logged day with its score.
// Tap a day to see what was logged.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { listDayTotals, listLogsForDay, type DayTotals, type LogEntry } from '../db/queries';
import { onDataChanged } from '../db/database';
import { useSettings } from '../lib/SettingsContext';
import { useLoader } from '../lib/useLoader';
import { addDays, formatShortDate, formatTime, fromDayKey, startOfMonth, startOfWeek, toDayKey, todayKey } from '../lib/dates';
import { dayScore, formatPoints, scoresByDay, sumScores } from '../lib/scoring';
import { averageScore, bestDay, categoryShares, lastDays, longestStreak } from '../lib/stats';
import { categoryTotals } from '../db/backup';
import { AppText, Divider, Screen, Section } from '../components/ui';
import { WeekChart } from '../components/WeekChart';
import { useTheme } from '../theme/theme';

export default function HistoryScreen() {
  const { settings } = useSettings();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const totals = useLoader(() => listDayTotals());
  const categories = useLoader(() => categoryTotals(toDayKey(addDays(new Date(), -29))));

  if (!totals) return <Screen>{null}</Screen>;

  const scores = scoresByDay(totals, settings.penaltyCap);
  const today = todayKey();
  const week = sumScores(scores, toDayKey(startOfWeek(new Date())), today);
  const month = sumScores(scores, toDayKey(startOfMonth(new Date())), today);
  const best = bestDay(scores);
  const average = averageScore(scores);
  const shares = categoryShares(categories ?? []).slice(0, 4);

  return (
    <Screen>
      <View style={styles.statsRow}>
        <Stat label="This week" value={week} />
        <Stat label="This month" value={month} />
      </View>

      {totals.length > 0 ? (
        <>
          <Section title="Last 7 days">
            <WeekChart bars={lastDays(scores, 7)} target={settings.targetScore} />
          </Section>

          <Section title="Insights">
            <View style={styles.statsRow}>
              <Stat label="Best day" value={best ? best.score : 0} hint={best ? formatShortDate(fromDayKey(best.day)) : ''} />
              <Stat label="Longest streak" value={longestStreak(scores, settings.targetScore)} hint="days" />
              <Stat label="Average" value={average ?? 0} hint="per logged day" />
            </View>
            {shares.length > 0 ? (
              <View style={{ gap: 6, marginTop: 6 }}>
                <AppText variant="small" muted>
                  Where your plus points came from (30 days)
                </AppText>
                {shares.map((c) => (
                  <ShareRow key={c.category} name={c.category} share={c.share} points={c.points} />
                ))}
              </View>
            ) : null}
          </Section>

          <Section title="Days">{null}</Section>
        </>
      ) : (
        <AppText muted>No days logged yet.</AppText>
      )}

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

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { borderColor: colors.border }]}>
      <AppText variant="label" muted>
        {label.toUpperCase()}
      </AppText>
      <AppText variant="title">{value}</AppText>
      {hint ? (
        <AppText variant="small" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

function ShareRow({ name, share, points }: { name: string; share: number; points: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.shareRow}>
      <AppText style={{ width: 96 }} numberOfLines={1}>
        {name}
      </AppText>
      <View style={[styles.track, { backgroundColor: colors.surface }]}>
        <View style={[styles.fill, { width: `${Math.round(share * 100)}%`, backgroundColor: colors.text }]} />
      </View>
      <AppText variant="small" muted style={{ width: 44, textAlign: 'right' }}>
        {formatPoints(points)}
      </AppText>
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
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
