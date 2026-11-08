// Bottom-sheet style dialog to create or edit a category or an activity.
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '../theme/theme';
import { AppText, Button, Row, Stepper, Toggle } from './ui';
import { formatPoints } from '../lib/scoring';

export type DialogValues = { name: string; points: number; isQuick: boolean };

type Props = {
  visible: boolean;
  title: string;
  initial: DialogValues;
  withPoints?: boolean; // false for categories
  onSave: (values: DialogValues) => void;
  onArchive?: () => void; // shown only when editing an existing item
  onClose: () => void;
};

export function EditDialog({ visible, title, initial, withPoints = true, onSave, onArchive, onClose }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState(initial);

  // Reset the form each time the dialog opens.
  useEffect(() => {
    if (visible) setValues(initial);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = values.name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + 20 },
          ]}
        >
          <AppText variant="heading">{title}</AppText>

          <TextInput
            value={values.name}
            onChangeText={(name) => setValues({ ...values, name })}
            placeholder="Name"
            placeholderTextColor={colors.faint}
            autoFocus={!initial.name}
            style={[styles.input, { color: colors.text, borderColor: colors.text }]}
          />

          {withPoints ? (
            <>
              <Row label="Points">
                <Stepper
                  value={values.points}
                  display={formatPoints(values.points)}
                  min={-50}
                  max={50}
                  onChange={(points) => setValues({ ...values, points })}
                />
              </Row>
              <Row label="Quick action" hint="Show as a button on check-in notifications (max 3)">
                <Toggle value={values.isQuick} onChange={(isQuick) => setValues({ ...values, isQuick })} />
              </Row>
            </>
          ) : null}

          <Button title="Save" variant="primary" disabled={!canSave} onPress={() => onSave(values)} />
          {onArchive ? <Button title="Remove" variant="ghost" onPress={onArchive} /> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 12,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 14,
    minHeight: 56,
    paddingHorizontal: 16,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
});
