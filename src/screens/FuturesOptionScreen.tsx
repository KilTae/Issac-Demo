import React, {useState, useEffect, useCallback, useRef} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  StatusBar, Modal, ActivityIndicator, Dimensions,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  getFuturesPrice, getFuturesHoga, getOptionBoard,
  FuturesPrice, FuturesHoga, OptionItem,
} from '../api/lsApi';

const { width: SW } = Dimensions.get('window');

const C = {
  bg:       '#FFFFFF',
  navy:     '#1A3BB8',
  red:      '#E8001C',
  blue:     '#1A73E8',
  border:   '#F0F0F0',
  subText:  '#888888',
  dimText:  '#AAAAAA',
  rowBg:    '#FAFAFA',
  redBg:    '#FFF0F0',
  blueBg:   '#F0F5FF',
  pillBg:   '#FFF0F0',
  atmBg:    '#F0F5FF',
  orange:   '#F5A623',
  darkNavy: '#1A2F6E',
  mutedBg:  '#F0F3F9',
  segBg:    '#E4E8F4',
};

type MainTab    = '호가' | '옵션전광판';
type OrderMode  = '매수' | '매도' | '정정/취소' | '체결' | '잔고';
type OptionView = '전체' | '콜' | '풋';

interface BookRow { price: number; qty: number; }
interface Book    { asks: BookRow[]; bids: BookRow[]; }
interface OptionRow {
  strike: number;
  call: { price: number; chg: number; sign: string; volume: number; delt: number; iv: number; };
  put:  { price: number; chg: number; sign: string; volume: number; delt: number; iv: number; };
}
interface HogaPopupData   { price: number; pct: number; }
interface OptionPopupData { item: OptionRow; type: '콜' | '풋'; }

const fmt2   = (n: number) => n.toFixed(2);
const fmtVol = (n: number) => n.toLocaleString('ko-KR');

const getSignColor = (sign: string) => {
  if (sign === '1' || sign === '2') return C.red;
  if (sign === '4' || sign === '5') return C.blue;
  return '#555';
};

const CandleIcon = ({color, size = 32}: {color: string; size?: number}) => {
  const w = size * 0.35;
  return (
    <View style={{width: w+6, height: size, alignItems: 'center'}}>
      <View style={{width: 2, height: size*0.18, backgroundColor: color}}/>
      <View style={{width: w, height: size*0.58, backgroundColor: color, borderRadius: 1}}/>
      <View style={{width: 2, height: size*0.24, backgroundColor: color}}/>
    </View>
  );
};

const MiniHoga = ({book, currentPrice, selectedPrice, onSelect, openPrice}: {
  book: Book; currentPrice: number; selectedPrice: number;
  onSelect: (p: number) => void; openPrice: number;
}) => {
  const allQtys = [...book.asks.map(r=>r.qty), ...book.bids.map(r=>r.qty)];
  const maxQty  = Math.max(...allQtys, 1);
  const rows: Array<BookRow & {isCurrent?: boolean}> = [
    ...[...book.asks].reverse(),
    {price: currentPrice, qty: 41, isCurrent: true},
    ...book.bids,
  ];
  return (
    <View style={ms.wrap}>
      <View style={ms.tabRow}>
        <Text style={ms.tabActive}>호가</Text>
        <Text style={ms.tabInactive}>체결</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {rows.map((r, i) => {
          const isAsk = !r.isCurrent && i < book.asks.length;
          const isCur = r.isCurrent;
          const barW  = isCur ? 0 : Math.round((r.qty/maxQty)*80);
          const isSelected = selectedPrice === r.price;
          const pct = +((r.price-openPrice)/openPrice*100).toFixed(2);
          return (
            <TouchableOpacity key={i} onPress={() => !isCur && onSelect(r.price)}
              activeOpacity={isCur ? 1 : 0.7}
              style={[ms.row, isCur && ms.rowCurrent, isSelected && !isCur && ms.rowSelected]}>
              {!isCur && <View style={[ms.bar, {width:`${barW}%` as any}, isAsk?ms.barAsk:ms.barBid]}/>}
              <View style={ms.rowContent}>
                <View>
                  <Text style={ms.price}>{fmt2(r.price)}</Text>
                  <Text style={ms.pctText}>{pct}%</Text>
                </View>
                <Text style={ms.qty}>{r.qty}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const ms = StyleSheet.create({
  wrap:        {width: 110, borderRightWidth: 1, borderRightColor: C.border},
  tabRow:      {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border},
  tabActive:   {flex: 1, textAlign: 'center', paddingVertical: 6, fontSize: 11, fontWeight: '700', color: C.navy, borderBottomWidth: 2, borderBottomColor: C.navy},
  tabInactive: {flex: 1, textAlign: 'center', paddingVertical: 6, fontSize: 11, color: C.dimText},
  row:         {position: 'relative', paddingHorizontal: 6, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F8F8F8'},
  rowCurrent:  {backgroundColor: C.redBg, borderWidth: 1, borderColor: C.red, marginHorizontal: 2},
  rowSelected: {backgroundColor: '#FFFBE6'},
  bar:         {position: 'absolute', top: 0, bottom: 0, right: 0, borderRadius: 2},
  barAsk:      {backgroundColor: 'rgba(26,115,232,0.12)'},
  barBid:      {backgroundColor: 'rgba(232,0,28,0.10)'},
  rowContent:  {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1},
  price:       {fontSize: 11, fontWeight: '700', color: C.red},
  pctText:     {fontSize: 9, color: C.red},
  qty:         {fontSize: 11, color: C.subText},
});

const HogaBottomSheet = ({visible, data, onClose, onOrder}: {
  visible: boolean; data: HogaPopupData | null;
  onClose: () => void; onOrder: (mode: OrderMode, price: number) => void;
}) => {
  if (!data) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={bs.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={bs.sheet}>
          <View style={bs.handle}/>
          <View style={bs.priceSection}>
            <View>
              <Text style={bs.priceLabel}>선택 호가</Text>
              <Text style={bs.priceVal}>{fmt2(data.price)}</Text>
            </View>
            <Text style={bs.pctVal}>{data.pct >= 0 ? '+' : ''}{data.pct}%</Text>
          </View>
          <TouchableOpacity style={[bs.btn, {backgroundColor: C.red}]} onPress={() => { onClose(); onOrder('매수', data.price); }}>
            <Text style={bs.btnText}>매수</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[bs.btn, {backgroundColor: C.blue}]} onPress={() => { onClose(); onOrder('매도', data.price); }}>
            <Text style={bs.btnText}>매도</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[bs.btn, {backgroundColor: C.mutedBg}]}>
            <Text style={[bs.btnText, {color: C.darkNavy}]}>정정 / 취소</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const OptionBottomSheet = ({visible, data, onClose, onOrder}: {
  visible: boolean; data: OptionPopupData | null;
  onClose: () => void; onOrder: (mode: OrderMode, price: number) => void;
}) => {
  if (!data) return null;
  const opt   = data.type === '콜' ? data.item.call : data.item.put;
  const isDown = opt.chg < 0;
  const color  = isDown ? C.blue : C.red;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={bs.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={bs.sheet}>
          <View style={bs.handle}/>
          <Text style={bs.optName}>{data.type === '콜' ? 'C' : 'P'} {data.item.strike.toFixed(1)}</Text>
          <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14}}>
            <CandleIcon color={color} size={26}/>
            <Text style={[bs.priceVal, {color}]}>{fmt2(opt.price)}</Text>
            <Text style={{color, fontSize: 13}}>{isDown ? '▼' : '▲'} {Math.abs(opt.chg).toFixed(2)}</Text>
          </View>
          <View style={bs.btnRow}>
            <TouchableOpacity style={[bs.halfBtn, {backgroundColor: C.blue}]} onPress={() => { onClose(); onOrder('매도', opt.price); }}>
              <Text style={[bs.halfBtnText, {color: '#FFF'}]}>매도</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[bs.halfBtn, {backgroundColor: C.red}]} onPress={() => { onClose(); onOrder('매수', opt.price); }}>
              <Text style={[bs.halfBtnText, {color: '#FFF'}]}>매수</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const bs = StyleSheet.create({
  overlay:      {flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end'},
  sheet:        {backgroundColor: C.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36},
  handle:       {width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginBottom: 14},
  priceSection: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: 16, marginBottom: 16},
  priceLabel:   {fontSize: 11, color: C.dimText, marginBottom: 4},
  priceVal:     {fontSize: 26, fontWeight: '900', color: C.red},
  pctVal:       {fontSize: 16, fontWeight: '700', color: C.red, marginBottom: 4},
  btn:          {borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10},
  btnText:      {fontWeight: '800', fontSize: 17, color: '#FFF', letterSpacing: 2},
  btnRow:       {flexDirection: 'row', gap: 10},
  halfBtn:      {flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center'},
  halfBtnText:  {fontWeight: '700', fontSize: 15},
  optName:      {fontSize: 14, fontWeight: '700', marginBottom: 8},
  optGrid:      {flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginBottom: 14},
  optGridLabel: {fontSize: 10, color: C.dimText, marginBottom: 2},
  optGridVal:   {fontSize: 12, fontWeight: '600'},
});

// ── 메인 화면 ────────────────────────────────────────────────────────────────
const FuturesOptionScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProp<RootStackParamList, 'FuturesOption'>>();

  const shcode = route.params.shcode;
  const hname  = route.params.hname;
  const yyyymm = route.params.yyyymm ?? '';

  const [futuresData, setFuturesData] = useState<FuturesPrice | null>(null);
  const [hogaData,    setHogaData]    = useState<FuturesHoga | null>(null);
  const [loading,     setLoading]     = useState(true);

  const price      = futuresData?.price     ?? 0;
  const openPrice  = futuresData?.jnilclose ?? 0;
  const chg        = futuresData?.change    ?? 0;
  const pct        = futuresData?.diff      ?? 0;
  const priceColor = getSignColor(futuresData?.sign ?? '3');

  // ✅ route params hname 우선 사용, 없으면 API hname에서 "코스피200 " 제거
  const displayName = hname
    ? hname
    : (futuresData?.hname ?? '').replace(/^코스피200\s*/, '');

  const [book,      setBook]      = useState<Book>({asks: [], bids: []});
  const [opts,      setOpts]      = useState<OptionRow[]>([]);
  const [mainTab,   setMainTab]   = useState<MainTab>('호가');
  const [optView,   setOptView]   = useState<OptionView>('전체');
  const [hogaPopup, setHogaPopup] = useState<HogaPopupData | null>(null);
  const [optPopup,  setOptPopup]  = useState<OptionPopupData | null>(null);
  const optScrollRef = useRef<ScrollView>(null);

  const fetchPrice = useCallback(async () => {
    try {
      const [priceData, hoga] = await Promise.all([
        getFuturesPrice(shcode),
        getFuturesHoga(shcode),
      ]);
      setFuturesData(priceData);
      setHogaData(hoga);
      setBook({ asks: [...hoga.asks].reverse(), bids: hoga.bids });
    } catch (e: any) {
      console.log('❌ 호가 조회 실패:', e?.message);
    } finally {
      setLoading(false);
    }
  }, [shcode]);

  const fetchOptionBoard = useCallback(async () => {
    try {
      const gubun    = yyyymm === 'W1 ' ? 'W' : 'G';
      const optBoard = await getOptionBoard(yyyymm, gubun);

      const strikeMap = new Map<number, {call?: OptionItem; put?: OptionItem}>();
      optBoard.calls.forEach(c => strikeMap.set(c.actprice, {...(strikeMap.get(c.actprice) ?? {}), call: c}));
      optBoard.puts.forEach(p  => strikeMap.set(p.actprice, {...(strikeMap.get(p.actprice) ?? {}), put:  p}));

      const rows: OptionRow[] = Array.from(strikeMap.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([strike, {call, put}]) => ({
          strike,
          call: {price: call?.price ?? 0, chg: call?.change ?? 0, sign: call?.sign ?? '3', volume: call?.volume ?? 0, delt: call?.delt ?? 0, iv: call?.iv ?? 0},
          put:  {price: put?.price  ?? 0, chg: put?.change  ?? 0, sign: put?.sign  ?? '3', volume: put?.volume  ?? 0, delt: put?.delt  ?? 0, iv: put?.iv  ?? 0},
        }));
      setOpts(rows);
    } catch (e: any) {
      console.log('❌ 옵션전광판 조회 실패:', e?.message);
    }
  }, [yyyymm, futuresData]);

  useEffect(() => {
    fetchPrice();
    const id = setInterval(fetchPrice, 5000);
    return () => clearInterval(id);
  }, [fetchPrice]);

  // opts 렌더링 완료 후 ATM 행사가로 스크롤
  useEffect(() => {
    if (opts.length === 0 || !price) return;
    const atm = opts.reduce((a, b) =>
      Math.abs(b.strike - price) < Math.abs(a.strike - price) ? b : a
    );
    const atmIdx = opts.findIndex(r => r.strike === atm.strike);
    if (atmIdx > 2) {
      setTimeout(() => {
        optScrollRef.current?.scrollTo({y: (atmIdx - 3) * 44, animated: false});
      }, 100);
    }
  }, [opts]);

  useEffect(() => {
    if (mainTab === '옵션전광판' && opts.length === 0) {
      fetchOptionBoard();
    }
  }, [mainTab]);

  const atmStrike = opts.length > 0
    ? opts.reduce((a, b) => Math.abs(b.strike - price) < Math.abs(a.strike - price) ? b : a).strike
    : price;

  const openOrder = useCallback((mode: OrderMode, px: number) => {
    navigation.navigate('Order', {
      mode,
      shcode,
      hname,
      price:     px,
      openPrice: futuresData?.jnilclose ?? 0,
      sign:      futuresData?.sign      ?? '3',
      change:    futuresData?.change    ?? 0,
      diff:      futuresData?.diff      ?? 0,
      hoga:      hogaData ?? undefined,
    });
  }, [navigation, shcode, hname, futuresData, hogaData]);

  return (
    <SafeAreaView style={sc.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg}/>

      {loading && (
        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
          <ActivityIndicator size="large" color={C.navy}/>
          <Text style={{marginTop: 12, color: C.subText, fontSize: 14}}>시세 조회 중...</Text>
        </View>
      )}

      {!loading && (<>
      {/* ── 헤더 ── */}
      <View style={sc.header}>
        <View style={sc.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()}
            hitSlop={{top:12, bottom:12, left:12, right:12}} style={sc.backBtn}>
            <Text style={sc.backBtnText}>‹</Text>
          </TouchableOpacity>
          {/* ✅ displayName 사용 */}
          <Text style={sc.headerTitle}>{displayName}</Text>
          <View style={sc.headerTriangle}/>
        </View>
        <View style={sc.headerRight}>
          <View style={sc.dayToggle}>
            <View style={[sc.dayBtn, sc.dayBtnActive]}>
              <Text style={sc.dayBtnActiveText}>주간</Text>
            </View>
            <View style={sc.dayBtn}>
              <Text style={sc.dayBtnText}>야간</Text>
            </View>
          </View>
          <View style={sc.searchIcon}>
            <TouchableOpacity onPress={() => navigation.navigate('FuturesSearch')} hitSlop={{top:10,bottom:10,left:10,right:10}}>
              <View style={sc.searchCircle}/>
              <View style={sc.searchHandle}/>
            </TouchableOpacity>
          </View>
          <View style={sc.dotsWrap}>
            {[0,1,2].map(i => <View key={i} style={sc.dot}/>)}
          </View>
        </View>
      </View>

      {/* ── 현재가 영역 ── */}
      <View style={sc.priceSection}>
        <View>
          <Text style={sc.kp200Text}>
            KP200 <Text style={{color: getSignColor(futuresData?.kospisign ?? '3'), fontWeight: '700'}}>
              {fmt2(futuresData?.kospijisu ?? 0)} {['1','2'].includes(futuresData?.kospisign ?? '') ? '▲' : '▼'}{fmt2(Math.abs(futuresData?.kospichange ?? 0))} {fmt2(Math.abs(futuresData?.kospidiff ?? 0))}%
            </Text>
          </Text>
          <View style={sc.priceRow}>
            <CandleIcon color={priceColor} size={32}/>
            <Text style={[sc.bigPrice, {color: priceColor}]}>{fmt2(price)}</Text>
          </View>
          <View style={sc.pillRow}>
            <View style={sc.pill}>
              <Text style={[sc.pillText, {color: priceColor}]}>
                {['1','2'].includes(futuresData?.sign ?? '') ? '▲' : '▼'}{fmt2(Math.abs(chg))}  {fmt2(Math.abs(pct))}%
              </Text>
            </View>
            <Text style={sc.volText}>{fmtVol(futuresData?.volume ?? 0)}</Text>
          </View>
        </View>
        <View style={sc.investorWrap}>
          <Text style={sc.investorHeader}>베이시스 / 잔여일</Text>
          <Text style={sc.investorRow}>베이시스 <Text style={{color: C.blue, fontWeight: '600'}}>{fmt2(futuresData?.basis ?? 0)}</Text></Text>
          <Text style={sc.investorRow}>잔여일 <Text style={{color: C.red, fontWeight: '600'}}>{futuresData?.jandatecnt ?? 0}일</Text></Text>
          <Text style={sc.investorRow}>만기일 <Text style={{color: C.subText, fontWeight: '600'}}>{futuresData?.lastmonth ?? '-'}</Text></Text>
        </View>
      </View>

      {/* ── 탭 ── */}
      <View style={sc.tabRow}>
        {(['호가', '옵션전광판'] as MainTab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setMainTab(t)} activeOpacity={0.8}
            style={[sc.tabBtn, mainTab === t && sc.tabBtnActive]}>
            <Text style={[sc.tabText, mainTab === t && sc.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── 호가창 ── */}
      {mainTab === '호가' && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={sc.hogaHeadRow}>
            <Text style={[sc.hogaHeadText, {textAlign: 'right'}]}>잔량</Text>
            <View style={{flex: 2}}/>
            <Text style={sc.hogaHeadText}>잔량</Text>
          </View>
          {[...book.asks].reverse().map((r, i) => {
            const p2 = +((r.price-openPrice)/openPrice*100).toFixed(2);
            return (
              <TouchableOpacity key={i} activeOpacity={0.7}
                onPress={() => setHogaPopup({price: r.price, pct: p2})} style={sc.hogaRow}>
                <Text style={[sc.hogaQty, {color: C.blue}]}>{r.qty}</Text>
                <View style={sc.hogaCenter}>
                  <Text style={sc.hogaPrice}>{fmt2(r.price)}</Text>
                  <Text style={sc.hogaPct}>{p2}%</Text>
                </View>
                <View style={{flex: 1}}/>
              </TouchableOpacity>
            );
          })}
          <View style={sc.currentRow}>
            <Text style={[sc.hogaQty, {color: C.blue}]}>{hogaData?.asks[0]?.qty ?? '-'}</Text>
            <View style={sc.hogaCenter}>
              <Text style={[sc.hogaPrice, {fontSize: 16, fontWeight: '900'}]}>{fmt2(price)}</Text>
              <Text style={[sc.hogaPct, {color: priceColor}]}>{pct > 0 ? '+' : ''}{fmt2(pct)}%</Text>
            </View>
            <Text style={[sc.hogaQty, {textAlign: 'left', color: C.red}]}>{hogaData?.bids[0]?.qty ?? '-'}</Text>
          </View>
          {book.bids.map((r, i) => {
            const p2 = +((r.price-openPrice)/openPrice*100).toFixed(2);
            return (
              <TouchableOpacity key={i} activeOpacity={0.7}
                onPress={() => setHogaPopup({price: r.price, pct: p2})} style={sc.hogaRow}>
                <View style={{flex: 1}}/>
                <View style={sc.hogaCenter}>
                  <Text style={sc.hogaPrice}>{fmt2(r.price)}</Text>
                  <Text style={sc.hogaPct}>{p2}%</Text>
                </View>
                <Text style={[sc.hogaQty, {textAlign: 'left'}]}>{r.qty}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={sc.cheolRow}>
            <Text style={sc.cheolText}>체결강도 <Text style={{color: C.red, fontWeight: '700'}}>104.50%</Text></Text>
          </View>
          <View style={sc.summaryGrid}>
            {[
              ['KP200',   fmt2(futuresData?.kospijisu ?? 0),  C.red],
              ['베이시스', fmt2(futuresData?.basis ?? 0),      C.blue],
              ['잔여일',  `${futuresData?.jandatecnt ?? 0}일`, '#333'],
              ['거래량',  fmtVol(futuresData?.volume ?? 0),    '#333'],
              ['미결제',  fmtVol(futuresData?.mgjv ?? 0),      '#333'],
              ['증감',    fmtVol(futuresData?.mgjvdiff ?? 0),  C.blue],
              ['시가',    fmt2(futuresData?.open ?? 0),        getSignColor(futuresData?.sign ?? '3')],
              ['고가',    fmt2(futuresData?.high ?? 0),        C.red],
              ['저가',    fmt2(futuresData?.low ?? 0),         C.blue],
            ].map(([k,v,c]) => (
              <View key={k as string} style={sc.summaryRow}>
                <Text style={sc.summaryLabel}>{k}</Text>
                <Text style={[sc.summaryVal, {color: c as string}]}>{v}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── 옵션전광판 ── */}
      {mainTab === '옵션전광판' && (
        <View style={{flex: 1}}>
          <View style={sc.optFilterBar}>
            <View style={sc.optViewBtns}>
              {(['전체','콜','풋'] as OptionView[]).map(v => (
                <TouchableOpacity key={v} onPress={() => setOptView(v)}
                  style={[sc.optViewBtn, optView === v && sc.optViewBtnActive]}>
                  <Text style={[sc.optViewBtnText, optView === v && sc.optViewBtnTextActive]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={sc.optHead}>
            <Text style={[sc.optHeadLabel, {color: C.red}]}>콜옵션</Text>
            <View style={sc.optHeadCenter}>
              <Text style={sc.optHeadSub}>등락</Text>
              <Text style={sc.optHeadSub}>현재가</Text>
            </View>
            <Text style={sc.optHeadStrike}>행사가</Text>
            <View style={sc.optHeadCenter}>
              <Text style={sc.optHeadSub}>현재가</Text>
              <Text style={sc.optHeadSub}>등락</Text>
            </View>
            <Text style={[sc.optHeadLabel, {color: C.blue}]}>풋옵션</Text>
          </View>
          {opts.length === 0 ? (
            <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
              <ActivityIndicator size="large" color={C.navy}/>
            </View>
          ) : (
            <ScrollView ref={optScrollRef} showsVerticalScrollIndicator={false}>
              {opts.map(({strike, call, put}) => {
                const isATM    = strike === atmStrike;
                const showCall = optView !== '풋';
                const showPut  = optView !== '콜';
                const callColor = getSignColor(call.sign);
                const putColor  = getSignColor(put.sign);
                return (
                  <View key={strike} style={[sc.optRow, isATM && sc.optRowATM]}>
                    {showCall
                      ? <Text style={[sc.optChg, {color: callColor}]}>
                          {['1','2'].includes(call.sign) ? '▲' : '▼'}{Math.abs(call.chg).toFixed(2)}
                        </Text>
                      : <View style={sc.optCell}/>}
                    {showCall
                      ? <TouchableOpacity style={[sc.optCell, {alignItems: 'flex-end'}]}
                          onPress={() => setOptPopup({item: {strike, call, put}, type: '콜'})}>
                          <Text style={[sc.optPrice, {color: callColor}]}>{fmt2(call.price)}</Text>
                        </TouchableOpacity>
                      : <View style={sc.optCell}/>}
                    <View style={[sc.optStrikeWrap, isATM && sc.optStrikeATM]}>
                      <Text style={[sc.optStrike, isATM && sc.optStrikeATMText]}>{strike.toFixed(2)}</Text>
                    </View>
                    {showPut
                      ? <TouchableOpacity style={sc.optCell}
                          onPress={() => setOptPopup({item: {strike, call, put}, type: '풋'})}>
                          <Text style={[sc.optPrice, {color: putColor}]}>{fmt2(put.price)}</Text>
                        </TouchableOpacity>
                      : <View style={sc.optCell}/>}
                    {showPut
                      ? <Text style={[sc.optChg, {color: putColor, textAlign: 'right'}]}>
                          {['1','2'].includes(put.sign) ? '▲' : '▼'}{Math.abs(put.chg).toFixed(2)}
                        </Text>
                      : <View style={sc.optCell}/>}
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      <HogaBottomSheet visible={!!hogaPopup} data={hogaPopup}
        onClose={() => setHogaPopup(null)} onOrder={openOrder}/>
      <OptionBottomSheet visible={!!optPopup} data={optPopup}
        onClose={() => setOptPopup(null)} onOrder={openOrder}/>
      </>)}
    </SafeAreaView>
  );
};

const sc = StyleSheet.create({
  container:           {flex: 1, backgroundColor: C.bg},
  backBtn:             {marginRight: 4},
  backBtnText:         {fontSize: 32, color: '#111', fontWeight: '300', lineHeight: 36},
  header:              {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10},
  headerLeft:          {flexDirection: 'row', alignItems: 'center', gap: 6},
  headerTitle:         {fontSize: 18, fontWeight: '800'},
  headerTriangle:      {width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#555', marginLeft: 4},
  headerRight:         {flexDirection: 'row', alignItems: 'center', gap: 10},
  dayToggle:           {flexDirection: 'row', borderWidth: 1.5, borderColor: C.navy, borderRadius: 8, overflow: 'hidden'},
  dayBtn:              {paddingHorizontal: 12, paddingVertical: 5},
  dayBtnActive:        {},
  dayBtnActiveText:    {fontSize: 13, fontWeight: '700', color: C.navy},
  dayBtnText:          {fontSize: 13, color: C.dimText},
  searchIcon:          {width: 22, height: 22, position: 'relative'},
  searchCircle:        {width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#111', position: 'absolute', top: 0, left: 0},
  searchHandle:        {width: 7, height: 2, backgroundColor: '#111', borderRadius: 1, transform: [{rotate: '45deg'}], position: 'absolute', bottom: 1, right: 0},
  dotsWrap:            {gap: 4},
  dot:                 {width: 4, height: 4, borderRadius: 2, backgroundColor: '#111'},
  priceSection:        {paddingHorizontal: 14, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end'},
  kp200Text:           {fontSize: 11, color: C.subText, marginBottom: 4},
  priceRow:            {flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4},
  bigPrice:            {fontSize: 32, fontWeight: '900'},
  pillRow:             {flexDirection: 'row', alignItems: 'center', gap: 8},
  pill:                {backgroundColor: C.pillBg, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3},
  pillText:            {color: C.red, fontWeight: '700', fontSize: 12},
  volText:             {color: C.dimText, fontSize: 12},
  investorWrap:        {alignItems: 'flex-end'},
  investorHeader:      {fontSize: 10, color: C.dimText, marginBottom: 2},
  investorRow:         {fontSize: 11, color: C.subText, lineHeight: 18},
  tabRow:              {flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border},
  tabBtn:              {paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 2.5, borderBottomColor: 'transparent'},
  tabBtnActive:        {borderBottomColor: C.navy},
  tabText:             {fontSize: 13, color: '#666'},
  tabTextActive:       {fontWeight: '700', color: C.navy},
  hogaHeadRow:         {flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.rowBg},
  hogaHeadText:        {flex: 1, fontSize: 11, color: C.dimText},
  hogaRow:             {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F7F7F7'},
  hogaQty:             {flex: 1, fontSize: 12, color: C.subText, textAlign: 'right'},
  hogaCenter:          {flex: 2, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6},
  hogaPrice:           {fontSize: 15, fontWeight: '700', color: C.red},
  hogaPct:             {fontSize: 11, color: C.red},
  currentRow:          {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.redBg, borderWidth: 1.5, borderColor: C.red, marginHorizontal: 6},
  cheolRow:            {paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.rowBg, borderTopWidth: 1, borderTopColor: C.border},
  cheolText:           {fontSize: 11, color: C.subText},
  summaryGrid:         {paddingHorizontal: 14, paddingVertical: 8},
  summaryRow:          {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#F5F5F5'},
  summaryLabel:        {fontSize: 12, color: C.subText},
  summaryVal:          {fontSize: 12, fontWeight: '600'},
  optFilterBar:        {flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', padding: 10, borderBottomWidth: 1, borderBottomColor: C.border},
  optViewBtns:         {flexDirection: 'row', gap: 4},
  optViewBtn:          {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: '#DDD', backgroundColor: C.bg},
  optViewBtnActive:    {borderColor: C.navy},
  optViewBtnText:      {fontSize: 11, color: '#666'},
  optViewBtnTextActive:{color: C.navy, fontWeight: '700'},
  optHead:             {flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.rowBg, borderBottomWidth: 1, borderBottomColor: C.border},
  optHeadLabel:        {width: 56, fontSize: 10, fontWeight: '700', textAlign: 'center'},
  optHeadCenter:       {flex: 1, flexDirection: 'row', justifyContent: 'space-around'},
  optHeadSub:          {fontSize: 10, color: C.subText},
  optHeadStrike:       {width: 70, fontSize: 10, fontWeight: '700', textAlign: 'center', color: '#555'},
  optRow:              {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F5F5F5'},
  optRowATM:           {backgroundColor: C.atmBg},
  optCell:             {flex: 1},
  optChg:              {width: 56, fontSize: 11, fontWeight: '600'},
  optPrice:            {fontSize: 13, fontWeight: '700'},
  optStrikeWrap:       {width: 70, alignItems: 'center', paddingVertical: 1},
  optStrikeATM:        {borderWidth: 1.5, borderColor: C.navy, borderRadius: 4},
  optStrike:           {fontSize: 12, fontWeight: '500', color: '#333'},
  optStrikeATMText:    {fontWeight: '800', color: C.navy},
});

export default FuturesOptionScreen;