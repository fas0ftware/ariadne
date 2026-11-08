// Fast log screen: one tap on an activity logs it and returns.
// Opened from the "Log activity" button or by tapping a check-in notification.
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { addLog, listActivities, listCategories, type Activity } from '../db/queries';
import { useSettings } from '../lib/SettingsContext';
import { slotForTime } from '../lib/slots';
import { formatPoints } from '../lib/scoring';
import { formatTime } from '../lib/dates';
import { useLoader } from '../lib/useLoader';
import { AppText, Screen, Section } from '../components/ui';
import { fonts, useTheme } from '../theme/theme';

export default function LogScreen() {
  // Set when opened from a notification.
  const params = useLocalSearchParams<{ notificationId?: string; slot?: string }>();
  const notificationSlot = params.slot ? Number(params.slot) : null;
  const { settings } = useSettings();

  const data = useLoader(async () => ({
    categories: await listCategories(),
    activities: await listActivities(),
  }));

  async function log(activity: Activity) {
    const now = Date.now();
    await addLog({
      activityId: activity.id,
      source: params.notificationId ? 'notification' : 'app',
      slotStart: notificationSlot ?? slotForTime(now, settings),
      notificationId: params.notificationId ?? null,
      loggedAt: now,
    });
    if (params.notificationId) {
      Notifications.dismissNotificationAsync(params.notificationId).catch(() => {});
    }
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <Screen>
      <AppText variant="title">What are you doing?</AppText>
      {notificationSlot ? (
        <AppText muted>Check-in for {formatTime(notificationSlot)}</AppText>
      ) : null}

      {data?.categories.map((category) => {
        const activities = data.activities.filter((a) => a.category_id === category.id);
        if (activities.length === 0) return null;
        return (
          <Section key={category.id} title={category.name}>
            <View style={styles.grid}>
              {activities.map((activity) => (
                <ActivityTile key={activity.id} activity={activity} onPress={() => log(activity)} />
              ))}
            </View>
          </Section>
        );
      })}
    </Screen>
  );
}

function ActivityTile({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  const { colors } = useTheme();
  const positive = activity.points >= 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor: colors.text,
          // Positive activities are filled, negative ones outlined: readable at a glance.
          backgroundColor: positive ? colors.inverseBackground : 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={2}
        style={[styles.tileName, { color: positive ? colors.inverseText : colors.text }]}
      >
        {activity.name}
      </Text>
      <Text style={[styles.tilePoints, { color: positive ? colors.inverseText : colors.text }]}>
        {formatPoints(activity.points)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%',
    flexGrow: 1,
    minHeight: 88,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
  },
  tileName: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21 },
  tilePoints: { fontFamily: fonts.bold, fontSize: 15, marginTop: 6 },
});
