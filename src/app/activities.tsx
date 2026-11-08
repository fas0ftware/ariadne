// Edit categories and their activities: names, points and quick actions.
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import {
  addActivity,
  addCategory,
  archiveActivity,
  archiveCategory,
  listActivities,
  listCategories,
  renameCategory,
  updateActivity,
  MAX_QUICK_ACTIVITIES,
  type Activity,
  type Category,
} from '../db/queries';
import { formatPoints } from '../lib/scoring';
import { useLoader } from '../lib/useLoader';
import { updateQuickActions } from '../notifications/checkins';
import { AppText, Button, Divider, Screen } from '../components/ui';
import { EditDialog, type DialogValues } from '../components/EditDialog';
import { useTheme } from '../theme/theme';

// What the dialog is currently editing.
type Editing =
  | { kind: 'newCategory' }
  | { kind: 'category'; category: Category }
  | { kind: 'newActivity'; categoryId: number }
  | { kind: 'activity'; activity: Activity }
  | null;

export default function ActivitiesScreen() {
  const [editing, setEditing] = useState<Editing>(null);
  const data = useLoader(async () => ({
    categories: await listCategories(),
    activities: await listActivities(),
  }));

  const quickCount = data?.activities.filter((a) => a.is_quick).length ?? 0;

  async function save(values: DialogValues) {
    if (!editing) return;

    // Keep the number of notification buttons within Android's limit.
    const wasQuick = editing.kind === 'activity' && editing.activity.is_quick === 1;
    if (values.isQuick && !wasQuick && quickCount >= MAX_QUICK_ACTIVITIES) {
      Alert.alert('Three quick actions max', 'Turn one off first. Android shows at most 3 notification buttons.');
      return;
    }

    if (editing.kind === 'newCategory') await addCategory(values.name);
    if (editing.kind === 'category') await renameCategory(editing.category.id, values.name);
    if (editing.kind === 'newActivity') {
      await addActivity(editing.categoryId, values.name, values.points, values.isQuick);
    }
    if (editing.kind === 'activity') {
      await updateActivity(editing.activity.id, values);
    }

    setEditing(null);
    await updateQuickActions(); // button titles include names and points
  }

  function archive() {
    if (!editing || (editing.kind !== 'category' && editing.kind !== 'activity')) return;
    const isCategory = editing.kind === 'category';
    const name = isCategory ? editing.category.name : editing.activity.name;
    Alert.alert(
      `Remove ${name}?`,
      isCategory
        ? 'Its activities are removed too. Past logs and scores stay in your history.'
        : 'Past logs and scores stay in your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (editing.kind === 'category') await archiveCategory(editing.category.id);
            if (editing.kind === 'activity') await archiveActivity(editing.activity.id);
            setEditing(null);
            await updateQuickActions();
          },
        },
      ],
    );
  }

  const dialog = dialogProps(editing);

  return (
    <Screen>
      <AppText muted>Tap anything to edit it. Quick actions: {quickCount} of {MAX_QUICK_ACTIVITIES}.</AppText>

      {data?.categories.map((category) => (
        <View key={category.id} style={{ gap: 4, marginTop: 8 }}>
          <Pressable onPress={() => setEditing({ kind: 'category', category })} style={styles.categoryRow}>
            <AppText variant="heading">{category.name}</AppText>
            <AppText variant="small" muted>
              Edit
            </AppText>
          </Pressable>
          {data.activities
            .filter((a) => a.category_id === category.id)
            .map((activity) => (
              <ActivityRow key={activity.id} activity={activity} onPress={() => setEditing({ kind: 'activity', activity })} />
            ))}
          <Button
            title="+ Add activity"
            variant="ghost"
            size="small"
            style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }}
            onPress={() => setEditing({ kind: 'newActivity', categoryId: category.id })}
          />
          <Divider />
        </View>
      ))}

      <Button title="+ Add category" onPress={() => setEditing({ kind: 'newCategory' })} />

      <EditDialog
        visible={editing !== null}
        title={dialog.title}
        initial={dialog.initial}
        withPoints={dialog.withPoints}
        onSave={save}
        onArchive={dialog.canArchive ? archive : undefined}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}

function ActivityRow({ activity, onPress }: { activity: Activity; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.activityRow, { opacity: pressed ? 0.6 : 1 }]}>
      <AppText style={{ flex: 1 }}>{activity.name}</AppText>
      {activity.is_quick ? (
        <View style={[styles.badge, { borderColor: colors.text }]}>
          <AppText variant="small">Quick</AppText>
        </View>
      ) : null}
      <AppText variant="bodyStrong" style={{ minWidth: 40, textAlign: 'right' }}>
        {formatPoints(activity.points)}
      </AppText>
    </Pressable>
  );
}

function dialogProps(editing: Editing) {
  const empty = { name: '', points: 5, isQuick: false };
  switch (editing?.kind) {
    case 'newCategory':
      return { title: 'New category', initial: empty, withPoints: false, canArchive: false };
    case 'category':
      return { title: 'Edit category', initial: { ...empty, name: editing.category.name }, withPoints: false, canArchive: true };
    case 'newActivity':
      return { title: 'New activity', initial: empty, withPoints: true, canArchive: false };
    case 'activity': {
      const a = editing.activity;
      return {
        title: 'Edit activity',
        initial: { name: a.name, points: a.points, isQuick: a.is_quick === 1 },
        withPoints: true,
        canArchive: true,
      };
    }
    default:
      return { title: '', initial: empty, withPoints: true, canArchive: false };
  }
}

const styles = StyleSheet.create({
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 },
  activityRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 10 },
  badge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
});
