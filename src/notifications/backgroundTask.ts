// Runs when a notification button is tapped while the app is in the background or closed
// (Android only). Imported from index.ts so it is defined before the app starts.
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { handleQuickAction, refreshScheduleIfNeeded } from './checkins';

const TASK_NAME = 'ariadne-notification-action';

TaskManager.defineTask<Notifications.NotificationTaskPayload>(TASK_NAME, async ({ data, error }) => {
  if (error || !data || !('actionIdentifier' in data)) return;
  try {
    await handleQuickAction(data);
    // Keeps reminders going even if the app itself isn't opened for days.
    await refreshScheduleIfNeeded();
  } catch (e) {
    console.warn('Background quick action failed', e);
  }
});

Notifications.registerTaskAsync(TASK_NAME).catch((e) => {
  console.warn('Could not register notification task', e);
});
