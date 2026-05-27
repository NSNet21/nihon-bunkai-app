import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 180,
      }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="level" />
      <Stack.Screen name="pace" />
    </Stack>
  );
}
