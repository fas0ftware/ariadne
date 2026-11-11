// Black-and-white bar chart of the last days. Plain Views, no chart library.
import { StyleSheet, View } from 'react-native';
import type { DayBar } from '../lib/stats';
import { fromDayKey } from '../lib/dates';
import { useTheme } from '../theme/theme';
import { AppText } from './ui';

const HEIGHT = 120;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function WeekChart({ bars, target }: { bars: DayBar[]; target: number }) {
  const { colors } = useTheme();
  const values = bars.map((b) => b.score ?? 0);
  const max = Math.max(target, ...values, 1);
  const min = Math.min(0, ...values);
  const span = max - min;
  const zeroY = (max / span) * HEIGHT; // distance from the top to the zero line
  const targetY = ((max - target) / span) * HEIGHT;

  return (
    <View accessibilityRole="image" accessibilityLabel={`Scores of the last ${bars.length} days`}>
      <View style={[styles.plot, { height: HEIGHT }]}>
        <View style={[styles.line, { top: targetY, borderColor: colors.muted, borderStyle: 'dashed' }]} />
        <View style={[styles.line, { top: zeroY, borderColor: colors.border }]} />
        {bars.map((bar) => {
          const score = bar.score ?? 0;
          const h = (Math.abs(score) / span) * HEIGHT;
          const reached = bar.score !== null && score >= target;
          return (
            <View key={bar.day} style={styles.col}>
              {bar.score === null ? (
                <View style={[styles.dot, { top: zeroY - 3, backgroundColor: colors.faint }]} />
              ) : (
                <View
                  style={[
                    styles.bar,
                    score >= 0 ? { top: zeroY - h } : { top: zeroY },
                    {
                      height: Math.max(h, 2),
                      backgroundColor: reached ? colors.text : colors.surface,
                      borderColor: colors.text,
                    },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {bars.map((bar) => (
          <AppText key={bar.day} variant="small" muted style={styles.label}>
            {WEEKDAY[fromDayKey(bar.day).getDay()]}
          </AppText>
        ))}
      </View>
      <AppText variant="small" faint>
        Filled bars reached the target ({target}). Dashed line: target. Dots: nothing logged.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', gap: 8, position: 'relative' },
  line: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1 },
  col: { flex: 1, position: 'relative' },
  bar: { position: 'absolute', left: 0, right: 0, borderWidth: 1, borderRadius: 4 },
  dot: { position: 'absolute', alignSelf: 'center', width: 6, height: 6, borderRadius: 3 },
  labels: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 8 },
  label: { flex: 1, textAlign: 'center' },
});
