// Small set of shared building blocks. Every screen is built from these.
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, useTheme } from '../theme/theme';

// ---------- Text ----------

const textVariants = {
  score: { fontFamily: fonts.bold, fontSize: 80, lineHeight: 92 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 36 },
  heading: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 1.5 },
} satisfies Record<string, TextStyle>;

type TextProps = {
  children: ReactNode;
  variant?: keyof typeof textVariants;
  muted?: boolean;
  faint?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

export function AppText({ children, variant = 'body', muted, faint, style, numberOfLines }: TextProps) {
  const { colors } = useTheme();
  const color = faint ? colors.faint : muted ? colors.muted : colors.text;
  return (
    <Text numberOfLines={numberOfLines} style={[textVariants[variant], { color }, style]}>
      {children}
    </Text>
  );
}

// ---------- Screen ----------

// Scrollable page with safe-area padding at the bottom.
export function Screen({ children, padTop = false }: { children: ReactNode; padTop?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: padTop ? insets.top + 16 : 20,
        paddingBottom: insets.bottom + 40,
        gap: 16,
      }}
    >
      {children}
    </ScrollView>
  );
}

// ---------- Buttons ----------

type ButtonProps = {
  title: string;
  onPress: () => void;
  onLongPress?: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'big' | 'normal' | 'small';
  right?: string; // optional text on the right side, e.g. points
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function Button({
  title,
  onPress,
  onLongPress,
  variant = 'outline',
  size = 'normal',
  right,
  style,
  disabled,
}: ButtonProps) {
  const { colors } = useTheme();
  const filled = variant === 'primary';
  const textColor = filled ? colors.inverseText : colors.text;
  const height = size === 'big' ? 72 : size === 'normal' ? 56 : 40;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: height,
          backgroundColor: filled ? colors.inverseBackground : 'transparent',
          borderColor: variant === 'ghost' ? 'transparent' : filled ? colors.inverseBackground : colors.text,
          opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
          justifyContent: right ? 'space-between' : 'center',
          paddingHorizontal: size === 'small' ? 12 : 20,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={2}
        style={{
          color: textColor,
          fontFamily: fonts.semibold,
          fontSize: size === 'big' ? 20 : size === 'normal' ? 16 : 14,
          flexShrink: 1,
        }}
      >
        {title}
      </Text>
      {right ? (
        <Text style={{ color: textColor, fontFamily: fonts.bold, fontSize: 16, marginLeft: 8 }}>{right}</Text>
      ) : null}
    </Pressable>
  );
}

// ---------- Layout helpers ----------

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <AppText variant="label" muted>
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

// A labelled row with something on the right (switch, stepper, value).
export function Row({ label, hint, children }: { label: string; hint?: string; children?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="small" muted>
            {hint}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// ---------- Inputs ----------

// Row of options where exactly one is selected.
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { borderColor: colors.text }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.inverseBackground }]}
          >
            <Text
              style={{
                fontFamily: fonts.semibold,
                fontSize: 15,
                color: selected ? colors.inverseText : colors.text,
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// "−  value  +" control for numbers.
export function Stepper({
  value,
  display,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
}: {
  value: number;
  display?: string;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const { colors } = useTheme();
  const change = (delta: number) => onChange(Math.min(max, Math.max(min, value + delta)));
  return (
    <View style={styles.stepper}>
      <StepButton label="−" onPress={() => change(-step)} disabled={value <= min} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 17, color: colors.text, minWidth: 60, textAlign: 'center' }}>
        {display ?? value}
      </Text>
      <StepButton label="+" onPress={() => change(step)} disabled={value >= max} />
    </View>
  );
}

function StepButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.stepButton,
        { borderColor: colors.text, opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={{ fontFamily: fonts.semibold, fontSize: 20, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.border, true: colors.text }}
      thumbColor={value ? colors.background : colors.muted}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: 1.5,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderRadius: 14,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
