import { useEffect } from 'react';
import { Platform, Pressable, useWindowDimensions } from 'react-native';
import { FiArrowUp } from 'react-icons/fi';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Accent, Radii } from '@/constants/theme';

const TABLET_BREAKPOINT = 768;

type Props = {
  visible: boolean;
  onPress: () => void;
};

export function ScrollToTop({ visible, onPress }: Props) {
  const { width } = useWindowDimensions();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(16);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: 220,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
    translateY.value = withTiming(visible ? 0 : 16, {
      duration: 220,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, [visible, opacity, translateY]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  if (Platform.OS !== 'web' || width < TABLET_BREAKPOINT) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          right: 24,
          bottom: 24,
          zIndex: 100,
          pointerEvents: visible ? 'auto' : 'none',
        },
        containerStyle,
      ]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withTiming(0.92, {
            duration: 90,
            easing: Easing.bezier(0.4, 0, 0.2, 1),
          });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) });
        }}
        accessibilityLabel="กลับสู่ด้านบน"
        /* @ts-ignore web tooltip */
        title="กลับสู่ด้านบน"
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: Radii.sm,
          backgroundColor: Accent.base,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.9 : 1,
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.22)',
          elevation: 6,
        })}>
        <FiArrowUp size={20} color="#ffffff" strokeWidth={2.5} />
      </Pressable>
    </Animated.View>
  );
}
