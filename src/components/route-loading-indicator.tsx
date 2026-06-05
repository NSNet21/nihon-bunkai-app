import { ActivityIndicator, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';

import { Accent, Spacing } from '@/constants/theme';

export function RouteLoadingIndicator({ style }: { style?: ViewStyle }) {
  const { width, height } = useWindowDimensions();
  const spinnerScale = width < 480 ? 1.2 : width < 768 ? 1.45 : 1.7;
  const minHeight = Math.max(220, Math.min(380, height * 0.38));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="กำลังโหลด"
      style={[styles.wrap, { minHeight }, style]}>
      <ActivityIndicator
        color={Accent.base}
        size="large"
        style={{ transform: [{ scale: spinnerScale }] }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.six,
  },
});
