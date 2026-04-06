import React, {useState, useEffect, useCallback} from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {getFuturesBalance} from '../api/lsApi';

// ── 색상 ─────────────────────────────────────────────────────────────────────
const C = {
  bg:          '#F2F3F5',
  white:       '#FFFFFF',
  navy:        '#2A3A6A',
  border:      '#E8E8E8',
  divider:     '#F3F3F3',
  text:        '#111111',
  gray:        '#888888',
  dim:         '#AAAAAA',
  red:         '#D93030',
  green:       '#1A7A4A',
  redBg:       '#FFF0F0',
  redBorder:   '#FFCCCC',
  navyBg:      '#EEF0FF',
  navyBorder:  '#C0C8EE',
  mutedBg:     '#F8F8FC',
  mutedBorder: '#E0E0E8',
  segBg:       '#E4E6EC',
};

// ── 타입 ─────────────────────────────────────────────────────────────────────
type BalanceTab  = 'original' | 'realized' | 'avg';
type OrderFilter = 'all' | 'filled' | 'pending';

interface OutBlock2 {
  AcntNm:           string;
  DpsamtTotamt:     number;
  EvalDpsamtTotamt: number;
  OptEvalAmt:       number;
  FutsEvalPnlAmt:   number;
  OptEvalPnlAmt:    number;
  TotPnlAmt:        number;
  NetPnlAmt:        number;
  MnyOrdAbleAmt:    number;
  CsgnMgnTotamt:    number;
  MtmgnTotamt:      number;
  AddMgnTotamt:     number;
  RcvblAmt:         number;
  CmsnAmt:          number;
  DpstgMny:         number;
  AcntEvalRat:      string;
}

interface OutBlock3 {
  FnoIsuNo:    number;
  IsuNm:       string;
  BnsTpNm:     string;
  BnsTpCode:   string;
  UnsttQty:    number;
  FnoAvrPrc:   string;
  FnoNowPrc:   string;
  EvalAmt:     number;
  EvalPnl:     number;
  PnlRat:      string;
  BnsplAmt:    number;
  LqdtAbleQty: number;
}

// ── 숫자 포맷 헬퍼 ────────────────────────────────────────────────────────────
const fmtNum = (n: number) => Math.abs(n).toLocaleString('ko-KR');
const fmtAmt = (n: number) => {
  if (n === 0) return '0원';
  return `${n < 0 ? '-' : '+'}${fmtNum(n)}원`;
};
const numColor = (n: number) => n > 0 ? C.red : n < 0 ? C.green : C.text;

// ── SegmentTabs ───────────────────────────────────────────────────────────────
const SegmentTabs = <T extends string>({
  tabs, active, onPress,
}: {tabs: {key: T; label: string}[]; active: T; onPress: (k: T) => void}) => (
  <View style={ss.segWrap}>
    {tabs.map(t => (
      <TouchableOpacity
        key={t.key}
        style={[ss.segBtn, active === t.key && ss.segBtnActive]}
        onPress={() => onPress(t.key)}
        activeOpacity={0.8}>
        <Text style={[ss.segText, active === t.key && ss.segTextActive]}>
          {t.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

const ss = StyleSheet.create({
  segWrap:      {flexDirection: 'row', backgroundColor: C.segBg, borderRadius: 10, padding: 3, gap: 2},
  segBtn:       {flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center'},
  segBtnActive: {backgroundColor: C.white},
  segText:      {fontSize: 12, fontWeight: '500', color: '#999'},
  segTextActive:{fontSize: 12, fontWeight: '700', color: C.navy},
});

// ── DataRow ───────────────────────────────────────────────────────────────────
const DataRow = ({label, value, color}: {label: string; value: string; color?: string}) => (
  <View style={p.dataRow}>
    <Text style={p.dataLabel}>{label}</Text>
    <Text style={[p.dataValue, color ? {color} : {}]}>{value}</Text>
  </View>
);

// ── PositionCard ──────────────────────────────────────────────────────────────
const PositionCard = ({
  pos,
  onOrder,
}: {
  pos: OutBlock3;
  onOrder: (mode: '매수' | '매도', isuNm: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const isBuy    = pos.BnsTpCode === '1';
  const pnl      = pos.EvalPnl;
  const pnlColor = pnl > 0 ? C.red : C.green;

  return (
    <View style={p.card}>
      <View style={p.header}>
        <Text style={p.name}>{pos.IsuNm}</Text>
        <View style={[p.badge, isBuy ? p.badgeBuy : p.badgeSell]}>
          <Text style={[p.badgeText, {color: isBuy ? C.navy : C.red}]}>
            {pos.BnsTpNm}
          </Text>
        </View>
      </View>
      <View style={p.grid}>
        <DataRow label="평균가"   value={Number(pos.FnoAvrPrc).toFixed(2)}/>
        <DataRow label="잔고"     value={String(pos.UnsttQty)}/>
        <DataRow label="현재가"   value={Number(pos.FnoNowPrc).toFixed(2)}/>
        <DataRow label="평가금액" value={fmtNum(pos.EvalAmt) + '원'}/>
        <DataRow label="손익율"   value={pos.PnlRat + '%'} color={pnlColor}/>
        <DataRow label="평가손익" value={fmtAmt(pos.EvalPnl)} color={pnlColor}/>
      </View>
      <TouchableOpacity style={p.toggleRow} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <Text style={p.toggleText}>{open ? '접기' : '펼치기'}</Text>
        <Text style={[p.toggleArrow, open && {transform: [{rotate: '180deg'}]}]}>›</Text>
      </TouchableOpacity>
      {open && (
        <View style={p.btnRow}>
          {[
            {label: '차트',   style: p.btnMuted, textStyle: p.btnMutedText, onPress: () => {}},
            {label: '현재가', style: p.btnMuted, textStyle: p.btnMutedText, onPress: () => {}},
            {label: '매도',   style: p.btnSell,  textStyle: p.btnSellText,  onPress: () => onOrder('매도', pos.IsuNm)},
            {label: '매수',   style: p.btnBuy,   textStyle: p.btnBuyText,   onPress: () => onOrder('매수', pos.IsuNm)},
          ].map(b => (
            <TouchableOpacity key={b.label} style={[p.btn, b.style]} activeOpacity={0.75} onPress={b.onPress}>
              <Text style={[p.btnText, b.textStyle]}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const p = StyleSheet.create({
  card:        {backgroundColor: C.white, marginHorizontal: 12, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden'},
  header:      {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12},
  name:        {fontSize: 14, fontWeight: '900', color: C.text},
  badge:       {paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6},
  badgeBuy:    {backgroundColor: C.navyBg},
  badgeSell:   {backgroundColor: C.redBg},
  badgeText:   {fontSize: 11, fontWeight: '700'},
  grid:        {borderTopWidth: 1, borderTopColor: C.divider, paddingHorizontal: 14, paddingVertical: 10, gap: 8},
  dataRow:     {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  dataLabel:   {color: C.dim, fontSize: 12},
  dataValue:   {color: C.text, fontSize: 12, fontWeight: '700'},
  toggleRow:   {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.divider, gap: 4},
  toggleText:  {color: C.dim, fontSize: 12},
  toggleArrow: {color: C.dim, fontSize: 14, transform: [{rotate: '90deg'}]},
  btnRow:      {flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderTopColor: C.divider},
  btn:         {flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center', borderWidth: 1},
  btnText:     {fontSize: 12, fontWeight: '700'},
  btnMuted:    {backgroundColor: C.mutedBg,  borderColor: C.mutedBorder},
  btnMutedText:{color: '#444'},
  btnSell:     {backgroundColor: C.redBg,   borderColor: C.redBorder},
  btnSellText: {color: C.red},
  btnBuy:      {backgroundColor: C.navyBg,  borderColor: C.navyBorder},
  btnBuyText:  {color: C.navy},
});

// ── 메인 화면 ─────────────────────────────────────────────────────────────────
const AccountBalanceScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [balTab,     setBalTab]     = useState<BalanceTab>('original');
  const [orderTab,   setOrderTab]   = useState<OrderFilter>('all');
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [block2,     setBlock2]     = useState<OutBlock2 | null>(null);
  const [positions,  setPositions]  = useState<OutBlock3[]>([]);
  const [error,      setError]      = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await getFuturesBalance();
      console.log('✅ CFOAQ50600 응답:', JSON.stringify(res, null, 2));
      setBlock2(res.CFOAQ50600OutBlock2 ?? null);
      setPositions(Array.isArray(res.CFOAQ50600OutBlock3) ? res.CFOAQ50600OutBlock3 : []);
    } catch (e: any) {
      console.log('❌ 잔고 조회 실패:', e?.message);
      setError(e?.message ?? '잔고 조회 실패');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // ── 포지션 카드에서 매수/매도 눌렀을 때 Order 화면으로 이동 ──────────────
  const handlePositionOrder = useCallback((mode: '매수' | '매도', isuNm: string) => {
    navigation.navigate('FuturesOption', {
      shcode: 'A0166000',
      hname:  isuNm,
    });
  }, [navigation]);

  const totalAsset = block2 ? block2.EvalDpsamtTotamt + block2.OptEvalAmt : 0;
  const deposit    = block2?.DpstgMny    ?? 0;
  const evalAmt    = block2?.OptEvalAmt  ?? 0;
  const evalPnl    = block2 ? block2.FutsEvalPnlAmt + block2.OptEvalPnlAmt : 0;
  const acntNm     = block2?.AcntNm      ?? '-';

  const balanceTabs: {key: BalanceTab; label: string}[] = [
    {key: 'original', label: '잔고(원장)'},
    {key: 'realized', label: '잔고(실현손익)'},
    {key: 'avg',      label: '이평'},
  ];
  const orderTabs: {key: OrderFilter; label: string}[] = [
    {key: 'all',     label: '전체'},
    {key: 'filled',  label: '체결'},
    {key: 'pending', label: '미체결'},
  ];

  return (
    <SafeAreaView style={m.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg}/>

      {/* ── 헤더 ── */}
      <View style={m.header}>
        <Text style={m.headerTitle}>선물/옵션 계좌잔고</Text>
        <View style={m.headerBtns}>
          <TouchableOpacity style={m.iconBtn}><ClockIcon/></TouchableOpacity>
          <TouchableOpacity style={m.iconBtn} onPress={onRefresh}><RefreshIcon/></TouchableOpacity>
        </View>
      </View>

      {/* ── 계좌번호 ── */}
      <View style={m.acctBar}>
        <Text style={m.acctNum}>{acntNm}</Text>
        <Text style={m.acctDots}>···</Text>
      </View>

      {/* ── 로딩 / 에러 / 컨텐츠 ── */}
      {loading ? (
        <View style={m.loadingWrap}>
          <ActivityIndicator size="large" color={C.navy}/>
          <Text style={m.loadingText}>잔고 조회 중...</Text>
        </View>
      ) : error ? (
        <View style={m.loadingWrap}>
          <Text style={m.errorText}>{error}</Text>
          <TouchableOpacity style={m.retryBtn} onPress={fetchData}>
            <Text style={m.retryBtnText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingBottom: 24}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.navy}/>}>

          {/* ── 총자산 카드 ── */}
          <View style={m.totalCard}>
            <View style={m.totalCardTop}>
              <Text style={m.totalLabel}>총자산</Text>
              <RefreshIconWhite/>
            </View>
            <Text style={m.totalValue}>{fmtNum(totalAsset)}원</Text>
            <Text style={m.totalBasis}>평가손익 기준</Text>
            <View style={m.totalDivider}/>
            <View style={m.totalGrid}>
              <View>
                <Text style={m.totalGridLabel}>예탁금</Text>
                <Text style={[m.totalGridValue, {color: C.white}]}>{fmtNum(deposit)}원</Text>
              </View>
              <View>
                <Text style={m.totalGridLabel}>평가금액</Text>
                <Text style={[m.totalGridValue, {color: C.white}]}>{fmtNum(evalAmt)}원</Text>
              </View>
              <View>
                <Text style={m.totalGridLabel}>평가손익</Text>
                <Text style={[m.totalGridValue, {color: evalPnl >= 0 ? '#FF6B6B' : '#6BFF9E'}]}>
                  {fmtAmt(evalPnl)}
                </Text>
              </View>
            </View>
          </View>

          {/* ── 자동주문 배너 ── */}
          <TouchableOpacity
            style={m.autoBanner}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('FuturesOption', {
              shcode: 'A0166000',  // ← 수정: 파라미터 추가
              hname:  'F 2606',
            })}>
            <View style={m.autoIcon}><TrendIcon/></View>
            <View style={{flex: 1}}>
              <Text style={m.autoTitle}>선물/옵션 자동주문</Text>
              <Text style={m.autoSub}>자동매매 조건 설정 및 주문 관리</Text>
            </View>
            <Text style={m.autoArrow}>›</Text>
          </TouchableOpacity>

          {/* ── 계좌잔고 ── */}
          <View style={m.sectionHeader}>
            <Text style={m.sectionTitle}>계좌잔고</Text>
            <TouchableOpacity style={m.moreBtn}>
              <Text style={m.moreBtnText}>더보기 ›</Text>
            </TouchableOpacity>
          </View>

          <View style={{paddingHorizontal: 16, marginBottom: 10}}>
            <SegmentTabs tabs={balanceTabs} active={balTab} onPress={setBalTab}/>
          </View>

          <View style={m.balCard}>
            {[
              {label: '수량',     value: `${positions.reduce((s, pos) => s + pos.UnsttQty, 0)}계약`, color: C.text},
              {label: '평가손익', value: fmtAmt(evalPnl),                                            color: numColor(evalPnl)},
              {label: '약정금액', value: fmtNum(block2?.CsgnMgnTotamt ?? 0) + '원',                  color: C.text},
            ].map((row, i, arr) => (
              <View key={row.label} style={[m.balRow, i < arr.length - 1 && m.balRowBorder]}>
                <Text style={m.balLabel}>{row.label}</Text>
                <Text style={[m.balValue, {color: row.color}]}>{row.value}</Text>
              </View>
            ))}
          </View>

          {/* ── 포지션 카드들 ── */}
          {positions.length === 0 ? (
            <View style={m.emptyWrap}>
              <Text style={m.emptyText}>보유 포지션이 없습니다</Text>
            </View>
          ) : (
            positions.map((pos, i) => (
              <PositionCard key={i} pos={pos} onOrder={handlePositionOrder}/>
            ))
          )}

          {/* ── 증거금 현황 ── */}
          <View style={m.sectionHeader}>
            <Text style={m.sectionTitle}>증거금 현황</Text>
          </View>
          <View style={m.orderTable}>
            {[
              ['위탁증거금',   block2?.CsgnMgnTotamt ?? 0],
              ['유지증거금',   block2?.MtmgnTotamt   ?? 0],
              ['추가증거금',   block2?.AddMgnTotamt  ?? 0],
              ['주문가능금액', block2?.MnyOrdAbleAmt ?? 0],
              ['미수금액',     block2?.RcvblAmt      ?? 0],
              ['수수료',       block2?.CmsnAmt       ?? 0],
            ].map(([label, val], i, arr) => (
              <View key={String(label)} style={[m.orderRow, i < arr.length - 1 && {borderBottomWidth: 1, borderBottomColor: '#F5F5F5'}]}>
                <Text style={m.orderCell}>{label}</Text>
                <Text style={[m.orderCell, {textAlign: 'right', color: (val as number) < 0 ? C.red : C.text}]}>
                  {fmtNum(val as number)}원
                </Text>
              </View>
            ))}
          </View>

          {/* ── 주문내역 ── */}
          <View style={[m.sectionHeader, {marginTop: 10}]}>
            <Text style={m.sectionTitle}>주문내역</Text>
            <TouchableOpacity style={m.moreBtn}>
              <Text style={m.moreBtnText}>더보기 ›</Text>
            </TouchableOpacity>
          </View>
          <View style={m.orderTabRow}>
            {orderTabs.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[m.orderTab, orderTab === t.key && m.orderTabActive]}
                onPress={() => setOrderTab(t.key)}
                activeOpacity={0.8}>
                <Text style={[m.orderTabText, orderTab === t.key && m.orderTabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={m.emptyWrap}>
            <Text style={m.emptyText}>주문 내역이 없습니다</Text>
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
};

// ── 인라인 아이콘 ─────────────────────────────────────────────────────────────
const ClockIcon = () => (
  <View style={{width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: '#666', alignItems: 'center', justifyContent: 'center'}}>
    <View style={{width: 1.5, height: 5, backgroundColor: '#666', position: 'absolute', bottom: 7}}/>
    <View style={{width: 4, height: 1.5, backgroundColor: '#666', position: 'absolute', right: 4, bottom: 8}}/>
  </View>
);
const RefreshIcon = () => (
  <View style={{width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: '#666', borderRightColor: 'transparent', transform: [{rotate: '45deg'}]}}/>
);
const RefreshIconWhite = () => (
  <View style={{width: 15, height: 15, borderRadius: 8, borderWidth: 1.4, borderColor: 'rgba(255,255,255,0.4)', borderRightColor: 'transparent', transform: [{rotate: '45deg'}]}}/>
);
const TrendIcon = () => (
  <View style={{width: 18, height: 18}}>
    <View style={{position: 'absolute', bottom: 2, left: 0,  width: 4, height: 8,  backgroundColor: C.navy, borderRadius: 2}}/>
    <View style={{position: 'absolute', bottom: 2, left: 6,  width: 4, height: 12, backgroundColor: C.navy, borderRadius: 2}}/>
    <View style={{position: 'absolute', bottom: 2, left: 12, width: 4, height: 16, backgroundColor: C.navy, borderRadius: 2}}/>
  </View>
);

// ── 스타일 ────────────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  container:         {flex: 1, backgroundColor: C.bg},
  header:            {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.bg},
  headerTitle:       {fontSize: 18, fontWeight: '900', color: C.text},
  headerBtns:        {flexDirection: 'row', gap: 8},
  iconBtn:           {width: 36, height: 36, borderRadius: 10, backgroundColor: C.white, borderWidth: 1, borderColor: '#DDD', alignItems: 'center', justifyContent: 'center'},
  acctBar:           {flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: C.bg},
  acctNum:           {fontSize: 11.5, color: '#999'},
  acctDots:          {fontSize: 13, color: '#AAA', letterSpacing: 3},
  loadingWrap:       {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
  loadingText:       {fontSize: 14, color: C.gray},
  errorText:         {fontSize: 14, color: C.red, textAlign: 'center', paddingHorizontal: 24},
  retryBtn:          {backgroundColor: C.navy, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10},
  retryBtnText:      {color: C.white, fontWeight: '700', fontSize: 14},
  totalCard:         {backgroundColor: '#2A3A6A', marginHorizontal: 12, marginBottom: 10, borderRadius: 18, padding: 20},
  totalCardTop:      {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10},
  totalLabel:        {color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '500'},
  totalValue:        {color: C.white, fontSize: 27, fontWeight: '900', letterSpacing: -1.5, marginBottom: 4},
  totalBasis:        {color: 'rgba(255,255,255,0.38)', fontSize: 10.5, marginBottom: 14},
  totalDivider:      {height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 14},
  totalGrid:         {flexDirection: 'row', justifyContent: 'space-between'},
  totalGridLabel:    {color: 'rgba(255,255,255,0.45)', fontSize: 9.5, marginBottom: 5},
  totalGridValue:    {fontSize: 11, fontWeight: '700'},
  autoBanner:        {flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.white, marginHorizontal: 12, marginBottom: 10, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 13},
  autoIcon:          {width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEEEFF', alignItems: 'center', justifyContent: 'center'},
  autoTitle:         {fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 2},
  autoSub:           {fontSize: 11, color: '#AAA'},
  autoArrow:         {color: '#CCC', fontSize: 18},
  sectionHeader:     {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8},
  sectionTitle:      {fontSize: 15, fontWeight: '800', color: C.text},
  moreBtn:           {backgroundColor: C.white, borderWidth: 1, borderColor: '#D8D8E0', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 5},
  moreBtnText:       {fontSize: 12, fontWeight: '600', color: '#333'},
  balCard:           {backgroundColor: C.white, marginBottom: 10},
  balRow:            {flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10},
  balRowBorder:      {borderBottomWidth: 1, borderBottomColor: '#F3F3F3'},
  balLabel:          {fontSize: 13, color: C.gray},
  balValue:          {fontSize: 13, fontWeight: '700'},
  emptyWrap:         {alignItems: 'center', paddingVertical: 20},
  emptyText:         {fontSize: 13, color: C.dim},
  orderTabRow:       {flexDirection: 'row', gap: 7, paddingHorizontal: 14, marginBottom: 10},
  orderTab:          {paddingHorizontal: 20, paddingVertical: 6, borderRadius: 8, backgroundColor: C.white, borderWidth: 1.5, borderColor: '#DDD'},
  orderTabActive:    {borderColor: '#333'},
  orderTabText:      {fontSize: 12, fontWeight: '600', color: '#888'},
  orderTabTextActive:{color: C.text, fontWeight: '700'},
  orderTable:        {backgroundColor: C.white, marginHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, overflow: 'hidden'},
  orderRow:          {flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center'},
  orderCell:         {flex: 1, fontSize: 13, fontWeight: '600', color: C.text},
});

export default AccountBalanceScreen;