import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiCheck, FiCheckCircle, FiDownload, FiDownloadCloud, FiExternalLink, FiFileText, FiGrid, FiHardDrive, FiList, FiRefreshCw, FiSmartphone, FiZap } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { ScrollToTop } from '@/components/scroll-to-top';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { bundles, buyUrl, LANDING_URL, perLevel, type Product } from '@/data/products';
import { getZipsForSku } from '@/data/sku-zips';
import { downloadSku, type ProgressEvent } from '@/lib/download';
import { importZipsForSku } from '@/lib/deck-import';
import { hasAllZipsForSku, saveZipToDevice } from '@/lib/download-store';

const SCROLL_TOP_THRESHOLD = 400;

function openExternal(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    void Linking.openURL(url);
  }
}

type ViewMode = 'list' | 'grid';

export default function ShopScreen() {
  const scheme = useColorScheme();
  const colors = (scheme === 'dark' ? Colors.dark : Colors.light) as typeof Colors.light;
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('shop-view-mode', 'list');
  const { status, entitledSkus } = useAuth();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollOuter}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setShowScrollTop((prev) => {
              const next = y > SCROLL_TOP_THRESHOLD;
              return prev === next ? prev : next;
            });
          }}
          scrollEventThrottle={100}>
         <View style={styles.scrollInner}>
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <ThemedText type="title">ร้านค้า</ThemedText>
              <ViewToggle mode={viewMode} onChange={setViewMode} colors={colors} />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              ราคาเดียวกับ landing · เช็คเอาท์ที่ Payhip
            </ThemedText>
          </View>

          {status === 'signed-out' && (
            <Pressable
              onPress={() => router.push('/login')}
              style={({ pressed }) => [
                styles.nudgeBanner,
                { borderColor: Accent.base, backgroundColor: Accent.bg },
                pressed && { opacity: 0.85 },
              ]}>
              <FiZap size={16} color={Accent.base} />
              <View style={{ flex: 1 }}>
                <ThemedText type="defaultSemiBold" style={{ color: Accent.base, fontSize: 13 }}>
                  เข้าสู่ระบบก่อนซื้อ → unlock ทันทีหลัง checkout
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  ถ้าซื้อก่อน — สมัครภายหลังด้วย email เดียวกัน pack จะ unlock อัตโนมัติ
                </ThemedText>
              </View>
              <ThemedText type="small" style={{ color: Accent.base, fontSize: 18 }}>→</ThemedText>
            </Pressable>
          )}

          {perLevel.map((group) => (
            <LevelSection
              key={group.level}
              level={group.level}
              kanji={group.kanji}
              blurb={group.blurb}
              products={group.products}
              colors={colors}
              viewMode={viewMode}
            />
          ))}

          <View style={styles.bundlesSection}>
            <View style={styles.sectionHeader}>
              <View style={[styles.rule, { backgroundColor: Accent.base }]} />
              <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: Accent.base }]}>
                ชุดรวมหลายระดับ
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.bundleBlurb}>
              ครอบคลุม N5–N1 ทั้งหมด · ประหยัดเทียบกับซื้อแยก
            </ThemedText>
            <View style={viewMode === 'grid' ? styles.productGrid : styles.productList}>
              {bundles.map((p) => (
                <ProductCard key={p.slug} product={p} colors={colors} featured={p.slug === 'full-bundle'} viewMode={viewMode} />
              ))}
            </View>
          </View>

          <Pressable onPress={() => openExternal(LANDING_URL)} style={styles.landingLink}>
            <FiExternalLink size={14} color={colors.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              ดูเต็มที่ landing page
            </ThemedText>
          </Pressable>
         </View>
        </ScrollView>
      </SafeAreaView>
      <ScrollToTop
        visible={showScrollTop}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
    </ThemedView>
  );
}

function LevelSection({
  level,
  kanji,
  blurb,
  products,
  colors,
  viewMode,
}: {
  level: string;
  kanji: string;
  blurb: string;
  products: Product[];
  colors: typeof Colors.light;
  viewMode: ViewMode;
}) {
  return (
    <View style={styles.levelSection}>
      <View style={styles.sectionHeader}>
        <View style={[styles.rule, { backgroundColor: Accent.base }]} />
        <ThemedText type="defaultSemiBold" style={[styles.sectionTitle, { color: Accent.base }]}>
          {level}
        </ThemedText>
        <ThemedText type="small" themeColor="textHint" style={styles.kanjiBadge}>
          {kanji}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.levelBlurb}>
        {blurb}
      </ThemedText>
      <View style={viewMode === 'grid' ? styles.productGrid : styles.productList}>
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} colors={colors} viewMode={viewMode} />
        ))}
      </View>
    </View>
  );
}

const TOGGLE_SEGMENTS: { value: ViewMode; Icon: React.ComponentType<{ size: number; color: string }>; label: string }[] = [
  { value: 'list', Icon: FiList, label: 'List' },
  { value: 'grid', Icon: FiGrid, label: 'Grid' },
];
const TOGGLE_TRACK_WIDTH = 88;
const TOGGLE_PADDING = 2;
const TOGGLE_SEGMENT_WIDTH = (TOGGLE_TRACK_WIDTH - TOGGLE_PADDING * 2) / TOGGLE_SEGMENTS.length;

function ViewToggle({
  mode,
  onChange,
  colors,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
  colors: typeof Colors.light;
}) {
  const selectedIndex = TOGGLE_SEGMENTS.findIndex((s) => s.value === mode);
  const pillX = useSharedValue(selectedIndex * TOGGLE_SEGMENT_WIDTH);

  useEffect(() => {
    pillX.value = withSpring(selectedIndex * TOGGLE_SEGMENT_WIDTH, {
      damping: 18,
      stiffness: 220,
      mass: 0.6,
    });
  }, [selectedIndex, pillX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  return (
    <View style={styles.toggleColumn}>
      <View style={[styles.toggleTrack, { width: TOGGLE_TRACK_WIDTH, borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
        <Animated.View
          style={[
            styles.togglePill,
            { backgroundColor: Accent.base, width: TOGGLE_SEGMENT_WIDTH },
            pillStyle,
          ]}
        />
        {TOGGLE_SEGMENTS.map((seg) => {
          const isActive = seg.value === mode;
          const { Icon } = seg;
          return (
            <Pressable
              key={seg.value}
              onPress={() => onChange(seg.value)}
              accessibilityLabel={`${seg.label} view`}
              // @ts-ignore web tooltip
              title={`${seg.label} view`}
              style={styles.toggleSegment}>
              <Icon size={14} color={isActive ? '#ffffff' : colors.textSecondary} />
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="small" themeColor="textHint" style={styles.toggleHint}>
        View: {mode === 'list' ? 'List' : 'Grid'}
      </ThemedText>
    </View>
  );
}

function ProductCard({
  product,
  colors,
  featured,
  viewMode,
}: {
  product: Product;
  colors: typeof Colors.light;
  featured?: boolean;
  viewMode: ViewMode;
}) {
  const isFree = product.price === 0;
  const isStarter = product.slug === 'n5-starter';
  const { entitledSkus } = useAuth();
  const isOwned = product.grantsApp && entitledSkus.has(product.slug);

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        viewMode === 'grid' && styles.cardGrid,
        { borderColor: featured ? Accent.base : colors.border, borderWidth: featured ? 1.5 : 1 },
      ]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.cardTitleRow}>
            <ThemedText type="defaultSemiBold">{product.name}</ThemedText>
            {product.grantsApp ? (
              <View style={[styles.tag, { borderColor: Accent.base }]}>
                <FiSmartphone size={9} color={Accent.base} />
                <ThemedText type="small" style={[styles.tagText, { color: Accent.base }]}>
                  APP
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.tag, { borderColor: colors.border }]}>
                <FiFileText size={9} color={colors.textSecondary} />
                <ThemedText type="small" style={[styles.tagText, { color: colors.textSecondary }]}>
                  PDF
                </ThemedText>
              </View>
            )}
            {isOwned && (
              <View style={[styles.tag, { borderColor: Accent.base, backgroundColor: Accent.bg }]}>
                <FiCheck size={9} color={Accent.base} />
                <ThemedText type="small" style={[styles.tagText, { color: Accent.base }]}>
                  OWNED
                </ThemedText>
              </View>
            )}
          </View>
          {product.desc && (
            <ThemedText type="small" themeColor="textSecondary">
              {product.desc}
            </ThemedText>
          )}
        </View>
        <View style={styles.priceCol}>
          {product.was && (
            <ThemedText type="small" themeColor="textHint" style={styles.wasPrice}>
              ฿{product.was.toLocaleString()}
            </ThemedText>
          )}
          <ThemedText type="defaultSemiBold" style={[styles.price, isFree && { color: Accent.base }]}>
            {isFree ? 'FREE' : `฿${product.price.toLocaleString()}`}
          </ThemedText>
          {product.save && (
            <ThemedText type="small" style={{ color: Accent.base }}>
              ประหยัด ฿{product.save}
            </ThemedText>
          )}
        </View>
      </View>

      {isStarter ? (
        <View style={[styles.actionRow, { backgroundColor: colors.background }]}>
          <FiCheck size={14} color={colors.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">
            ใน Browse แล้ว · พร้อมเรียน
          </ThemedText>
        </View>
      ) : isOwned ? (
        <DownloadSection skuId={product.slug} colors={colors} />
      ) : (
        <BuyButton onPress={() => openExternal(buyUrl(product.slug))} />
      )}
    </ThemedView>
  );
}

type DownloadState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'cached' }
  | { kind: 'downloading'; loaded: number; total: number; fileIndex: number; fileCount: number }
  | { kind: 'error'; message: string };

function DownloadSection({ skuId, colors }: { skuId: string; colors: typeof Colors.light }) {
  const [state, setState] = useState<DownloadState>({ kind: 'checking' });
  const [saveAfter, setSaveAfter] = useState(false);
  const zips = getZipsForSku(skuId);

  useEffect(() => {
    let cancelled = false;
    void hasAllZipsForSku(skuId, zips).then(async (isCached) => {
      if (cancelled) return;
      if (isCached) {
        // Safety net: zip is cached from a prior version that didn't parse decks yet
        // (e.g., upgraded after Step 3b). Re-run import — fast (~50-200ms per zip).
        try {
          await importZipsForSku(skuId, zips);
        } catch (e) {
          console.warn('[shop] re-import failed', e);
        }
        if (!cancelled) setState({ kind: 'cached' });
      } else {
        setState({ kind: 'idle' });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [skuId, zips]);

  async function startDownload(opts?: { saveToDevice?: boolean }) {
    setSaveAfter(opts?.saveToDevice === true);
    setState({ kind: 'downloading', loaded: 0, total: 0, fileIndex: 0, fileCount: zips.length });
    const result = await downloadSku(skuId, (e: ProgressEvent) => {
      if (e.kind === 'file-progress') {
        setState({
          kind: 'downloading',
          loaded: e.loaded,
          total: e.total,
          fileIndex: e.index,
          fileCount: e.count,
        });
      }
    });
    if (result.ok) {
      setState({ kind: 'cached' });
      if (opts?.saveToDevice) await saveAllToDevice();
    } else {
      setState({ kind: 'error', message: result.error });
    }
  }

  async function saveAllToDevice() {
    for (const z of zips) {
      await saveZipToDevice(z);
      // Tiny gap so the browser shows separate save prompts cleanly
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (state.kind === 'checking') {
    return (
      <View style={[styles.actionRow, { backgroundColor: colors.background }]}>
        <ThemedText type="small" themeColor="textSecondary">กำลังตรวจสอบ…</ThemedText>
      </View>
    );
  }

  if (state.kind === 'cached') {
    const saveLabel = zips.length > 1 ? `บันทึก ${zips.length} ไฟล์ลงเครื่อง` : 'บันทึก .zip ลงเครื่อง';
    return (
      <View style={{ gap: Spacing.two }}>
        <Animated.View
          entering={FadeIn.duration(280).easing(Easing.bezier(0.4, 0, 0.2, 1))}
          style={[styles.actionRow, styles.cachedBadge, { backgroundColor: Accent.bg, borderColor: Accent.soft }]}>
          <FiCheckCircle size={16} color={Accent.base} strokeWidth={2.5} />
          <ThemedText type="defaultSemiBold" style={{ color: Accent.base, fontSize: 13 }}>
            ดาวน์โหลดแล้ว · พร้อมใช้ในแอป
          </ThemedText>
        </Animated.View>
        <View style={styles.cachedActionsRow}>
          <Pressable
            onPress={saveAllToDevice}
            style={({ pressed }) => [styles.reDownloadLink, pressed && { opacity: 0.7 }]}>
            <FiHardDrive size={11} color={colors.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">{saveLabel}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => startDownload()}
            style={({ pressed }) => [styles.reDownloadLink, pressed && { opacity: 0.7 }]}>
            <FiRefreshCw size={11} color={colors.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">ดาวน์โหลดซ้ำ</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (state.kind === 'downloading') {
    const pct = state.total > 0 ? Math.round((state.loaded / state.total) * 100) : 0;
    return (
      <View style={{ gap: Spacing.two }}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: Accent.base }]} />
        </View>
        <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
          {saveAfter ? 'ดาวน์โหลด + บันทึกลงเครื่อง' : 'ดาวน์โหลด'} · ไฟล์ {state.fileIndex + 1}/{state.fileCount} · {pct}%
        </ThemedText>
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={{ gap: Spacing.two }}>
        <View style={[styles.actionRow, { backgroundColor: colors.background }]}>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
            ❌ {state.message}
          </ThemedText>
        </View>
        <DownloadButton onPress={() => startDownload()} label="ลองอีกครั้ง" />
      </View>
    );
  }

  // idle — first time after purchase: celebrate the unlock, then offer choice
  return (
    <Animated.View
      entering={FadeIn.duration(280).easing(Easing.bezier(0.4, 0, 0.2, 1))}
      style={{ gap: Spacing.two }}>
      <View style={styles.unlockedHint}>
        <FiCheckCircle size={12} color={Accent.base} strokeWidth={2.5} />
        <ThemedText type="small" style={{ color: Accent.base, fontWeight: '600' }}>
          ปลดล็อกแล้ว · พร้อมดาวน์โหลด
        </ThemedText>
      </View>
      <PrimaryDownloadButton onPress={() => startDownload()} />
      <Pressable
        onPress={() => startDownload({ saveToDevice: true })}
        style={({ pressed }) => [styles.reDownloadLink, pressed && { opacity: 0.7 }]}>
        <FiHardDrive size={11} color={colors.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          หรือ บันทึกลงเครื่องด้วย
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

function PrimaryDownloadButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: Easing.back(1.4) }); }}
        style={({ pressed }) => [
          styles.primaryDownloadBtn,
          { backgroundColor: Accent.base, opacity: pressed ? 0.92 : 1 },
        ]}>
        <FiDownloadCloud size={18} color="#fff" strokeWidth={2.2} />
        <View style={{ alignItems: 'center' }}>
          <ThemedText type="defaultSemiBold" style={styles.primaryDownloadBtnLabel}>
            ดาวน์โหลด · เปิดในแอป
          </ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function DownloadButton({ onPress, label }: { onPress: () => void; label?: string }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: Easing.back(1.4) }); }}
        style={({ pressed }) => [
          styles.buyBtn,
          { backgroundColor: Accent.base, opacity: pressed ? 0.88 : 1 },
        ]}>
        <FiDownload size={14} color="#fff" />
        <ThemedText type="defaultSemiBold" style={styles.buyBtnLabel}>
          {label ?? 'ดาวน์โหลด'}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

function BuyButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { scale.value = withTiming(0.97, { duration: 90, easing: Easing.bezier(0.4, 0, 0.2, 1) }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: Easing.back(1.4) }); }}
        style={({ pressed }) => [
          styles.buyBtn,
          { backgroundColor: Accent.base, opacity: pressed ? 0.88 : 1 },
        ]}>
        <ThemedText type="defaultSemiBold" style={styles.buyBtnLabel}>
          ซื้อที่ Payhip
        </ThemedText>
        <FiExternalLink size={12} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%' },
  scroll: { flex: 1, width: '100%' },
  scrollOuter: { alignItems: 'center' },
  scrollInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    paddingTop: Spacing.six + Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.five,
  },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nudgeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
    marginBottom: Spacing.three,
  },
  toggleColumn: { alignItems: 'flex-end', gap: 2 },
  toggleTrack: {
    flexDirection: 'row',
    height: 32,
    borderRadius: Radii.sm,
    borderWidth: 1,
    padding: 2,
    position: 'relative',
  },
  togglePill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    left: 2,
    borderRadius: 2,
  },
  toggleSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  toggleHint: { fontSize: 11, letterSpacing: 0.5 },
  levelSection: { gap: Spacing.two },
  bundlesSection: { gap: Spacing.two, marginTop: Spacing.three },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rule: { width: 28, height: 2 },
  sectionTitle: { fontSize: 18, letterSpacing: 1.5 },
  kanjiBadge: { fontSize: 16, marginLeft: Spacing.one },
  levelBlurb: { marginLeft: 36, marginBottom: Spacing.one },
  bundleBlurb: { marginLeft: 36, marginBottom: Spacing.one },
  productList: { gap: Spacing.three },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  card: {
    padding: Spacing.three,
    borderRadius: Radii.md,
    gap: Spacing.three,
  },
  cardGrid: {
    flexBasis: '48%' as any,
    flexGrow: 1,
    minWidth: 240,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  tagText: { fontSize: 9, letterSpacing: 0.8 },
  priceCol: { alignItems: 'flex-end', gap: 1 },
  wasPrice: { textDecorationLine: 'line-through' },
  price: { fontSize: 18 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    alignSelf: 'flex-start',
  },
  cachedBadge: {
    borderWidth: 1,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    shadowColor: '#e0202c',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  buyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.sm,
  },
  buyBtnLabel: { color: '#fff' },
  unlockedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  primaryDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three + 2,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.sm,
    shadowColor: '#e0202c',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryDownloadBtnLabel: {
    color: '#fff',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  progressTrack: {
    height: 6,
    borderRadius: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  reDownloadLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    alignSelf: 'flex-start',
  },
  cachedActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
  },
  landingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    marginTop: Spacing.four,
  },
});
