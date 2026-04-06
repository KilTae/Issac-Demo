import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';

// ── 더미 데이터 (추후 Open API로 교체) ──────────────────────────────────────
const STOCK_DATA = {
  name: '삼성전자',
  price: 73200,
  change: 200,
  changeRate: 0.27,
  isPositive: true,
  iv: '28.4%',
  hv: '24.7%',
  ivr: '62',
  isFitting: true,
};

const EXPIRY_DATES = [
  {label: '3/14', days: '10일'},
  {label: '3/28', days: '24일'},
  {label: '4/11', days: '38일'},
  {label: '4/25', days: '52일'},
];

type OptionRow = {
  callDelta: number;
  callAsk: number;
  strike: number;
  putAsk: number;
  putDelta: number;
  type: 'ATM' | 'ITM' | 'OTM';
};

const OPTIONS_DATA: OptionRow[] = [
  {callDelta: 0.71, callAsk: 4800, strike: 70000, putAsk: 380, putDelta: -0.29, type: 'ITM'},
  {callDelta: 0.52, callAsk: 2550, strike: 73800, putAsk: 2400, putDelta: -0.48, type: 'ATM'},
  {callDelta: 0.38, callAsk: 1560, strike: 75000, putAsk: 3700, putDelta: -0.62, type: 'OTM'},
  {callDelta: 0.24, callAsk: 880,  strike: 77000, putAsk: 5258, putDelta: -0.76, type: 'OTM'},
  {callDelta: 0.13, callAsk: 420,  strike: 80000, putAsk: 7158, putDelta: -0.87, type: 'OTM'},
];

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────
const ChainScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [selectedExpiry, setSelectedExpiry] = useState(0);
  const [searchText, setSearchText] = useState('삼성전자');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1628" />

      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>옵션 체인</Text>
        <TouchableOpacity style={styles.bellBtn}>
          <Text style={styles.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* 검색바 */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#4A5568"
            placeholder="종목 검색"
          />
        </View>

        {/* 종목 정보 */}
        <View style={styles.stockInfoWrap}>
          <View style={styles.stockNameRow}>
            <Text style={styles.stockName}>{STOCK_DATA.name}</Text>
            <Text style={styles.stockPrice}>
              {STOCK_DATA.price.toLocaleString()}
            </Text>
            <View style={styles.stockChangeWrap}>
              <Text style={styles.stockChange}>
                {STOCK_DATA.isPositive ? '▲' : '▼'}+{STOCK_DATA.change}(+
                {STOCK_DATA.changeRate}%)
              </Text>
            </View>
          </View>

          {/* 태그 */}
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>IV {STOCK_DATA.iv}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>HV {STOCK_DATA.hv}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>IVR {STOCK_DATA.ivr}</Text>
            </View>
            <View style={styles.tagFit}>
              <Text style={styles.tagFitText}>프리마링 적합 ✓</Text>
            </View>
          </View>
        </View>

        {/* 만기일 탭 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.expiryScroll}
          contentContainerStyle={styles.expiryContent}>
          {EXPIRY_DATES.map((exp, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.expiryTab, selectedExpiry === i && styles.expiryTabActive]}
              onPress={() => setSelectedExpiry(i)}>
              <Text style={[styles.expiryText, selectedExpiry === i && styles.expiryTextActive]}>
                {exp.label}({exp.days})
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 옵션 테이블 */}
        <View style={styles.table}>

          {/* 테이블 헤더 */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colSide]}>DELTA</Text>
            <Text style={[styles.tableHeaderText, styles.colSide]}>ASK</Text>
            <Text style={[styles.tableHeaderText, styles.colCenter]}>행사가</Text>
            <Text style={[styles.tableHeaderText, styles.colSide]}>ASK</Text>
            <Text style={[styles.tableHeaderText, styles.colSide]}>DELTA</Text>
          </View>

          {/* 콜/풋 레이블 */}
          <View style={styles.callPutLabel}>
            <Text style={styles.callLabel}>CALL</Text>
            <View style={styles.callPutDivider} />
            <Text style={styles.putLabel}>PUT</Text>
          </View>

          {/* 행 */}
          {OPTIONS_DATA.map((row, i) => {
            const isATM = row.type === 'ATM';
            const isITM = row.type === 'ITM';
            return (
              <TouchableOpacity
                key={i}
                style={[
                  styles.tableRow,
                  isATM && styles.rowATM,
                  isITM && styles.rowITM,
                ]}
                onPress={() => {
                  navigation.navigate('StrategyOrder', {
                    strike: row.strike,
                    callAsk: row.callAsk,
                    callDelta: row.callDelta,
                    putAsk: row.putAsk,
                    putDelta: row.putDelta,
                    type: row.type,
                    stockName: STOCK_DATA.name,
                    stockCode: '005930',
                    stockPrice: STOCK_DATA.price,
                  });
                }}
                activeOpacity={0.7}>
                {/* Call Delta */}
                <Text style={[styles.cellText, styles.colSide, styles.callColor]}>
                  {row.callDelta.toFixed(2)}
                </Text>
                {/* Call Ask */}
                <Text style={[styles.cellText, styles.colSide, styles.callColor]}>
                  {row.callAsk.toLocaleString()}
                </Text>
                {/* 행사가 */}
                <View style={[styles.colCenter, styles.strikeWrap]}>
                  <Text style={[styles.cellText, styles.strikeText]}>
                    {row.strike.toLocaleString()}
                  </Text>
                  {isATM && <Text style={styles.atmStar}>★</Text>}
                </View>
                {/* Put Ask */}
                <Text style={[styles.cellText, styles.colSide, styles.putColor]}>
                  {row.putAsk.toLocaleString()}
                </Text>
                {/* Put Delta */}
                <Text style={[styles.cellText, styles.colSide, styles.putColor]}>
                  {row.putDelta.toFixed(2)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 범례 */}
        <View style={styles.legend}>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, {backgroundColor: '#8B9AB0'}]} />
            <Text style={styles.legendText}>ATM 등가격</Text>
            <View style={[styles.legendDot, {backgroundColor: '#3B82F6', marginLeft: 12}]} />
            <Text style={styles.legendText}>ITM 내가격</Text>
            <View style={[styles.legendDot, {backgroundColor: '#4A5568', marginLeft: 12}]} />
            <Text style={styles.legendText}>원격OTM 외가격</Text>
          </View>
          <Text style={styles.legendNote}>
            커브드콜전략 OTM Call에도 관망
          </Text>
        </View>

        <View style={{height: 20}} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ── 스타일 ────────────────────────────────────────────────────────────────────
const COLORS = {
  bg: '#0A1628',
  card: '#0F1F35',
  border: '#1E2D3D',
  blue: '#3B82F6',
  blueLight: '#60A5FA',
  green: '#10B981',
  red: '#EF4444',
  white: '#FFFFFF',
  gray: '#8B9AB0',
  grayDim: '#4A5568',
  atmBg: 'rgba(59,130,246,0.08)',
  itmBg: 'rgba(16,185,129,0.06)',
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: COLORS.bg},

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {color: COLORS.gray, fontSize: 13, letterSpacing: 0.5},
  bellBtn: {padding: 4},
  bellIcon: {fontSize: 18},

  // 검색
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {fontSize: 15, marginRight: 8},
  searchInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 14,
    paddingVertical: 12,
  },

  // 종목 정보
  stockInfoWrap: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  stockNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  stockName: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  stockPrice: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  stockChangeWrap: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  stockChange: {
    color: COLORS.green,
    fontSize: 12,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagText: {color: COLORS.gray, fontSize: 11},
  tagFit: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  tagFitText: {color: COLORS.blueLight, fontSize: 11, fontWeight: '600'},

  // 만기일 탭
  expiryScroll: {marginBottom: 4},
  expiryContent: {paddingHorizontal: 16, gap: 8},
  expiryTab: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  expiryTabActive: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  expiryText: {color: COLORS.gray, fontSize: 13, fontWeight: '500'},
  expiryTextActive: {color: COLORS.white, fontWeight: '700'},

  // 테이블
  table: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0D1A2A',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    color: COLORS.grayDim,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  callPutLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#0B1520',
  },
  callLabel: {
    flex: 2,
    color: COLORS.blueLight,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
  callPutDivider: {width: 1, height: 12, backgroundColor: COLORS.border},
  putLabel: {
    flex: 2,
    color: '#F87171',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: 'center',
  },
  rowATM: {backgroundColor: COLORS.atmBg},
  rowITM: {backgroundColor: COLORS.itmBg},

  colSide: {flex: 1, textAlign: 'center'},
  colCenter: {flex: 1.2, alignItems: 'center'},
  cellText: {fontSize: 13, fontWeight: '500'},
  callColor: {color: COLORS.blueLight},
  putColor: {color: '#F87171'},
  strikeWrap: {alignItems: 'center'},
  strikeText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  atmStar: {color: COLORS.blue, fontSize: 10, marginTop: 2},

  // 범례
  legend: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendDot: {width: 8, height: 8, borderRadius: 4},
  legendText: {color: COLORS.gray, fontSize: 11, marginLeft: 4},
  legendNote: {
    color: COLORS.grayDim,
    fontSize: 11,
    marginTop: 2,
  },
});

export default ChainScreen;