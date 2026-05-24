import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { FiCheck, FiExternalLink, FiFileText, FiGrid, FiList, FiSmartphone, FiZap } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { ScrollToTop } from '@/components/scroll-to-top';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { bundles, buyUrl, LANDING_URL, perLevel, type Product } from '@/data/products';

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
  const { status } = useAuth();
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
      ) : (
        <BuyButton onPress={() => openExternal(buyUrl(product.slug))} />
      )}
    </ThemedView>
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
  landingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    marginTop: Spacing.four,
  },
});
