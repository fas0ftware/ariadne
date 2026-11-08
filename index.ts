// The background task must be defined at module scope, before the app starts,
// so Android can run it when a notification action is tapped while the app is closed.
import './src/notifications/backgroundTask';
import 'expo-router/entry';
