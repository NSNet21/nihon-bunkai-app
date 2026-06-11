import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { FiCheck, FiCheckCircle, FiDownload, FiDownloadCloud, FiExternalLink, FiFileText, FiGrid, FiHardDrive, FiHelpCircle, FiList, FiRefreshCw, FiSmartphone, FiZap } from 'react-icons/fi';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PressableScale } from '@/components/pressable-scale';
import { ScrollToTop } from '@/components/scroll-to-top';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/components/toast';
import { useAuth } from '@/context/auth';
import { useThemePalette } from '@/context/theme';
import { useHasHydrated } from '@/hooks/use-has-hydrated';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { Accent, BottomTabInset, Colors, MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { bundles, buyUrl, LANDING_URL, perLevel, type Product } from '@/data/products';
import { hasPdfPart, isSkuOwned, PAYHIP_ACCOUNT_URL } from '@/data/sku-coverage';
import { getZipsForSku } from '@/data/sku-zips';
import { downloadSku, type ProgressEvent } from '@/lib/download';
import { importZipsForSku } from '@/lib/deck-import';
import { hasAllZipsForSku, saveZipToDevice } from '@/lib/download-store';

const SCROLL_TOP_THRESHOLD = 400;
const SUPPORT_EMAIL = 'hi@nihon-bunkai.com';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('ซื้อแล้วแต่ไม่เห็นในแอป')}&body=${encodeURIComponent('สวัสดีครับ\n\nเลขที่ออเดอร์ Payhip: \nEmail ที่ใช้ซื้อ: \nสินค้าที่ซื้อ: \nEmail ในแอปนี้: \n\nรายละเอียดเพิ่มเติม:\n')}`;
const BUYING_TIMEOUT_MS = 5 * 60 * 1000; // 5 min auto-revert if no entitlement received

type BuyingState = {
  startedAt: number;
  productName: string;
};

type BuyingContextValue = {
  buying: Record<string, BuyingState>;
  startBuying: (slug: string, productName: string) => void;
  cancelBuying: (slug: string) => void;
};

const BuyingContext = createContext<BuyingContextValue | null>(null);

function useBuyingContext(): BuyingContextValue {
  const ctx = useContext(BuyingContext);
  if (!ctx) throw new Error('useBuyingContext must be used inside <BuyingContext.Provider>');
  return ctx;
}

function openExternal(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    void Linking.openURL(url);
  }
}

type ViewMode = 'list' | 'grid';
type ShopTier = 'level' | 'bundle';

export default function ShopScreen() {
  const params = useLocalSearchParams<{ scrollTop?: string }>();
  const colors = useThemePalette();
  const [viewMode, setViewMode] = usePersistedState<ViewMode>('shop-view-mode', 'list');
  const [shopTier, setShopTier] = usePersistedState<ShopTier>('shop-tier', 'level');
  /* Grid only renders meaningfully when ≥2 cards fit per row. Card
     minWidth = 240, gap = 12, container padding ~32 → grid needs ~520px
     inner width = ~600px viewport. Below that, grid collapses to a single
     column and looks identical to list — confusing toggle UX. Hide the
     toggle + force list on narrow viewports.

     Hydration gate via `hasHydrated`: SSR has width = 0 → 'list', client
     first paint on desktop would compute 'grid' → element-tree mismatch
     (bundleGrid vs productList + ProductCard layout differs). React
     #418 fires + discards the sub-tree. Stay on 'list' until mount
     commits, then re-render to the actual viewport-derived mode. See
     [[hydration-fix-as-perf-win]]. */
  const hasHydrated = useHasHydrated();
  const { width: viewportW } = useWindowDimensions();
  const showViewToggle = hasHydrated && viewportW >= 600;
  const effectiveViewMode: ViewMode = showViewToggle ? viewMode : 'list';
  const { status, entitledSkus } = useAuth();
  const router = useRouter();
  const { showToast } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const scrollTopParam = Array.isArray(params.scrollTop) ? params.scrollTop[0] : params.scrollTop;
  const [showScrollTop, setShowScrollTop] = useState(false);
  // SKUs that the user just clicked "Buy" on — awaiting webhook confirmation
  const [buying, setBuying] = useState<Record<string, BuyingState>>({});
  const prevEntitledRef = useRef<Set<string>>(new Set(entitledSkus));

  useEffect(() => {
    if (!scrollTopParam) return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      setShowScrollTop(false);
    }, 0);
    return () => clearTimeout(id);
  }, [scrollTopParam]);

  const startBuying = useCallback((slug: string, productName: string) => {
    setBuying((prev) => ({ ...prev, [slug]: { startedAt: Date.now(), productName } }));
    openExternal(buyUrl(slug));
  }, []);

  const cancelBuying = useCallback((slug: string) => {
    setBuying((prev) => {
      const { [slug]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Toast on new entitlement (covers Realtime + on-focus + Restore paths uniformly)
  useEffect(() => {
    const prev = prevEntitledRef.current;
    const newlyGranted: string[] = [];
    for (const sku of entitledSkus) {
      if (!prev.has(sku)) newlyGranted.push(sku);
    }
    if (newlyGranted.length > 0) {
      for (const sku of newlyGranted) {
        const pendingMeta = buying[sku];
        const label = pendingMeta?.productName ?? sku;
        showToast(`🎉 ซื้อสำเร็จ! ${label} ปลดล็อกแล้ว`, { kind: 'success', durationMs: 4500 });
      }
      // Clear buying for granted SKUs
      setBuying((prev) => {
        const next = { ...prev };
        for (const sku of newlyGranted) delete next[sku];
        return next;
      });
    }
    prevEntitledRef.current = new Set(entitledSkus);
  }, [entitledSkus, buying, showToast]);

  // Auto-revert buying state after timeout (5 min) if no entitlement arrived
  useEffect(() => {
    if (Object.keys(buying).length === 0) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setBuying((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [slug, state] of Object.entries(prev)) {
          if (now - state.startedAt > BUYING_TIMEOUT_MS) {
            delete next[slug];
            changed = true;
            showToast(
              `ยังไม่ได้รับข้อมูลการซื้อ ${state.productName} · กด อัพเดทการซื้อ ใน Settings`,
              { kind: 'info', durationMs: 6000 },
            );
          }
        }
        return changed ? next : prev;
      });
    }, 30_000); // poll every 30s
    return () => clearInterval(interval);
  }, [buying, showToast]);

  const buyingApi: BuyingContextValue = { buying, startBuying, cancelBuying };

  return (
    <BuyingContext.Provider value={buyingApi}>
    <ThemedView style={styles.container}>
      {/* Ghost kanji 価 — sticky background decoration, sits OUTSIDE the
          ScrollView so it stays fixed while content scrolls. Mirrors the
          Browse / Search / Settings pattern. Muted hint color so the
          secondary surface doesn't compete with Browse's crimson 学. */}
      <ThemedText style={[styles.shopGhostKanji, { color: colors.textHint }]}>
        価
      </ThemedText>
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
          {/* Editorial brutalism header — mirrors design/handoff-app Screen 11.
              Ghost kanji "価" now sits at ThemedView root (sticky bg);
              kicker line + display type + sub copy carry the
              "content-based pricing" framing. View toggle moves into the
              meta row to keep the headline clean. */}
          <View style={styles.shopHero}>
            <View style={styles.shopKickerRow}>
              <View style={[styles.shopPip, { backgroundColor: Accent.base }]} />
              <ThemedText style={[styles.shopKicker, { color: colors.textMuted }]}>
                // CONTENT-BASED · จ่ายตามใช้
              </ThemedText>
              {showViewToggle && (
                <View style={{ marginLeft: 'auto' }}>
                  <ViewToggle mode={viewMode} onChange={setViewMode} colors={colors} />
                </View>
              )}
            </View>
            <ThemedText style={[styles.shopHeadline, { color: colors.text }]}>
              จ่าย{'\n'}
              <ThemedText style={[styles.shopHeadline, { color: Accent.base }]}>เท่าที่ใช้.</ThemedText>
            </ThemedText>
            <ThemedText style={[styles.shopHeroSub, { color: colors.textMuted }]}>
              ไม่มีรายเดือน · จ่ายครั้งเดียวเฉพาะ pack ที่ต้องการ
            </ThemedText>
            <ThemedText style={[styles.shopHeroSub, { color: colors.textHint, marginTop: 2 }]}>
              ราคาเดียวกับ landing · เช็คเอาท์ผ่าน Payhip
            </ThemedText>
          </View>

          {/* Tier filter — PER LEVEL / BUNDLE. Mirrors Screen 11's segmented
              control. Persisted so a user who only cares about bundles
              doesn't see 17 SKUs every visit. */}
          <TierFilter tier={shopTier} onChange={setShopTier} colors={colors} />

          {status === 'signed-out' && (
            <PressableScale
              onPress={() => router.push('/login')}
              style={[
                styles.nudgeBanner,
                { borderColor: Accent.base, backgroundColor: Accent.bg },
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
            </PressableScale>
          )}

          {shopTier === 'level' && perLevel.map((group) => (
            <LevelSection
              key={group.level}
              level={group.level}
              kanji={group.kanji}
              blurb={group.blurb}
              products={group.products}
              colors={colors}
              viewMode={effectiveViewMode}
            />
          ))}

          {shopTier === 'bundle' && (
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
              {/* Bundle display ADAPTS to the page viewMode toggle:
                  - LIST mode → vertical stack (1 per row)
                  - GRID mode → PDF + Full side-by-side when space allows.
                  Cards get `fillHeight` so the slot's stretched height
                  propagates into the card — keeps PDF + Full at
                  matching heights even when PDF's spec-chips wrap to
                  multiple lines. */}
              {effectiveViewMode === 'grid' ? (
                <View style={styles.bundleGrid}>
                  {bundles.map((p, idx) => {
                    return (
                      <Animated.View
                        key={p.slug}
                        entering={staggerEnter(idx)}
                        style={styles.bundleSlotHalf}>
                        <ProductCard
                          product={p}
                          colors={colors}
                          featured={p.slug === 'full-bundle'}
                          viewMode="list"
                          fillHeight
                        />
                      </Animated.View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.productList}>
                  {bundles.map((p, idx) => (
                    <Animated.View key={p.slug} entering={staggerEnter(idx)}>
                      <ProductCard
                        product={p}
                        colors={colors}
                        featured={p.slug === 'full-bundle'}
                        viewMode="list"
                      />
                    </Animated.View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.footerLinks}>
            <Pressable onPress={() => openExternal(LANDING_URL)} style={styles.landingLink}>
              <FiExternalLink size={14} color={colors.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                ดูเต็มที่ landing page
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => openExternal(PAYHIP_ACCOUNT_URL)} style={styles.landingLink}>
              <FiFileText size={14} color={colors.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                ตรวจสอบการซื้อที่ Payhip · My Purchases
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => openExternal(SUPPORT_MAILTO)} style={styles.landingLink}>
              <FiHelpCircle size={14} color={colors.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">
                ซื้อแล้วแต่ไม่เห็น? · ติดต่อเรา
              </ThemedText>
            </Pressable>
          </View>
         </View>
        </ScrollView>
      </SafeAreaView>
      <ScrollToTop
        visible={showScrollTop}
        onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
      />
    </ThemedView>
    </BuyingContext.Provider>
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
        {products.map((p, idx) => (
          <Animated.View key={p.slug} entering={staggerEnter(idx)}>
            <ProductCard product={p} colors={colors} viewMode={viewMode} />
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

/* Round-5 P2 stagger helper — GPT round-4 "stagger list enter · YES
   แต่ subtle มาก · 50ms stagger max". Caps at 10 steps so a long
   list never exceeds ~500ms total. Re-mounting (tier toggle ↔ pack
   import) re-fires the cascade for a soft transition. */
const STAGGER_STEP_MS = 50;
const STAGGER_CAP = 10;
function staggerEnter(idx: number) {
  return FadeIn.duration(180).delay(Math.min(idx, STAGGER_CAP) * STAGGER_STEP_MS);
}

const TOGGLE_SEGMENTS: { value: ViewMode; Icon: React.ComponentType<{ size: number; color: string }>; label: string }[] = [
  { value: 'list', Icon: FiList, label: 'List' },
  { value: 'grid', Icon: FiGrid, label: 'Grid' },
];
const TOGGLE_TRACK_WIDTH = 88;
const TOGGLE_PADDING = 2;
const TOGGLE_SEGMENT_WIDTH = (TOGGLE_TRACK_WIDTH - TOGGLE_PADDING * 2) / TOGGLE_SEGMENTS.length;

/* Web-only CSS transition for the pill — compositor-thread animation
   that handles rapid retargeting smoothly (browser cancels/restarts
   on its own). See theme-toggle.tsx for the full rationale. */
const TOGGLE_PILL_TRANSITION = Platform.select({
  web: {
    transitionProperty: 'transform',
    transitionDuration: '180ms',
    transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  } as object,
  default: undefined,
});

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

  return (
    <View style={styles.toggleColumn}>
      <View style={[styles.toggleTrack, { width: TOGGLE_TRACK_WIDTH, borderColor: colors.border, backgroundColor: colors.backgroundElement }]}>
        <View
          style={[
            styles.togglePill,
            {
              backgroundColor: Accent.base,
              width: TOGGLE_SEGMENT_WIDTH,
              transform: [{ translateX: selectedIndex * TOGGLE_SEGMENT_WIDTH }],
            },
            TOGGLE_PILL_TRANSITION,
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

/* ── Tier filter (PER LEVEL · BUNDLE) ────────────────────────────────────
   Segmented control mirroring Screen 11 of the design handoff. Persisted
   so a returning user lands on whichever tier they used last. Uses the
   same web-CSS-transition pill pattern as ViewToggle/LanguageToggle —
   compositor-thread animation, no Reanimated cost. */

const TIER_SEGMENTS: { value: ShopTier; label: string; sub: string }[] = [
  { value: 'level',  label: 'PER LEVEL', sub: 'แยกระดับ' },
  { value: 'bundle', label: 'BUNDLE',    sub: 'ชุดรวม' },
];

const TIER_TRACK_WIDTH = 248;
const TIER_PILL_PAD = 2;
const TIER_SEGMENT_WIDTH = (TIER_TRACK_WIDTH - TIER_PILL_PAD * 2) / TIER_SEGMENTS.length;

const TIER_PILL_TRANSITION = Platform.select({
  web: {
    transitionProperty: 'transform',
    transitionDuration: '180ms',
    transitionTimingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  } as object,
  default: undefined,
});

function TierFilter({
  tier,
  onChange,
  colors,
}: {
  tier: ShopTier;
  onChange: (next: ShopTier) => void;
  colors: typeof Colors.light;
}) {
  const rawIndex = TIER_SEGMENTS.findIndex((s) => s.value === tier);
  const selectedIndex = rawIndex < 0 ? 0 : rawIndex;

  return (
    <View
      style={[
        styles.tierTrack,
        { borderColor: colors.border, backgroundColor: colors.backgroundElement },
      ]}>
      <View
        style={[
          styles.tierPill,
          {
            backgroundColor: Accent.base,
            width: TIER_SEGMENT_WIDTH - 4,
            transform: [{ translateX: selectedIndex * TIER_SEGMENT_WIDTH }],
          },
          TIER_PILL_TRANSITION,
        ]}
      />
      {TIER_SEGMENTS.map((seg) => {
        const active = seg.value === tier;
        const fg = active ? '#fff' : colors.text;
        return (
          <Pressable
            key={seg.value}
            onPress={() => onChange(seg.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`เลือก ${seg.label}`}
            style={({ pressed }) => [styles.tierSegment, pressed && { opacity: 0.85 }]}>
            <ThemedText style={[styles.tierLabel, { color: fg }]}>
              {seg.label}
            </ThemedText>
            <ThemedText style={[styles.tierSub, { color: active ? '#fff' : colors.textHint }]}>
              {seg.sub}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ProductCard({
  product,
  colors,
  featured,
  viewMode,
  fillHeight,
}: {
  product: Product;
  colors: typeof Colors.light;
  featured?: boolean;
  viewMode: ViewMode;
  /** When true, the card root takes `flex: 1` so it fills its parent
   *  flex slot's stretched height. Used by the bundle 2+1 grid to
   *  keep PDF + Full Bundle at matching heights regardless of the
   *  spec-chips wrap count. */
  fillHeight?: boolean;
}) {
  const isFree = product.price === 0;
  const isStarter = product.slug === 'n5-starter';
  const { entitledSkus } = useAuth();
  const { buying, startBuying, cancelBuying } = useBuyingContext();
  // Ownership includes coverage via bundle SKUs (e.g. Full Bundle covers n4-pdf, n4-csv, n4-bundle).
  const isOwned = !isFree && isSkuOwned(product.slug, entitledSkus);
  const canDownloadInApp = isOwned && product.grantsApp;
  const showPdfHint = isOwned && hasPdfPart(product.slug);
  const isBuying = !!buying[product.slug];
  /* Round-5 retake — PDF Bundle keeps the N5/N4/N3/N2/N1/OFFLINE ARCHIVE
     spec-chip grid per user preference 2026-05-28. The full Round-5 P1
     bundle differentiation was reverted (cd8b345) but this one piece
     was the part the user actually liked, so it's re-added in isolation
     without the Featured padding bump. */
  const isPdfBundle = product.type === 'pdf-bundle';

  return (
    <ThemedView
      type="backgroundElement"
      style={[
        styles.card,
        viewMode === 'grid' && styles.cardGrid,
        fillHeight && styles.cardFill,
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
            {/* FREE chip mirrors OWNED treatment per round-3 verdict P1
                "Add micro-state labels". Price col still shows "FREE"
                but the title-row chip aligns N5 starter visually with
                paid SKUs that carry OWNED. */}
            {isFree && !isOwned && (
              <View style={[styles.tag, { borderColor: colors.border }]}>
                <ThemedText type="small" style={[styles.tagText, { color: colors.textSecondary }]}>
                  FREE
                </ThemedText>
              </View>
            )}
          </View>
          {isPdfBundle ? (
            <View style={styles.specGrid}>
              {['N5', 'N4', 'N3', 'N2', 'N1'].map((lvl) => (
                <View key={lvl} style={[styles.specChip, { borderColor: colors.border }]}>
                  <ThemedText style={[styles.specChipText, { color: colors.textSecondary }]}>
                    {lvl}
                  </ThemedText>
                </View>
              ))}
              <View style={[styles.specChip, { borderColor: colors.border }]}>
                <ThemedText style={[styles.specChipText, { color: colors.textSecondary }]}>
                  OFFLINE ARCHIVE
                </ThemedText>
              </View>
            </View>
          ) : (
            product.desc && (
              <ThemedText type="small" themeColor="textSecondary">
                {product.desc}
              </ThemedText>
            )
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
        <View style={{ gap: Spacing.three }}>
          {canDownloadInApp && <DownloadSection skuId={product.slug} colors={colors} />}
          {showPdfHint && <PdfHint colors={colors} alone={!canDownloadInApp} />}
        </View>
      ) : isBuying ? (
        <BuyingPendingBanner
          productName={product.name}
          onCancel={() => cancelBuying(product.slug)}
          onReopen={() => openExternal(buyUrl(product.slug))}
          colors={colors}
        />
      ) : (
        <BuyButton onPress={() => startBuying(product.slug, product.name)} />
      )}
    </ThemedView>
  );
}

function BuyingPendingBanner({
  productName,
  onCancel,
  onReopen,
  colors,
}: {
  productName: string;
  onCancel: () => void;
  onReopen: () => void;
  colors: typeof Colors.light;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(220).easing(Easing.bezier(0.4, 0, 0.2, 1))}
      style={{ gap: Spacing.two }}>
      <View style={[styles.pendingBanner, { borderColor: Accent.soft, backgroundColor: Accent.bg }]}>
        <Animated.View
          entering={FadeIn.duration(220)}
          style={styles.pendingDot} />
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText type="defaultSemiBold" style={{ color: Accent.base, fontSize: 13 }}>
            กำลังตรวจสอบการซื้อ…
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
            จ่ายเงินที่ Payhip แล้วกลับมา · จะ unlock ภายในไม่กี่วินาที
          </ThemedText>
        </View>
      </View>
      <View style={styles.pendingActions}>
        <Pressable
          onPress={onReopen}
          style={({ pressed }) => [styles.reDownloadLink, pressed && { opacity: 0.7 }]}>
          <FiExternalLink size={11} color={colors.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary">เปิด Payhip อีกครั้ง</ThemedText>
        </Pressable>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [styles.reDownloadLink, pressed && { opacity: 0.7 }]}>
          <ThemedText type="small" themeColor="textSecondary">ยกเลิก</ThemedText>
        </Pressable>
      </View>
    </Animated.View>
  );
}

function PdfHint({ colors, alone }: { colors: typeof Colors.light; alone: boolean }) {
  return (
    <Pressable
      onPress={() => openExternal(PAYHIP_ACCOUNT_URL)}
      style={({ pressed }) => [
        styles.pdfHint,
        {
          borderColor: alone ? Accent.soft : colors.border,
          backgroundColor: alone ? Accent.bg : 'transparent',
        },
        pressed && { opacity: 0.7 },
      ]}>
      <FiFileText size={14} color={alone ? Accent.base : colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <ThemedText
          type={alone ? 'defaultSemiBold' : 'small'}
          style={{ color: alone ? Accent.base : colors.text, fontSize: alone ? 13 : 12 }}>
          {alone ? 'PDF อยู่ที่ Payhip · My Purchases' : 'PDF อยู่ที่ Payhip email หรือ My Purchases'}
        </ThemedText>
        {alone && (
          <ThemedText type="small" themeColor="textSecondary" style={{ fontSize: 11 }}>
            เปิดหน้า Payhip account เพื่อโหลด PDF
          </ThemedText>
        )}
      </View>
      <FiExternalLink size={12} color={alone ? Accent.base : colors.textSecondary} />
    </Pressable>
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
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }); }}
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
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }); }}
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
        onPressOut={() => { scale.value = withTiming(1, { duration: 220, easing: Easing.bezier(0.34, 1.56, 0.64, 1) }); }}
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
    /* Round-5 P0 section breathing — GPT verdict "ทุก row uniform เกิน ·
       scan ยากเมื่อยาว · เพิ่ม section breathing". Bumped from 24 → 32
       so each LevelSection / bundlesSection / nudge / footer sits in
       its own rhythm slot. Intra-section spacing stays compressed. */
    gap: Spacing.six,
  },
  header: { gap: Spacing.two, marginBottom: Spacing.two },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  /* Editorial hero — Screen 11 layout. Ghost kanji sits behind the
     headline as a faded backdrop; zIndex on foreground elements keeps
     the kicker/headline/sub above it. */
  shopHero: { gap: Spacing.two, marginBottom: Spacing.two, position: 'relative' },
  /* Sticky bg — anchored to ThemedView root so it doesn't scroll with
     the catalog. Original Shop scale (200) + muted textHint kept; only
     the stickiness changed vs the previous in-scroll placement. */
  shopGhostKanji: {
    position: 'absolute',
    top: 40,
    right: -20,
    fontFamily: Platform.select({ web: '"Noto Serif JP", serif', default: undefined }),
    fontSize: 200,
    lineHeight: 200,
    opacity: 0.04,
    zIndex: 0,
    pointerEvents: 'none',
  } as any,
  shopKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    zIndex: 1,
  },
  shopPip: {
    width: 6,
    height: 6,
    borderRadius: 1,
  },
  shopKicker: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  shopHeadline: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 44,
    lineHeight: 50,
    fontWeight: '700',
    letterSpacing: -1,
    zIndex: 1,
  },
  shopHeroSub: {
    fontSize: 12,
    lineHeight: 18,
    maxWidth: 460,
    zIndex: 1,
  },

  /* Tier filter sliding-pill segmented control. 2-line label (Oswald EN
     top + Sarabun TH sub) per GPT round-3 verdict — helps Thai users
     parse the segment fast without losing brand mono identity. */
  tierTrack: {
    width: TIER_TRACK_WIDTH,
    height: 48,
    flexDirection: 'row',
    borderRadius: Radii.sm,
    borderWidth: 1,
    padding: TIER_PILL_PAD,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  tierPill: {
    position: 'absolute',
    top: 2,
    bottom: 2,
    /* left = track padding (2) + intra-segment inset (2) so the pill
       sits centered inside its segment with 2px breathing room each
       side. Previously left=2 placed the pill flush against the inner
       area's left edge, which made the inactive segment's text look
       like its left padding was thinner than its right. */
    left: 4,
    borderRadius: 2,
  },
  /* Explicit height + centered flex column so main+sub label optically
     center as a group. Without explicit lineHeight, ThemedText inherits
     default 1.2-1.5x which makes inactive (longer Thai sub "ชุดรวม" vs
     "แยกระดับ") read mis-aligned against the active tab. */
  tierSegment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    gap: 4,
  },
  /* `marginRight: -letterSpacing` cancels the trailing letter-spacing
     that CSS appends after the last glyph. Without this, the text
     bounding box is wider than the visible glyphs by 1× letterSpacing,
     and flex centering puts the BOX center at segment center — leaving
     the visible glyphs shifted LEFT by letterSpacing / 2. Visible on
     the active pill because the pill is a tight box around the text. */
  tierLabel: {
    fontFamily: Platform.select({ web: '"Oswald", sans-serif', default: undefined }),
    fontSize: 11,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginRight: -1.4,
    textAlign: 'center',
  } as any,
  tierSub: {
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 0.4,
    marginRight: -0.4,
    textAlign: 'center',
  } as any,
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
  /* Bundle grid — PDF + Full Bundle side-by-side on wide viewports and
     gracefully wraps to a 1-per-row stack below ~600px. */
  bundleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    /* Explicit so RN-Web's flex-wrap doesn't drop the stretch
       behavior the inner cards rely on for equal-height. */
    alignItems: 'stretch',
  },
  bundleSlotHalf: {
    flexBasis: '48%' as any,
    flexGrow: 1,
    minWidth: 240,
    alignSelf: 'stretch',
  },
  /* PDF Bundle level-spec chips — re-added 2026-05-28 (per user
     "icon pdf n5-n1 ที่ใส่มาใหม่ เท่ดี"). Row of tiny mono pills
     replacing the free-form desc on the PDF Bundle only. */
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  specChip: {
    borderWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  specChipText: {
    fontFamily: Platform.select({ web: '"JetBrains Mono", monospace', default: undefined }),
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '600',
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
  /* Stretch the card's root to fill its parent slot's height — used
     in the bundle 2+1 grid so PDF + Full Bundle stay matched even
     when one has more vertical content (e.g. spec chips wrap). */
  cardFill: {
    flex: 1,
    alignSelf: 'stretch',
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
    boxShadow: '0 2px 10px rgba(224, 32, 44, 0.18)',
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
    boxShadow: '0 3px 12px rgba(224, 32, 44, 0.30)',
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
  pdfHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.sm,
    borderWidth: 1,
  },
  pendingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e0202c',
  },
  pendingActions: {
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
  },
  footerLinks: {
    flexDirection: 'column',
    gap: Spacing.one,
    marginTop: Spacing.four,
  },
});
