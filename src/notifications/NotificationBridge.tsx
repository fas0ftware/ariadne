// Connects notifications to the running app:
// - sets up the channel, buttons and permission on start
// - tapping a check-in opens the log screen
// - tapping a button while the app is open logs right away
import { useEffect } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  configureNotifications,
  handleQuickAction,
  refreshScheduleIfNeeded,
  requestPermission,
  slotFromNotificationId,
} from './checkins';

// The same response can arrive from the listener and from the "last response" hook.
const handled = new Set<string>();

async function handleResponse(response: Notifications.NotificationResponse) {
  const notificationId = response.notification.request.identifier;
  const key = `${notificationId}|${response.actionIdentifier}`;
  if (handled.has(key)) return;
  handled.add(key);
  Notifications.clearLastNotificationResponseAsync().catch(() => {});

  if (await handleQuickAction(response)) return;

  const slot = slotFromNotificationId(notificationId);
  if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && slot !== null) {
    router.push({ pathname: '/log', params: { notificationId, slot: String(slot) } });
  }
}

export function NotificationBridge() {
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    configureNotifications()
      .then(requestPermission)
      .then(refreshScheduleIfNeeded)
      .catch((error) => console.warn('Notification setup failed', error));

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => subscription.remove();
  }, []);

  // Covers the case where a tap on the notification launched the app.
  useEffect(() => {
    if (lastResponse) handleResponse(lastResponse);
  }, [lastResponse]);

  return null;
}
