// Connects notifications to the running app:
// - sets up the channel, buttons and permission on start
// - tapping a check-in opens the log screen
// - tapping a button while the app is open logs right away
import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import {
  configureNotifications,
  handleQuickAction,
  refreshScheduleIfNeeded,
  requestPermission,
  slotFromNotificationId,
} from './checkins';

export function NotificationBridge() {
  // The same response can arrive from the listener and from the "last response" hook.
  const handled = useRef(new Set<string>());
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

  async function handleResponse(response: Notifications.NotificationResponse) {
    const notificationId = response.notification.request.identifier;
    const key = `${notificationId}|${response.actionIdentifier}`;
    if (handled.current.has(key)) return;
    handled.current.add(key);
    Notifications.clearLastNotificationResponseAsync().catch(() => {});

    if (await handleQuickAction(response)) return;

    const slot = slotFromNotificationId(notificationId);
    if (response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER && slot !== null) {
      router.push({ pathname: '/log', params: { notificationId, slot: String(slot) } });
    }
  }

  return null;
}
