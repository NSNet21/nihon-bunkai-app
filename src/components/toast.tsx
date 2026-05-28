/**
 * Global Toast — bottom-anchored slide-in notifications.
 * Web-first; reanimated entrance + auto-dismiss timer.
 *
 * Use: const { showToast } = useToast(); showToast('done', { kind: 'success' });
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiCheck, FiInfo, FiX, FiZap } from 'react-icons/fi';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { Accent, Radii, Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';

type ToastKind = 'success' | 'info' | 'error';

type ToastItem = {
  id: number;
  message: string;
  kind: ToastKind;
};

type ToastOptions = {
  kind?: ToastKind;
  durationMs?: number; // default 3500
};

type ToastContextValue = {
  showToast: (message: string, opts?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION = 3500;
const TABLET_BREAKPOINT = 768;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, opts?: ToastOptions) => {
      const id = nextIdRef.current++;
      const kind = opts?.kind ?? 'info';
      const duration = opts?.durationMs ?? DEFAULT_DURATION;
      setToasts((prev) => [...prev, { id, message, kind }]);
      setTimeout(() => dismissToast(id), duration);
    },
    [dismissToast],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= TABLET_BREAKPOINT;

  return (
    <View
      style={[styles.viewport, { pointerEvents: 'box-none' } as any, isDesktop ? styles.viewportDesktop : styles.viewportMobile]}>
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </View>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const IconCmp =
    item.kind === 'success' ? FiCheck :
    item.kind === 'error'   ? FiX :
                              FiInfo;
  const tone =
    item.kind === 'success' ? styles.toastSuccess :
    item.kind === 'error'   ? styles.toastError :
                              styles.toastInfo;

  return (
    <Animated.View
      entering={SlideInDown.duration(260).easing(Easing.bezier(0.4, 0, 0.2, 1))}
      exiting={SlideOutDown.duration(180).easing(Easing.bezier(0.4, 0, 1, 1))}
      style={[styles.toast, tone]}>
      <IconCmp size={16} color="#ffffff" strokeWidth={2.5} />
      <ThemedText type="defaultSemiBold" style={styles.toastText}>
        {item.message}
      </ThemedText>
      <Pressable onPress={onDismiss} style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.6 }]}>
        <FiX size={14} color="#ffffff" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    position: 'absolute',
    zIndex: 200,
    gap: Spacing.two,
  },
  viewportDesktop: {
    right: 24,
    bottom: 24,
    maxWidth: 420,
  },
  viewportMobile: {
    left: 16,
    right: 16,
    bottom: 24,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.sm,
    minHeight: 44,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
    elevation: 6,
  },
  toastSuccess: { backgroundColor: Accent.base },
  toastInfo:    { backgroundColor: '#14110e' },
  toastError:   { backgroundColor: '#b5604a' },
  toastText: {
    color: '#ffffff',
    flex: 1,
    fontSize: 13,
  },
  dismissBtn: {
    padding: 4,
    marginLeft: Spacing.two,
  },
});
