import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...(Platform.OS === 'web' ? {} : {
          animation: 'fade',
          animationDuration: 180,
        }),
      }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="level" />
      <Stack.Screen name="pace" />
    </Stack>
  );
}
