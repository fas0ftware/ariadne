// Hourly check-in notifications: setup, permission, scheduling and quick actions.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { addLog, listQuickActivities } from '../db/queries';
import { getSettings, saveSettings, type Settings } from '../db/settings';
import { slotsForDay } from '../lib/slots';
import { addDays } from '../lib/dates';
import { formatPoints } from '../lib/scoring';

const CHANNEL_ID = 'checkins';
const CATEGORY_ID = 'checkin'; // no ':' or '-' allowed in category ids
const ACTION_PREFIX = 'log_'; // action id = "log_<activityId>"
const ID_PREFIX = 'checkin_'; // notification id = "checkin_<slot unix ms>"

const MAX_SCHEDULED = 300; // stay well below Android's 500 alarm limit
const MAX_DAYS_AHEAD = 7;
const REFRESH_WHEN_LESS_THAN_MS = 3 * 24 * 60 * 60 * 1000;

// ---------- Setup ----------

// False if our channel could not be created; notifications then use Android's default channel.
let channelReady = Platform.OS === 'android';

// Call once at app start. Safe to call again.
export async function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt after a channel exists.
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Hourly check-ins',
        importance: AndroidImportance.HIGH,
      });
      channelReady = true;
    } catch (error) {
      // Seen in Expo Go: the channel may still have been created even though the call failed.
      console.warn('Creating the check-in channel failed', error);
      channelReady = await channelExists();
    }
  }

  try {
    await updateQuickActions();
  } catch (error) {
    console.warn('Registering quick actions failed', error);
  }
}

async function channelExists(): Promise<boolean> {
  try {
    const channels = await Notifications.getNotificationChannelsAsync();
    return channels.some((channel) => channel.id === CHANNEL_ID);
  } catch {
    return false;
  }
}

// Notifications sent to a channel that doesn't exist are dropped, so only name it when it's there.
function channelOption(): { channelId?: string } {
  return channelReady ? { channelId: CHANNEL_ID } : {};
}

// Re-register the notification buttons. Call after the quick activities change.
export async function updateQuickActions() {
  const quick = await listQuickActivities();
  await Notifications.setNotificationCategoryAsync(
    CATEGORY_ID,
    quick.map((activity) => ({
      identifier: `${ACTION_PREFIX}${activity.id}`,
      buttonTitle: `${activity.name} ${formatPoints(activity.points)}`,
      options: { opensAppToForeground: false }, // log without opening the app
    })),
  );
}

// ---------- Permission ----------

export async function hasPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

export async function requestPermission(): Promise<boolean> {
  if (await hasPermission()) return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ---------- Scheduling ----------

// Scheduling runs one at a time, so quick setting changes can't overlap.
let queue: Promise<void> = Promise.resolve();

export function rescheduleCheckins(): Promise<void> {
  queue = queue.then(scheduleNow).catch((error) => console.warn('Scheduling failed', error));
  return queue;
}

// Used on app start and by the background task: only reschedule when running low.
export async function refreshScheduleIfNeeded() {
  const settings = await getSettings();
  if (settings.scheduledUntil - Date.now() < REFRESH_WHEN_LESS_THAN_MS) {
    await rescheduleCheckins();
  }
}

// One-time notifications for the next few days. One-time (instead of repeating)
// notifications make snooze and pause simple: we just skip those slots.
async function scheduleNow() {
  const settings = await getSettings();
  await cancelCheckins();

  const times = upcomingSlots(settings);
  await Promise.all(
    times.map((slot) =>
      Notifications.scheduleNotificationAsync({
        identifier: `${ID_PREFIX}${slot}`,
        content: {
          title: 'Ariadne',
          body: 'What are you doing right now?',
          categoryIdentifier: CATEGORY_ID,
          data: { kind: 'checkin', slot },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: slot, ...channelOption() },
      }),
    ),
  );

  // When paused, keep scheduledUntil far away so the background refresh doesn't run.
  const scheduledUntil = settings.paused ? Number.MAX_SAFE_INTEGER : (times.at(-1) ?? 0);
  await saveSettings({ scheduledUntil });
}

function upcomingSlots(settings: Settings): number[] {
  if (settings.paused) return [];
  const now = Date.now();
  const perDay = slotsForDay(new Date(), settings).length || 1;
  const days = Math.max(1, Math.min(MAX_DAYS_AHEAD, Math.floor(MAX_SCHEDULED / perDay)));

  const result: number[] = [];
  for (let d = 0; d < days; d++) {
    for (const slot of slotsForDay(addDays(new Date(), d), settings)) {
      if (slot > now && slot >= settings.snoozeUntil) result.push(slot);
    }
  }
  return result.slice(0, MAX_SCHEDULED);
}

async function cancelCheckins() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(ID_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

// Fires a check-in in 5 seconds so you can test buttons with the phone locked.
export async function sendTestCheckin() {
  const slot = Date.now() + 5000;
  await Notifications.scheduleNotificationAsync({
    identifier: `${ID_PREFIX}${slot}`,
    content: {
      title: 'Ariadne',
      body: 'What are you doing right now?',
      categoryIdentifier: CATEGORY_ID,
      data: { kind: 'checkin', slot },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, ...channelOption() },
  });
}

// ---------- Responses ----------

export function slotFromNotificationId(identifier: string): number | null {
  if (!identifier.startsWith(ID_PREFIX)) return null;
  const slot = Number(identifier.slice(ID_PREFIX.length));
  return Number.isFinite(slot) ? slot : null;
}

// Handles a tap on a quick-action button. Returns true if it was one.
// Can run both in the app and in the background task; the unique
// notification_id column makes sure the same answer is only stored once.
export async function handleQuickAction(response: {
  actionIdentifier: string;
  notification: { request: { identifier: string } };
}): Promise<boolean> {
  const { actionIdentifier } = response;
  if (!actionIdentifier.startsWith(ACTION_PREFIX)) return false;

  const activityId = Number(actionIdentifier.slice(ACTION_PREFIX.length));
  const notificationId = response.notification.request.identifier;
  await addLog({
    activityId,
    source: 'notification',
    slotStart: slotFromNotificationId(notificationId),
    notificationId,
  });
  await Notifications.dismissNotificationAsync(notificationId).catch(() => {});
  return true;
}
