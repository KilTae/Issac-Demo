import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

// ── 더미 데이터 ───────────────────────────────────────────────────────────────
type PeriodKey = '1M' | '3M' | '6M' | '1Y';

const CHART_DATA: Record<PeriodKey, {month: string; value: number; positive: boolean; active?: boolean}[]> = {
  '1M': [
    {month: '3월', value: 980000, positive: true, active: true},
  ],
  '3M': [
    {month: '1월', value: 820000,  positive: true},
    {month: '2월', value: 240000,  positive: false},
    {month: '3월', value: 980000,  positive: true, active: true},
    {month: '4월', value: 400000,  positive: true},
  ],
  '6M': [
    {month: '10월', value: 620000,  positive: true},
    {month: '11월', value: 450000,  positive: true},
    {month: '12월', value: 180000,  positive: false},
    {month: '1월',  value: 820000,  positive: true},
    {month: '2월',  value: 240000,  positive: false},
    {month: '3월',  value: 980000,  positive: true, active: true},
  ],
  '1Y': [
    {month: '4월',  value: 380000,  positive: true},
    {month: '5월',  value: 520000,  positive: true},
    {month: '6월',  value: 90000,   positive: false},
    {month: '7월',  value: 760000,  positive: true},
    {month: '8월',  value: 430000,  positive: true},
    {month: '9월',  value: 120000,  positive: false},
    {month: '10월', value: 620000,  positive: true},
    {month: '11월', value: 450000,  positive: true},
    {month: '12월', value: 180000,  positive: false},
    {month: '1월',  value: 820000,  positive: true},
    {month: '2월',  value: 240000,  positive: false},
    {month: '3월',  value: 980000,  positive: true, active: true},
  ],
};

const PERIOD_STATS: Record<PeriodKey, {total: string; annual: string}> = {
  '1M': {total: '+₩980,000',   annual: '+11.2%'},
  '3M': {total: '+₩3,824,500', annual: '+18.4%'},
  '6M': {total: '+₩6,250,000', annual: '+15.8%'},
  '1Y': {total: '+₩9,430,000', annual: '+12.1%'},
};

const RISK_SCORE = 38;

// ── 막대 차트 ─────────────────────────────────────────────────────────────────
const BarChart = ({data}: {data: {month: string; value: number; positive: boolean; active?: boolean}[]}) => {
  const maxVal = Math.max(...data.map(d => Math.abs(d.value)));
  const BAR_MAX_H = 80;

  return (
    <View style={chartStyle.container}>
      {data.map((d, i) => {
        const h = Math.max(6, (Math.abs(d.value) / maxVal) * BAR_MAX_H);
        const color = !d.positive ? '#EF4444' : d.active ? '#3B82F6' : 'rgba(59,130,246,0.35)';
        return (
          <View key={i} style={chartStyle.col}>
            <View style={chartStyle.barWrap}>
              <View style={[chartStyle.bar, {height: h, backgroundColor: color}]} />
            </View>
            <Text style={chartStyle.label}>{d.month}</Text>
          </View>
        );
      })}
    </View>
  );
};

const chartStyle = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 108,
    paddingBottom: 22,
  },
  col: {alignItems: 'center', flex: 1},
  barWrap: {height: 80, justifyContent: 'flex-end'},
  bar: {width: 18, borderRadius: 4},
  label: {color: '#8B9AB0', fontSize: 9, marginTop: 5},
});

// ── BEP 차트 ─────────────────────────────────────────────────────────────────
const BEPChart = () => {
  const BEP_VAL = 71520;
  const CURRENT = 73200;
  const STRIKE = 75000;
  const MIN = 65000;
  const MAX = 80000;
  const range = MAX - MIN;
  const pct = (val: number) => ((val - MIN) / range) * 100;

  return (
    <View style={bepStyle.wrap}>
      {/* 트랙 */}
      <View style={bepStyle.track}>
        <View style={[bepStyle.lossZone, {width: `${pct(BEP_VAL)}%` as any}]} />
        <View style={[bepStyle.gainZone, {width: `${100 - pct(BEP_VAL)}%` as any}]} />
      </View>

      {/* 마커 영역 */}
      <View style={bepStyle.markerArea}>
        {[
          {val: BEP_VAL,  label: 'BEP',   color: '#8B9AB0'},
          {val: CURRENT,  label: '현재가', color: '#60A5FA'},
          {val: STRIKE,   label: '행사가', color: '#10B981'},
        ].map((m, i) => (
          <View
            key={i}
            style={[bepStyle.markerWrap, {left: `${pct(m.val)}%` as any}]}>
            <View style={[bepStyle.markerLine, {backgroundColor: m.color}]} />
            <Text style={[bepStyle.markerLabel, {color: m.color}]}>{m.label}</Text>
            <Text style={[bepStyle.markerVal, {color: m.color}]}>
              ₩{m.val.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>

      {/* 구간 레이블 */}
      <View style={bepStyle.zoneRow}>
        <Text style={[bepStyle.zoneLabel, {color: '#EF4444'}]}>손실구간</Text>
        <Text style={[bepStyle.zoneLabel, {color: '#10B981'}]}>수익구간</Text>
      </View>
    </View>
  );
};

const bepStyle = StyleSheet.create({
  wrap: {marginTop: 14},
  track: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 0,
  },
  lossZone: {height: 10, backgroundColor: 'rgba(239,68,68,0.3)'},
  gainZone: {height: 10, backgroundColor: 'rgba(16,185,129,0.3)'},
  markerArea: {
    height: 52,
    position: 'relative',
    marginTop: 0,
  },
  markerWrap: {
    position: 'absolute',
    alignItems: 'center',
    top: 0,
    transform: [{translateX: -18}],
  },
  markerLine: {width: 1, height: 14, marginBottom: 2},
  markerLabel: {fontSize: 9, fontWeight: '700'},
  markerVal: {fontSize: 9},
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  zoneLabel: {fontSize: 11, fontWeight: '600'},
});

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
const AnalysisScreen = () => {
  const [period, setPeriod] = useState<PeriodKey>('3M');
  const stats = PERIOD_STATS[period];
  const riskPct = RISK_SCORE;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0A1628" />

      {/* 헤더 */}
      <View style={s.header}>
        <Text style={s.headerSub}>수익 분석 / 리스크</Text>
        <View style={s.headerRight}>
          <TouchableOpacity style={s.iconBtn}>
            <Text style={s.iconText}>🔔</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn}>
            <Text style={s.iconText}>···</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}>

        <Text style={s.pageTitle}>수익 분석</Text>

        {/* 월간 수익 카드 */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>월간 수익</Text>
            <View style={s.periodRow}>
              {(['1M', '3M', '6M', '1Y'] as PeriodKey[]).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[s.periodBtn, period === p && s.periodBtnActive]}
                  onPress={() => setPeriod(p)}>
                  <Text style={[s.periodBtnText, period === p && s.periodBtnTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <BarChart data={CHART_DATA[period]} />

          <View style={s.divider} />
          <View style={s.statsRow}>
            <View>
              <Text style={s.statsLabel}>{period} 누적</Text>
              <Text style={s.statsValueGreen}>{stats.total}</Text>
            </View>
            <View style={{alignItems: 'flex-end'}}>
              <Text style={s.statsLabel}>연환산 수익률</Text>
              <Text style={s.statsValueGreen}>{stats.annual}</Text>
            </View>
          </View>
        </View>

        {/* 리스크 점수 카드 */}
        <View style={s.riskCard}>
          <Text style={s.riskTitle}>포트폴리오 리스크 점수</Text>
          <Text style={s.riskNum}>{RISK_SCORE}</Text>
          <View style={s.riskBadgeRow}>
            <View style={s.riskDot} />
            <Text style={s.riskBadgeText}>낮음 - 안전한 커버드콜 구성</Text>
          </View>

          {/* 게이지 */}
          <View style={s.gaugeWrap}>
            <View style={s.gaugeBg}>
              <View style={[s.gaugeFill, {width: `${riskPct}%`}]} />
              <View style={[s.gaugeThumb, {left: `${riskPct}%`}]} />
            </View>
            <View style={s.gaugeLabels}>
              <Text style={s.gaugeLabel}>낮음 0</Text>
              <Text style={s.gaugeLabel}>100 높음</Text>
            </View>
          </View>
        </View>

        {/* BEP 분석 카드 */}
        <View style={s.card}>
          <Text style={s.cardTitle}>손익분기 분석 - 삼성전자</Text>
          <BEPChart />
        </View>

        <View style={{height: 20}} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ── 스타일 ────────────────────────────────────────────────────────────────────
const C = {
  bg: '#0A1628',
  card: '#0F1F35',
  border: '#1E2D3D',
  blue: '#3B82F6',
  blueLight: '#60A5FA',
  green: '#10B981',
  white: '#FFFFFF',
  gray: '#8B9AB0',
  dim: '#4A5568',
};

const s = StyleSheet.create({
  container: {flex: 1, backgroundColor: C.bg},

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerSub: {color: C.gray, fontSize: 13, letterSpacing: 0.4},
  headerRight: {flexDirection: 'row', gap: 8},
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  iconText: {fontSize: 13, color: C.gray},

  scrollContent: {paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16},
  pageTitle: {
    color: C.white, fontSize: 24, fontWeight: '800',
    marginVertical: 14, letterSpacing: -0.5,
  },

  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: C.border,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  cardTitle: {color: C.white, fontSize: 14, fontWeight: '700'},

  periodRow: {
    flexDirection: 'row', backgroundColor: C.bg,
    borderRadius: 8, padding: 2, gap: 2,
  },
  periodBtn: {paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6},
  periodBtnActive: {backgroundColor: C.blue},
  periodBtnText: {color: C.dim, fontSize: 11, fontWeight: '600'},
  periodBtnTextActive: {color: C.white},

  divider: {height: 1, backgroundColor: C.border, marginVertical: 12},
  statsRow: {flexDirection: 'row', justifyContent: 'space-between'},
  statsLabel: {color: C.gray, fontSize: 11, marginBottom: 4},
  statsValueGreen: {color: C.green, fontSize: 16, fontWeight: '700'},

  // 리스크 카드
  riskCard: {
    borderRadius: 16, padding: 20, marginBottom: 12,
    backgroundColor: '#122850',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)',
  },
  riskTitle: {color: 'rgba(255,255,255,0.65)', fontSize: 13, marginBottom: 4},
  riskNum: {
    color: C.white, fontSize: 52, fontWeight: '800',
    letterSpacing: -2, marginBottom: 8,
  },
  riskBadgeRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20},
  riskDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: C.green},
  riskBadgeText: {color: 'rgba(255,255,255,0.8)', fontSize: 13},

  gaugeWrap: {},
  gaugeBg: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3, marginBottom: 6, position: 'relative', overflow: 'visible',
  },
  gaugeFill: {height: 6, backgroundColor: C.green, borderRadius: 3},
  gaugeThumb: {
    position: 'absolute', top: -4,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: C.white, borderWidth: 2, borderColor: C.green,
    transform: [{translateX: -7}],
  },
  gaugeLabels: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 4},
  gaugeLabel: {color: 'rgba(255,255,255,0.4)', fontSize: 10},
});

export default AnalysisScreen;