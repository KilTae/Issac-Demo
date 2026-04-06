import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Animated,
} from 'react-native';

// ── 타입 ─────────────────────────────────────────────────────────────────────
type StrikeOption = {
  strike: number;
  type: 'ITM' | 'ATM' | 'OTM';
  ask: number;
  delta: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  stockName: string;
  stockCode: string;
  stockPrice: number;
  selectedRow: {
    strike: number;
    callAsk: number;
    callDelta: number;
  } | null;
};

// ── 더미 행사가 옵션 ──────────────────────────────────────────────────────────
const STRIKE_OPTIONS: StrikeOption[] = [
  {strike: 70000, type: 'ITM', ask: 4800, delta: 0.71},
  {strike: 73800, type: 'ATM', ask: 2550, delta: 0.52},
  {strike: 75000, type: 'OTM', ask: 1560, delta: 0.38},
  {strike: 77000, type: 'OTM', ask: 880,  delta: 0.24},
];

const EXPIRY_DATES = [
  {label: '3/14', days: '10일'},
  {label: '3/28', days: '24일'},
  {label: '4/11', days: '38일'},
];

const STRATEGY_TABS = ['커버드콜 헤도', '포지션 정산', '롤오버'];

// ── 전략 요약 계산 ────────────────────────────────────────────────────────────
const calcSummary = (ask: number, qty: number) => {
  const premium = ask * qty * 100;
  const breakeven = 75000 - ask;
  const annualReturn = ((ask / 75000) * 12 * 100).toFixed(1);
  return {premium, breakeven, annualReturn};
};

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────
const StrategyOrderModal: React.FC<Props> = ({
  visible,
  onClose,
  stockName,
  stockCode,
  stockPrice,
  selectedRow,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedStrike, setSelectedStrike] = useState<StrikeOption>(STRIKE_OPTIONS[2]);
  const [selectedExpiry, setSelectedExpiry] = useState(0);
  const [quantity, setQuantity] = useState('5');

  const qty = parseInt(quantity) || 1;
  const summary = calcSummary(selectedStrike.ask, qty);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* 핸들 */}
          <View style={styles.handle} />

          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>전략 주문</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 탭 */}
          <View style={styles.tabRow}>
            {STRATEGY_TABS.map((tab, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.tab, activeTab === i && styles.tabActive]}
                onPress={() => setActiveTab(i)}>
                <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>

            {/* 종목 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>종목</Text>
              <View style={styles.stockRow}>
                <View style={styles.stockIcon}>
                  <Text style={styles.stockIconText}>삼</Text>
                </View>
                <Text style={styles.stockInfo}>
                  {stockName} ({stockCode}) · ₩{stockPrice.toLocaleString()}
                </Text>
              </View>
            </View>

            {/* 행사가 선택 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>행사가 선택</Text>
              <View style={styles.strikeRow}>
                {STRIKE_OPTIONS.map((opt, i) => {
                  const isSelected = selectedStrike.strike === opt.strike;
                  const isATM = opt.type === 'ATM';
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.strikeBtn,
                        isSelected && styles.strikeBtnSelected,
                        isATM && !isSelected && styles.strikeBtnATM,
                      ]}
                      onPress={() => setSelectedStrike(opt)}>
                      <Text
                        style={[
                          styles.strikeBtnType,
                          isSelected && styles.strikeBtnTypeSelected,
                          isATM && !isSelected && styles.strikeBtnTypeATM,
                        ]}>
                        {opt.type} {isATM && '★'}
                      </Text>
                      <Text
                        style={[
                          styles.strikeBtnValue,
                          isSelected && styles.strikeBtnValueSelected,
                        ]}>
                        {opt.strike.toLocaleString()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.selectedStrikeInfo}>
                <Text style={styles.selectedStrikeText}>
                  선택 ₩{selectedStrike.strike.toLocaleString()} {selectedStrike.type}
                </Text>
                <Text style={styles.selectedDelta}>
                  Delta {selectedStrike.delta.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* 만기일 & 수량 */}
            <View style={styles.rowTwo}>
              <View style={[styles.section, {flex: 1, marginRight: 8}]}>
                <Text style={styles.sectionLabel}>만기일</Text>
                <View style={styles.expiryBtnWrap}>
                  {EXPIRY_DATES.map((exp, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.expiryBtn,
                        selectedExpiry === i && styles.expiryBtnActive,
                      ]}
                      onPress={() => setSelectedExpiry(i)}>
                      <Text
                        style={[
                          styles.expiryBtnText,
                          selectedExpiry === i && styles.expiryBtnTextActive,
                        ]}>
                        {exp.label}
                      </Text>
                      <Text
                        style={[
                          styles.expiryBtnDays,
                          selectedExpiry === i && styles.expiryBtnTextActive,
                        ]}>
                        ({exp.days})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.section, {flex: 0.5}]}>
                <Text style={styles.sectionLabel}>수량 (계약)</Text>
                <View style={styles.qtyWrap}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() =>
                      setQuantity(String(Math.max(1, qty - 1)))
                    }>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={styles.qtyInput}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                    textAlign="center"
                  />
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setQuantity(String(qty + 1))}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 주문 요약 */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryIcon}>📋</Text>
                <Text style={styles.summaryTitle}>주문 요약</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>전략</Text>
                <Text style={styles.summaryValue}>
                  {STRATEGY_TABS[activeTab]}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>수령 프리미엄</Text>
                <Text style={styles.summaryValuePositive}>
                  +₩{summary.premium.toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>손익분기점</Text>
                <Text style={styles.summaryValueNeutral}>
                  ₩{summary.breakeven.toLocaleString()}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>연환산 수익률</Text>
                <Text style={styles.summaryValuePositive}>
                  +{summary.annualReturn}%
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* CTA 버튼 */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.orderBtn} onPress={onClose}>
              <Text style={styles.orderBtnText}>매도 주문 실행 →</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ── 스타일 ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#0A1628',
  sheet: '#0F1F35',
  card: '#0D1A2A',
  border: '#1E2D3D',
  blue: '#3B82F6',
  blueLight: '#60A5FA',
  green: '#10B981',
  white: '#FFFFFF',
  gray: '#8B9AB0',
  dim: '#4A5568',
  yellow: '#F59E0B',
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: C.sheet,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderColor: C.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.dim,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: {color: C.white, fontSize: 17, fontWeight: '700'},
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {color: C.gray, fontSize: 13, fontWeight: '600'},

  // 탭
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: C.card,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  tabActive: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderColor: C.blue,
  },
  tabText: {color: C.dim, fontSize: 12, fontWeight: '500'},
  tabTextActive: {color: C.blueLight, fontWeight: '700'},

  scroll: {flex: 1},
  scrollContent: {paddingHorizontal: 16, paddingBottom: 8},

  // 섹션
  section: {marginBottom: 16},
  sectionLabel: {
    color: C.gray,
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: 0.3,
  },

  // 종목
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    gap: 10,
  },
  stockIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockIconText: {color: C.blueLight, fontSize: 13, fontWeight: '700'},
  stockInfo: {color: C.white, fontSize: 13, fontWeight: '500'},

  // 행사가
  strikeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  strikeBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  strikeBtnATM: {
    borderColor: C.yellow,
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  strikeBtnSelected: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  strikeBtnType: {color: C.dim, fontSize: 10, fontWeight: '600', marginBottom: 4},
  strikeBtnTypeATM: {color: C.yellow},
  strikeBtnTypeSelected: {color: 'rgba(255,255,255,0.8)'},
  strikeBtnValue: {color: C.white, fontSize: 13, fontWeight: '700'},
  strikeBtnValueSelected: {color: C.white},
  selectedStrikeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  selectedStrikeText: {color: C.gray, fontSize: 12},
  selectedDelta: {color: C.blueLight, fontSize: 12, fontWeight: '600'},

  // 만기일 & 수량 2열
  rowTwo: {flexDirection: 'row', marginBottom: 0},
  expiryBtnWrap: {gap: 6},
  expiryBtn: {
    backgroundColor: C.card,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  expiryBtnActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderColor: C.blue,
  },
  expiryBtnText: {color: C.white, fontSize: 13, fontWeight: '600'},
  expiryBtnDays: {color: C.gray, fontSize: 11},
  expiryBtnTextActive: {color: C.blueLight},

  // 수량
  qtyWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 36,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  qtyBtnText: {color: C.blueLight, fontSize: 18, fontWeight: '400'},
  qtyInput: {
    flex: 1,
    color: C.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 10,
  },

  // 주문 요약
  summaryCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  summaryIcon: {fontSize: 15},
  summaryTitle: {color: C.white, fontSize: 14, fontWeight: '700'},
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {color: C.gray, fontSize: 13},
  summaryValue: {color: C.white, fontSize: 13, fontWeight: '600'},
  summaryValuePositive: {color: C.green, fontSize: 14, fontWeight: '700'},
  summaryValueNeutral: {color: C.white, fontSize: 13, fontWeight: '600'},
  divider: {height: 1, backgroundColor: C.border, marginVertical: 8},

  // 하단 버튼
  footer: {
    padding: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  orderBtn: {
    backgroundColor: C.blue,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: C.blue,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  orderBtnText: {color: C.white, fontSize: 16, fontWeight: '700', letterSpacing: 0.3},
});

export default StrategyOrderModal;