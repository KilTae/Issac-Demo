import React, {useState, useEffect, useRef} from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, Modal, TextInput,
  TouchableOpacity, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  startBackgroundService, stopBackgroundService,
  isBackgroundServiceRunning, getBackgroundLogs,
} from '../services/AutoTradeService';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {
  placeOrder, modifyOrder, cancelOrder, getPendingOrders, getFuturesOrders,
  getFuturesHoga, getFuturesPrice, getFuturesBalance, getWeeklyOptionBoard,
  FuturesOrderItem, FuturesBalanceHolding, FuturesBalanceSummary,
  OrderPriceType,
} from '../api/lsApi';

const fmt2 = (n: number) => n.toFixed(2);
const fmtTime = (t: string) => {
  if (!t || t.length < 6) return t;
  return `${t.slice(0,2)}:${t.slice(2,4)}:${t.slice(4,6)}`;
};
const getSignColor = (sign: string) => {
  if (sign === '1' || sign === '2') return C.red;
  if (sign === '4' || sign === '5') return C.blue;
  return '#555';
};

const C = {
  bg:       '#FFFFFF',
  red:      '#E8001C',
  blue:     '#1A73E8',
  navy:     '#1A3BB8',
  border:   '#F0F0F0',
  dimText:  '#AAAAAA',
  subText:  '#888888',
  redBg:    '#FFF0F0',
  pillBg:   '#FFF0F0',
  mutedBg:  '#F0F3F9',
  darkNavy: '#1A2F6E',
  orange:   '#F5A623',
  green:    '#00897B',
};

type OrderMode = '매수' | '매도' | '정정/취소' | '체결' | '잔고' | '자동화';
type AutoSubTab = '추가' | '조회/수정';

// ── 자동화 상태 타입 ────────────────────────────────────────────────────────
type AutoStatus = 'idle' | 'monitoring' | 'ordered' | 'done' | 'error';
interface AutoConfig {
  putOptCode:    string;  // 풋옵션 종목코드 (t2105 조회용)
  putOptHname:   string;  // 풋옵션 종목명 (예: "P 월 W2 872.5") — 다음 위클리 탐색용
  putStrike:     number;  // 풋옵션 행사가 (코스피200)
  futuresCode:   string;  // 선물 종목코드 (주문용)
  futuresQty:    number;  // 선물 매수 수량
  exitThreshold: number;  // 옵션 청산 기준가
  exitEnabled:   boolean; // 청산 예약 활성화
  monitorStart:  string;  // HH:MM:SS
  orderDeadline: string;  // HH:MM:SS
}

const CandleIcon = ({color, size = 28}: {color: string; size?: number}) => {
  const w = size * 0.35;
  return (
    <View style={{width: w + 6, height: size, alignItems: 'center'}}>
      <View style={{width: 2, height: size * 0.18, backgroundColor: color}}/>
      <View style={{width: w, height: size * 0.58, backgroundColor: color, borderRadius: 1}}/>
      <View style={{width: 2, height: size * 0.24, backgroundColor: color}}/>
    </View>
  );
};

const OrderTypeButtons = ({orderType, setOrderType, accentColor, isBuy}: {
  orderType: OrderPriceType; setOrderType: (v: OrderPriceType) => void;
  accentColor: string; isBuy: boolean;
}) => (
  <View style={s.formBtnRow}>
    {([['00','지정가'],['03','시장가']] as [OrderPriceType, string][]).map(([code, label]) => (
      <TouchableOpacity key={code} onPress={() => setOrderType(code)}
        style={[s.outlineBtn, orderType === code && {borderColor: accentColor, backgroundColor: isBuy ? '#FFF0F0' : '#F0F5FF'}]}>
        <Text style={[s.outlineBtnText, orderType === code && {color: accentColor, fontWeight: '700'}]}>{label}</Text>
      </TouchableOpacity>
    ))}
  </View>
);

const MiniHoga = ({asks, bids, currentPrice, openPrice, selectedPrice, onSelect}: {
  asks: {price: number; qty: number}[]; bids: {price: number; qty: number}[];
  currentPrice: number; openPrice: number; selectedPrice: number; onSelect: (p: number) => void;
}) => {
  const askRows = [...asks].reverse();
  const allQtys = [...asks.map(r => r.qty), ...bids.map(r => r.qty)];
  const maxQty  = Math.max(...allQtys, 1);
  type Row = {price: number; qty: number; isCurrent?: boolean};
  const rows: Row[] = [...askRows, {price: currentPrice, qty: 0, isCurrent: true}, ...bids];
  return (
    <View style={ms.wrap}>
      <View style={ms.tabRow}>
        <Text style={ms.tabActive}>호가</Text>
        <Text style={ms.tabInactive}>체결</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {rows.map((r, i) => {
          const isAsk = !r.isCurrent && i < askRows.length;
          const isCur = r.isCurrent;
          const barW  = isCur ? 0 : Math.round((r.qty / maxQty) * 80);
          const isSelected = selectedPrice === r.price;
          const pct = openPrice > 0 ? +((r.price - openPrice) / openPrice * 100).toFixed(2) : 0;
          return (
            <TouchableOpacity key={i} onPress={() => !isCur && onSelect(r.price)}
              activeOpacity={isCur ? 1 : 0.7}
              style={[ms.row, isCur && ms.rowCurrent, isSelected && !isCur && ms.rowSelected]}>
              {!isCur && <View style={[ms.bar, {width: `${barW}%` as any}, isAsk ? ms.barAsk : ms.barBid]}/>}
              <View style={ms.rowContent}>
                <View>
                  <Text style={[ms.price, isCur && {fontWeight: '900', fontSize: 12}]}>{fmt2(r.price)}</Text>
                  <Text style={ms.pctText}>{pct > 0 ? '+' : ''}{pct}%</Text>
                </View>
                {!isCur && <Text style={ms.qty}>{r.qty}</Text>}
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

// 현재 날짜 기준 근월물 선물 코드 및 종목명 반환
// KP200 선물 만기: 3,6,9,12월 두 번째 목요일
// 코드: A016{월코드}000 (3→3, 6→6, 9→9, 12→C)
// 종목명: F{YYMM} (예: F2606, F2609, F2612, F2703)
const getNearestFuturesCode = (): { code: string; name: string } => {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1; // 1~12
  const quarters = [3, 6, 9, 12];
  let expMonth = quarters.find(q => q >= m) ?? 3;
  let expYear  = expMonth < m ? y + 1 : y;
  // 월코드: 3→3, 6→6, 9→9, 12→C
  const monthCode = expMonth === 12 ? 'C' : String(expMonth);
  const code = `A016${monthCode}000`;
  const yy   = String(expYear).slice(2);
  const mm   = String(expMonth).padStart(2, '0');
  const name = `F${yy}${mm}`;
  return { code, name };
};

// ── 메인 ─────────────────────────────────────────────────────────────────────
const OrderScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route      = useRoute<RouteProp<RootStackParamList, 'Order'>>();
  const {mode: initMode, shcode, price: initPrice, openPrice, sign, change, diff, hoga} = route.params;

  // ── 모든 Hook 최상단 선언 ─────────────────────────────────────────────────
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tab,                 setTab]                 = useState<OrderMode>(initMode);
  const [qty,                 setQty]                 = useState(0);
  const [px,                  setPx]                  = useState(initPrice);
  const [orderType,           setOrderType]           = useState<OrderPriceType>('00');
  const [submitting,          setSubmitting]          = useState(false);
  const [liveAsks,            setLiveAsks]            = useState(hoga?.asks ?? []);
  const [liveBids,            setLiveBids]            = useState(hoga?.bids ?? []);
  const [liveDvol,            setLiveDvol]            = useState(hoga?.dvol ?? 0);
  const [liveSvol,            setLiveSvol]            = useState(hoga?.svol ?? 0);
  const [holdings,            setHoldings]            = useState<FuturesBalanceHolding[]>([]);
  const [holdingSummary,      setHoldingSummary]      = useState<FuturesBalanceSummary | null>(null);
  const [holdingLoading,      setHoldingLoading]      = useState(false);
  const [pendingOrders,       setPendingOrders]       = useState<FuturesOrderItem[]>([]);
  const [pendingLoading,      setPendingLoading]      = useState(false);
  const [pendingSheetVisible, setPendingSheetVisible] = useState(false);
  const [pendingSheetFilter,  setPendingSheetFilter]  = useState<'전체'|'매수'|'매도'>('전체');
  const [selectedOrder,       setSelectedOrder]       = useState<FuturesOrderItem | null>(null);
  const [modifyQty,           setModifyQty]           = useState(0);
  const [modifyPx,            setModifyPx]            = useState(0);
  const [modifyOrderType,     setModifyOrderType]     = useState<OrderPriceType>('00');
  const [modifying,           setModifying]           = useState(false);
  const [orderHistory,        setOrderHistory]        = useState<FuturesOrderItem[]>([]);
  const [historyFilter,       setHistoryFilter]       = useState<'0'|'1'|'2'>('0');
  const [historyLoading,      setHistoryLoading]      = useState(false);

  // ── 자동화 탭 상태 ─────────────────────────────────────────────────────────
  // shcode가 'F'로 시작하면 선물 종목 → 조회/수정만 / 그 외(O,C 등) → 풋옵션 → 추가 + 조회/수정
  // hname이 'P ' 또는 'C '로 시작하면 옵션 종목, 아니면 선물
  // 예) "P 2주 월요일 882.50" → 옵션, "F 2606" → 선물, "A0166000" → 선물
  const hname = route.params.hname ?? '';
  const isOptionCode = /^[PC]\s/i.test(hname);
  const isFuturesCode = !isOptionCode;
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoConfigRef   = useRef<AutoConfig | null>(null);
  const autoKospiRef    = useRef<number | null>(null);
  const [autoSubTab,        setAutoSubTab]        = useState<AutoSubTab>(isFuturesCode ? '조회/수정' : '추가');
  const [autoStatus,        setAutoStatus]        = useState<AutoStatus>('idle');
  const [autoLog,           setAutoLog]           = useState<string[]>([]);
  const [autoKospi,         setAutoKospi]         = useState<number | null>(null);
  const [autoOptPrice,      setAutoOptPrice]      = useState<number | null>(null);
  const [autoFutPrice,      setAutoFutPrice]      = useState<number | null>(null);
  const [allSavedConfigs,   setAllSavedConfigs]   = useState<Record<string, AutoConfig>>({});
  const [bgRunning,         setBgRunning]         = useState(false);

  // 백그라운드 서비스 상태 + 로그 5초마다 동기화
  useEffect(() => {
    setBgRunning(isBackgroundServiceRunning());
    const sync = setInterval(async () => {
      const running = isBackgroundServiceRunning();
      setBgRunning(running);
      if (running) {
        const logs = await getBackgroundLogs();
        if (logs.length > 0) setAutoLog(logs);
        const val = await AsyncStorage.getItem('autoConfigs');
        if (val) setAllSavedConfigs(JSON.parse(val));
      }
    }, 5000);
    return () => clearInterval(sync);
  }, []);
  const [autoConfig,    setAutoConfig]    = useState<AutoConfig>({
    // 풋옵션 종목코드 — 현재 진입한 종목이 옵션이면 그 코드를 자동 세팅
    putOptCode:        isFuturesCode ? '' : (shcode ?? ''),
    putOptHname:       isFuturesCode ? '' : (route.params.hname ?? ''),
    // hname 끝 숫자가 행사가 (예: "P 2주 월요일 912.50" → 912.5)
    // 파싱 실패 시 initPrice 폴백
    putStrike: (() => {
      const hn = route.params.hname ?? '';
      const match = hn.match(/([\d.]+)\s*$/);
      return match ? Number(match[1]) : initPrice;
    })(),
    // 선물 종목코드 — 선물 종목에서 진입하면 현재 shcode, 아니면 빈값
    futuresCode:       isFuturesCode ? (shcode ?? '') : getNearestFuturesCode().code,
    futuresQty:        1,
    exitThreshold:     0.20,
    exitEnabled:       true,
    monitorStart:      '15:32:00',
    orderDeadline:     '15:35:00',
  });

  const addLog = (msg: string) => {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const ts  = `${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}:${String(kst.getUTCSeconds()).padStart(2,'0')}`;
    setAutoLog(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 100));
  };

  // ── 자동화 설정 저장/불러오기 (AsyncStorage) ──────────────────────────────
  // 고정 키에 {[putOptCode]: AutoConfig} 맵으로 저장
  const STORAGE_KEY = 'autoConfigs';
  const isConfigLoaded = useRef(false);

  // 진입 시 저장된 자동화 전체 목록 불러오기
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(val => {
      if (val) {
        try {
          const all: Record<string, AutoConfig> = JSON.parse(val);
          setAllSavedConfigs(all);
          // 옵션 종목이면 해당 종목 설정도 autoConfig에 세팅
          if (!isFuturesCode && shcode) {
            const saved = all[shcode];
            if (saved) {
              setAutoConfig(prev => ({...prev, ...saved}));
              console.log('✅ 자동화 설정 불러옴:', shcode);
            }
          }
        } catch {}
      }
      isConfigLoaded.current = true;
    }).catch(() => { isConfigLoaded.current = true; });
  }, []);

  const stopAutoMonitor = () => {
    if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null; }
    setAutoStatus(prev => prev === 'monitoring' ? 'idle' : prev);
  };

  // 자동화 탭에서 탭 이탈 시 인터벌 정리
  useEffect(() => {
    if (tab !== '자동화') stopAutoMonitor();
  }, [tab]);

  // 자동화 탭 진입 시 선물가 + 코스피200 현물 즉시 조회
  useEffect(() => {
    if (tab !== '자동화') return;
    // futuresCode가 없으면 근월물 선물 코드 자동 생성 (A016 + 월코드 + 000)
    let futCode = autoConfig.futuresCode;
    if (!futCode) {
      const now = new Date();
      const quarters = [3, 6, 9, 12];
      let y = now.getFullYear();
      let m = now.getMonth() + 1;
      const next = quarters.find(q => q >= m) ?? quarters[0];
      if (next < m) y += 1;
      const monthCode = next <= 9 ? String(next) : String.fromCharCode(55 + next);
      futCode = `A016${monthCode}000`;
    }
    getFuturesPrice(futCode)
      .then(d => { setAutoFutPrice(d.price); setAutoKospi(d.kospijisu); })
      .catch(() => {});
  }, [tab]);

  // autoConfig 변경 시 ref 동기화 — setInterval 클로저에서 최신값 참조용
  useEffect(() => { autoConfigRef.current = autoConfig; }, [autoConfig]);
  const nowHHMMSS = () => {
    const kst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
    return `${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}:${String(kst.getUTCSeconds()).padStart(2,'0')}`;
  };

  // 다음 위클리에서 같은 행사가 풋옵션 코드 탐색
  // hname 예) "P 월 W2 872.5" → 현재가 월요일 → 다음은 목요일(W2)
  //          "P 목 W3 872.5" → 현재가 목요일 → 다음은 월요일(W1)
  const findNextWeeklyPutCode = async (
    currentHname: string,
    strike: number,
  ): Promise<{optcode: string; yyyymm: string; nextHname: string} | null> => {
    // hname에서 현재 월/목 판별
    const isMon = currentHname.includes('월');
    addLog(`🔍 hname="${currentHname}" / isMon=${isMon} → 다음: ${isMon ? '목' : '월'}요일`);
    // 현재가 월요일이면 다음은 목요일, 목요일이면 다음은 월요일
    const nextDay: '월' | '목' = isMon ? '목' : '월';
    const nextYyyymm = nextDay === '목' ? 'W2 ' : 'W1 ';

    addLog(`🔍 현재: ${isMon ? '월요일' : '목요일'} → 다음: ${nextDay}요일(${nextYyyymm.trim()}) 탐색 중...`);

    try {
      const board = await getWeeklyOptionBoard(nextDay);
      if (board.puts.length === 0) {
        addLog(`❌ ${nextDay}요일 위클리 풋옵션 없음`);
        return null;
      }

      // 정확한 행사가 먼저 탐색
      const exact = board.puts.find(p => Math.abs(p.actprice - strike) < 0.01);
      if (exact) {
        const nextHname = `P ${nextDay} W? ${strike}`;
        addLog(`✅ 발견: ${exact.optcode} (행사가 ${exact.actprice})`);
        return { optcode: exact.optcode, yyyymm: nextYyyymm, nextHname };
      }

      // 없으면 가장 가까운 행사가
      const closest = board.puts.reduce((a, b) =>
        Math.abs(b.actprice - strike) < Math.abs(a.actprice - strike) ? b : a
      );
      addLog(`⚠️ 행사가 ${strike} 없음 → 가장 가까운 ${closest.actprice}: ${closest.optcode}`);
      return { optcode: closest.optcode, yyyymm: nextYyyymm, nextHname: `P ${nextDay} W? ${closest.actprice}` };

    } catch (e: any) {
      addLog(`❌ 위클리(${nextDay}) 조회 실패: ${e?.message}`);
      return null;
    }
  };

  // 자동화 설정 명시적 저장 (등록 버튼 누를 때 호출)
  const saveAutoConfig = async (cfg: AutoConfig) => {
    const saveKey = cfg.putOptCode || (shcode ?? '');
    if (!saveKey) return;
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEY);
      const all: Record<string, AutoConfig> = val ? JSON.parse(val) : {};
      all[saveKey] = cfg;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setAllSavedConfigs({...all});
      console.log('💾 자동화 저장 완료:', saveKey);
    } catch (e) {
      console.log('❌ 자동화 저장 실패:', e);
    }
  };

  // 자동화 설정 삭제
  const deleteAutoConfig = async (optCode: string) => {
    try {
      const val = await AsyncStorage.getItem(STORAGE_KEY);
      const all: Record<string, AutoConfig> = val ? JSON.parse(val) : {};
      delete all[optCode];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      setAllSavedConfigs({...all});
      console.log('🗑 자동화 삭제:', optCode);
    } catch (e) {
      console.log('❌ 자동화 삭제 실패:', e);
    }
  };

  const startAutoMonitor = () => {
    if (autoStatus === 'monitoring') return;
    if (!autoConfig.putOptCode.trim()) {
      Alert.alert('설정 오류', '풋옵션 종목코드를 입력해주세요.\n예) CAFB8760');
      return;
    }
    if (!autoConfig.futuresCode.trim()) {
      Alert.alert('설정 오류', '선물 종목코드를 입력해주세요.\n예) A0166000');
      return;
    }
    setAutoLog([]);
    setAutoStatus('monitoring');
    setAutoKospi(null);
    setAutoOptPrice(null);
    setAutoFutPrice(null);
    addLog('자동화 모니터링 시작');
    addLog(`풋옵션 코드: ${autoConfig.putOptCode} / 행사가: ${autoConfig.putStrike}`);
    addLog(`선물 자동 매수: ${autoConfig.futuresCode}`);
    if (autoConfig.exitEnabled) addLog(`청산 예약: ${autoConfig.exitThreshold.toFixed(2)} 이하`);

    // 백그라운드 서비스 시작 (앱 꺼져도 동작)
    if (!isBackgroundServiceRunning()) {
      startBackgroundService()
        .then(() => setBgRunning(true))
        .catch(e => console.log('❌ BG 시작 실패:', e?.message));
    }

    autoIntervalRef.current = setInterval(async () => {
      const now = nowHHMMSS();
      const cfg = autoConfigRef.current ?? autoConfig;  // null 안전

      if (now >= cfg.orderDeadline) {
        addLog(`⏰ 주문 마감 시각 ${cfg.orderDeadline} 도달`);
        if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null; }

        // 마감 시점에 코스피200 최신값 조회 후 조건 판단
        try {
          const futCode   = cfg.futuresCode || (shcode ?? 'A0166000');
          const priceData = await getFuturesPrice(futCode);
          const kospi200  = priceData.kospijisu;
          const futPrice  = priceData.price;
          setAutoKospi(kospi200);
          autoKospiRef.current = kospi200;
          setAutoFutPrice(futPrice);
          addLog(`마감 시점 코스피200: ${kospi200.toFixed(2)} / 행사가: ${cfg.putStrike}`);

          if (kospi200 < cfg.putStrike) {
            // 코스피 < 행사가 → 선물 매수
            addLog(`⚠️ 선물 매수 조건 충족! 코스피 ${kospi200.toFixed(2)} < 행사가 ${cfg.putStrike}`);
            addLog(`선물 매수 주문 — ${cfg.futuresCode} ${cfg.futuresQty}계약 @ ${(futPrice + 0.5).toFixed(2)}`);
            setAutoStatus('ordered');
            try {
              const res = await placeOrder({
                fnoIsuNo:  cfg.futuresCode,
                bnsTpCode: '2',
                orderType: '00',
                price:     +(futPrice + 0.5).toFixed(2),
                qty:       cfg.futuresQty,
              });
              const b2 = res.CFOAT00100OutBlock2;
              addLog(`✅ 선물 매수 완료 — 주문번호: ${b2?.OrdNo ?? '-'} / ${b2?.IsuNm ?? '-'}`);
              setAutoStatus('done');
              deleteAutoConfig(cfg.putOptCode);
              Alert.alert(
                '✅ 선물 매수 완료',
                `종목: ${b2?.IsuNm ?? cfg.futuresCode}\n주문번호: ${b2?.OrdNo ?? '-'}\n수량: ${cfg.futuresQty}계약\n가격: ${(futPrice + 0.5).toFixed(2)}`,
                [{text: '확인'}],
              );
            } catch (e: any) {
              addLog(`❌ 선물 매수 실패: ${e?.message ?? '알 수 없는 오류'}`);
              setAutoStatus('error');
            }
          } else {
            // 코스피 >= 행사가 → 다음 위클리 탐색
            addLog(`📋 코스피(${kospi200.toFixed(2)}) >= 행사가(${cfg.putStrike}) — 다음 위클리 탐색 시작`);
            const currentHname = cfg.putOptHname || route.params.hname || '';
            addLog(`🔍 현재 hname: "${currentHname}" / 행사가: ${cfg.putStrike}`);
            findNextWeeklyPutCode(currentHname, cfg.putStrike).then(result => {
              if (result) {
                setAutoConfig(prev => ({...prev, putOptCode: result.optcode, putOptHname: result.nextHname}));
                addLog(`🔄 다음 위클리 종목코드 자동 변경: ${result.optcode}`);
                Alert.alert(
                  '다음 위클리 재진입',
                  `코스피(${kospi200.toFixed(2)})가 행사가(${cfg.putStrike})보다 높습니다.\n\n다음 위클리 풋옵션:\n${result.optcode}\n\n추가 탭에서 확인 후 재등록하세요.`,
                  [{text: '확인'}],
                );
              } else {
                addLog('❌ 다음 위클리 종목 탐색 실패');
              }
            });
            setAutoStatus('done');
            deleteAutoConfig(cfg.putOptCode);
          }
        } catch (e: any) {
          addLog(`❌ 마감 시점 조회 실패: ${e?.message}`);
          setAutoStatus('error');
        }
        return;
      }

      if (now < cfg.monitorStart) {
        addLog(`⏳ ${cfg.monitorStart} 이후 활성화 (현재 ${now})`);
        return;
      }

      try {
        // ① 선물 현재가 + 코스피200 현물지수 (t2101)
        const futCode   = cfg.futuresCode || (shcode ?? 'A0166000');
        const priceData = await getFuturesPrice(futCode);
        const kospi200  = priceData.kospijisu;
        const futPrice  = priceData.price;
        setAutoKospi(kospi200);
        autoKospiRef.current = kospi200;
        setAutoFutPrice(futPrice);

        // ② 풋옵션 현재가 (t2105)
        const optHoga  = await getFuturesHoga(cfg.putOptCode);
        const optPrice = optHoga.price;
        setAutoOptPrice(optPrice);

        addLog(`코스피200: ${kospi200.toFixed(2)} | 풋옵션: ${optPrice.toFixed(2)}P | 선물: ${futPrice.toFixed(2)}`);

        // ③ 청산 예약: 옵션가 <= 기준가 → 풋옵션 자동 청산
        if (cfg.exitEnabled && optPrice <= cfg.exitThreshold) {
          addLog(`⚠️ 청산 조건 충족! 풋옵션가 ${optPrice.toFixed(2)} ≤ ${cfg.exitThreshold.toFixed(2)}`);
          addLog(`풋옵션 청산 주문 — ${cfg.putOptCode} 매수 @ 시장가`);

          if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null; }
          setAutoStatus('ordered');

          try {
            const res = await placeOrder({
              fnoIsuNo:  cfg.putOptCode,
              bnsTpCode: '1',   // 매도 청산 (풋매도 포지션 청산)
              orderType: '03',  // 시장가
              price:     0,
              qty:       1,
            });
            const b2 = res.CFOAT00100OutBlock2;
            addLog(`✅ 풋옵션 청산 완료 — 주문번호: ${b2?.OrdNo ?? '-'}`);
            setAutoStatus('done');
            deleteAutoConfig(cfg.putOptCode);
            Alert.alert(
              '✅ 풋옵션 청산 완료',
              `종목: ${cfg.putOptCode}\n주문번호: ${b2?.OrdNo ?? '-'}\n청산가: ${optPrice.toFixed(2)}P\n(기준가: ${cfg.exitThreshold.toFixed(2)}P 이하 도달)`,
              [{text: '확인'}],
            );
          } catch (e: any) {
            addLog(`❌ 풋옵션 청산 실패: ${e?.message ?? '알 수 없는 오류'}`);
            setAutoStatus('error');
          }
          return; // 청산 후 종료
        }

      } catch (e: any) {
        addLog(`❌ API 조회 실패: ${e?.message}`);
      }
    }, 10000);
  };

  // ── 호가 갱신 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchHoga = async () => {
      try {
        const data = await getFuturesHoga(shcode ?? 'A0166000');
        setLiveAsks(data.asks); setLiveBids(data.bids);
        setLiveDvol(data.dvol); setLiveSvol(data.svol);
      } catch (e: any) { console.log('❌ 호가 갱신 실패:', e?.message); }
    };
    fetchHoga();
    intervalRef.current = setInterval(fetchHoga, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // ── 잔고 탭 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== '잔고') return;
    setHoldingLoading(true);
    getFuturesBalance()
      .then(({summary, holdings: h}) => { setHoldingSummary(summary); setHoldings(h); })
      .catch(e => console.log('❌ 잔고 조회 실패:', e?.message))
      .finally(() => setHoldingLoading(false));
  }, [tab]);

  // ── 정정/취소 탭 진입 시 자동 조회 ───────────────────────────────────────
  useEffect(() => {
    if (tab !== '정정/취소') return;
    fetchPendingOrders();
  }, [tab]);

  // ── 체결 탭 ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== '체결') return;
    fetchOrderHistory(historyFilter);
  }, [tab]);

  const fetchPendingOrders = async () => {
    setPendingLoading(true);
    setSelectedOrder(null);
    try {
      const list = await getFuturesOrders('', '2', '1');
      console.log('📋 미체결 조회 결과:', JSON.stringify(list, null, 2));
      setPendingOrders(list);
      setPendingSheetVisible(true);
    } catch (e: any) {
      console.log('❌ 미체결 조회 실패:', e?.message);
      Alert.alert('조회 실패', e?.message ?? '미체결 조회에 실패했습니다.');
    } finally {
      setPendingLoading(false);
    }
  };

  const fetchOrderHistory = async (filter: '0'|'1'|'2') => {
    setHistoryLoading(true);
    try {
      let list: FuturesOrderItem[];
      if (filter === '0') {
        // 전체 = 미체결(전종목) + 체결(현재종목) 합치기
        const micheList = await getFuturesOrders('', '2', '1');
        await new Promise<void>(r => setTimeout(r, 500));
        const cheolList = await getFuturesOrders('', '1', '1');
        const merged = [...micheList, ...cheolList];
        const seen = new Set<number>();
        list = merged.filter(o => {
          if (seen.has(o.ordno)) return false;
          seen.add(o.ordno);
          return true;
        }).sort((a, b) => b.ordno - a.ordno);
      } else if (filter === '2') {
        // 미체결 — 전 종목
        list = await getFuturesOrders('', '2', '1');
      } else {
        // 체결 — 전 종목
        list = await getFuturesOrders('', '1', '1');
      }
      setOrderHistory(list);
    } catch (e: any) {
      Alert.alert('조회 실패', e?.message ?? '체결 조회에 실패했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleHistoryFilter = (f: '0'|'1'|'2') => {
    setHistoryFilter(f);
    fetchOrderHistory(f);
  };

  const handleSelectOrder = (order: FuturesOrderItem) => {
    setSelectedOrder(order);
    setModifyQty(order.ordrem);
    setModifyPx(order.price);
    setModifyOrderType('00');
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) { Alert.alert('알림', '취소할 주문을 선택해주세요.'); return; }
    Alert.alert(
      '취소주문 확인',
      `종목: ${selectedOrder.expcode}\n원주문번호: ${selectedOrder.ordno}\n` +
      `취소수량: ${selectedOrder.ordrem}계약\n\n취소하시겠습니까?`,
      [
        {text: '닫기', style: 'cancel'},
        {
          text: '확인',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await cancelOrder({
                fnoIsuNo: selectedOrder.expcode,
                orgOrdNo: selectedOrder.ordno,
                cancQty:  selectedOrder.ordrem,
              });
              const b2 = res.CFOAT00300OutBlock2;
              Alert.alert(
                res.rsp_msg ?? '취소 완료',
                `종목명: ${b2?.IsuNm ?? '-'}\n취소주문번호: ${b2?.OrdNo ?? '-'}`,
                [{text: '확인', onPress: () => { setSelectedOrder(null); fetchPendingOrders(); }}],
              );
            } catch (e: any) {
              Alert.alert('취소 실패', e?.message ?? '취소주문에 실패했습니다.');
            }
          },
        },
      ],
    );
  };

  const handleModifyOrder = async () => {
    if (!selectedOrder) { Alert.alert('알림', '정정할 주문을 선택해주세요.'); return; }
    if (modifyQty <= 0)  { Alert.alert('알림', '정정 수량을 입력해주세요.'); return; }
    if (modifyQty > selectedOrder.ordrem) {
      Alert.alert('알림', `미체결 수량(${selectedOrder.ordrem}계약)을 초과할 수 없습니다.`);
      return;
    }
    Alert.alert(
      '정정주문 확인',
      `종목: ${selectedOrder.expcode}\n원주문번호: ${selectedOrder.ordno}\n` +
      `정정가격: ${modifyOrderType === '03' ? '시장가' : `${fmt2(modifyPx)}P`}\n` +
      `정정수량: ${modifyQty}계약\n\n정정하시겠습니까?`,
      [
        {text: '취소', style: 'cancel'},
        {
          text: '확인',
          onPress: async () => {
            setModifying(true);
            try {
              const res = await modifyOrder({
                fnoIsuNo: selectedOrder.expcode, orgOrdNo: selectedOrder.ordno,
                fnoOrdprcPtnCode: modifyOrderType, fnoOrdPrc: modifyPx, mdfyQty: modifyQty,
              });
              const b2 = res.CFOAT00200OutBlock2;
              Alert.alert(
                res.rsp_msg ?? '정정 완료',
                `정정주문번호: ${b2?.OrdNo ?? '-'}\n주문가능수량: ${b2?.OrdAbleQty ?? '-'}계약`,
                [{text: '확인', onPress: () => fetchPendingOrders()}],
              );
            } catch (e: any) {
              Alert.alert('정정 실패', e?.message ?? '정정주문에 실패했습니다.');
            } finally {
              setModifying(false);
            }
          },
        },
      ],
    );
  };

  const handleOrder = async () => {
    if (qty <= 0) { Alert.alert('알림', '수량을 입력해주세요.'); return; }
    Alert.alert(
      `${tab} 확인`,
      `${tab} ${qty}계약 @ ${orderType === '03' ? '시장가' : `${px}P`}\n\n주문하시겠습니까?`,
      [
        {text: '취소', style: 'cancel'},
        {
          text: '확인',
          onPress: async () => {
            setSubmitting(true);
            try {
              const res = await placeOrder({
                fnoIsuNo: shcode ?? 'A0166000', bnsTpCode: isBuy ? '2' : '1',
                orderType, price: orderType === '03' ? 0 : px, qty,
              });
              const b2 = res.CFOAT00100OutBlock2;
              Alert.alert(
                res.rsp_msg ?? '주문 완료',
                `종목명: ${b2?.IsuNm ?? '-'}\n주문번호: ${b2?.OrdNo ?? '-'}\n주문가능수량: ${b2?.OrdAbleQty ?? '-'}계약`,
                [{text: '확인', onPress: () => navigation.goBack()}],
              );
            } catch (e: any) {
              Alert.alert('주문 실패', e?.message ?? '주문에 실패했습니다.');
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  const isBuy       = tab === '매수';
  const accentColor = isBuy ? C.red : C.blue;
  const priceColor  = getSignColor(sign ?? '3');
  const asks = liveAsks.length > 0 ? liveAsks : [5,4,3,2,1].map(i => ({price: +(initPrice + i * 0.05).toFixed(2), qty: 0}));
  const bids = liveBids.length > 0 ? liveBids : [1,2,3,4,5].map(i => ({price: +(initPrice - i * 0.05).toFixed(2), qty: 0}));
  // 선물 종목(F로 시작)이면 자동화 탭 하나만, 풋옵션이면 자동화 탭 하나(내부 서브탭으로 분기)
  const ORDER_TABS: OrderMode[] = ['매수', '매도', '자동화', '정정/취소', '체결', '잔고'];

  const getStatusColor = (status: string) => {
    if (status === '완료') return C.green;
    if (status === '접수') return C.navy;
    if (status === '취소') return C.subText;
    return '#333';
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg}/>

      {/* ── 헤더 ── */}
      <View style={s.topHeader}>
        <View style={s.topHeaderRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{top:12,bottom:12,left:12,right:12}}>
            <Text style={s.backBtn}>‹</Text>
          </TouchableOpacity>
          <Text style={s.topTitle}>{route.params.hname ?? 'F 2606'}</Text>
          <View style={s.dayToggle}>
            <View style={[s.dayBtn, {borderRightWidth:1, borderRightColor:C.navy}]}>
              <Text style={s.dayBtnActiveText}>주간</Text>
            </View>
            <View style={s.dayBtn}><Text style={s.dayBtnText}>야간</Text></View>
          </View>
        </View>
        <View style={s.priceRow}>
          <View>
            <View style={{flexDirection:'row', alignItems:'center', gap:4, marginBottom:4}}>
              <CandleIcon color={priceColor} size={26}/>
              <Text style={[s.bigPrice, {color: priceColor}]}>{fmt2(initPrice)}</Text>
            </View>
            <View style={s.pillRow}>
              <View style={s.pill}>
                <Text style={[s.pillText, {color: priceColor}]}>
                  {['1','2'].includes(sign ?? '') ? '▲' : '▼'}{fmt2(Math.abs(change ?? 0))}  {fmt2(Math.abs(diff ?? 0))}%
                </Text>
              </View>
              <Text style={s.volText}>{hoga?.volume?.toLocaleString() ?? '-'}</Text>
            </View>
          </View>
          <View style={s.investorWrap}>
            <Text style={s.investorHeader}>매도/매수 총잔량</Text>
            <Text style={s.investorRow}>매도 <Text style={{color:C.blue, fontWeight:'700'}}>{liveDvol.toLocaleString()}</Text></Text>
            <Text style={s.investorRow}>매수 <Text style={{color:C.red,  fontWeight:'700'}}>{liveSvol.toLocaleString()}</Text></Text>
          </View>
        </View>
      </View>

      {/* ── 계좌 바 ── */}
      <View style={s.acctBar}>
        <Text style={s.acctText}>555035393-51 [선물옵션] [파생이수]jookinho</Text>
        <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
          <Text style={{color:C.navy, fontWeight:'600', fontSize:12}}>예약</Text>
          <Text style={{fontSize:14}}>🔒</Text>
        </View>
      </View>

      {/* ── 탭 ── */}
      <View style={s.tabRow}>
        {ORDER_TABS.map(t => {
          const isActive = tab === t;
          const bg = isActive
            ? t === '자동화' ? C.green : accentColor
            : 'transparent';
          return (
            <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.8}
              style={[s.tabBtn, {backgroundColor: bg, minWidth: t === '정정/취소' || t === '자동화' ? 54 : undefined}]}>
              <Text style={[s.tabText, isActive && s.tabTextActive, t === '자동화' && !isActive && {color: C.green, fontWeight:'700'}]}>{t}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── 컨텐츠 ── */}
      <View style={{flex:1, flexDirection:'row'}}>

        {/* ── 잔고 ── */}
        {tab === '잔고' && (
          <ScrollView style={{flex:1}} contentContainerStyle={{padding:12}}>
            {holdingLoading ? (
              <View style={{alignItems:'center', marginTop:40}}>
                <ActivityIndicator size="large" color={C.navy}/>
                <Text style={{marginTop:8, color:C.subText, fontSize:13}}>잔고 조회 중...</Text>
              </View>
            ) : (
              <>
                {/* 상단 평가손익 */}
                <View style={{flexDirection:'row', alignItems:'center', gap:8, marginBottom:12}}>
                  <View style={s.holdingsBadge}><Text style={{fontSize:11}}>평가손익 ⋮</Text></View>
                  <Text style={{
                    color: (holdingSummary?.futsEvalPnlAmt ?? 0) + (holdingSummary?.optEvalPnlAmt ?? 0) >= 0 ? C.red : C.blue,
                    fontWeight:'800', fontSize:15, flex:1,
                  }}>
                    {holdingSummary
                      ? ((holdingSummary.futsEvalPnlAmt + holdingSummary.optEvalPnlAmt).toLocaleString())
                      : '-'}
                  </Text>
                  <TouchableOpacity style={s.holdingsBadge}><Text style={{fontSize:11}}>일괄청산</Text></TouchableOpacity>
                </View>

                {/* 헤더 */}
                <View style={s.holdingsHead}>
                  {['종목명\n구분','평균단가\n잔고','평가금액\n평가손익','손익율'].map((h,i) => (
                    <Text key={i} style={[s.holdingsHeadText, i > 0 && {textAlign:'right'}]}>{h}</Text>
                  ))}
                </View>

                {holdings.length === 0
                  ? <View style={{alignItems:'center', marginTop:30}}><Text style={{color:C.dimText, fontSize:13}}>보유 포지션이 없습니다</Text></View>
                  : holdings.map((h, i) => {
                    const pnlColor = h.evalPnl >= 0 ? C.red : C.blue;
                    return (
                      <View key={i} style={s.holdingsRow}>
                        {/* 종목명 / 매매구분 */}
                        <View style={{flex:1.4}}>
                          <Text style={{fontSize:12, fontWeight:'600'}}>{h.isuNm}</Text>
                          <Text style={{color: h.bnsTpCode === '2' ? C.red : C.blue, fontSize:11, marginTop:2}}>{h.bnsTpNm}</Text>
                        </View>
                        {/* 평균단가 / 잔고 */}
                        <View style={{flex:1, alignItems:'flex-end'}}>
                          <Text style={s.holdingsVal}>{h.fnoAvrPrc.toFixed(2)}</Text>
                          <Text style={s.holdingsVal}>{h.unsttQty}</Text>
                        </View>
                        {/* 평가금액 / 평가손익 */}
                        <View style={{flex:1.2, alignItems:'flex-end'}}>
                          <Text style={s.holdingsVal}>{h.evalAmt.toLocaleString()}</Text>
                          <Text style={[s.holdingsVal, {color:pnlColor}]}>{h.evalPnl.toLocaleString()}</Text>
                        </View>
                        {/* 손익율 */}
                        <View style={{flex:0.7, alignItems:'flex-end'}}>
                          <Text style={[s.holdingsVal, {color:pnlColor}]}>{h.pnlRat.toFixed(2)}%</Text>
                        </View>
                      </View>
                    );
                  })}

                {/* 하단 요약 */}
                {holdingSummary && (
                  <View style={{marginTop:12, borderTopWidth:1, borderTopColor:C.border, paddingTop:10, gap:6}}>
                    {[
                      ['선물평가손익', holdingSummary.futsEvalPnlAmt.toLocaleString() + '원', holdingSummary.futsEvalPnlAmt >= 0 ? C.red : C.blue],
                      ['옵션평가손익', holdingSummary.optEvalPnlAmt.toLocaleString()  + '원', holdingSummary.optEvalPnlAmt  >= 0 ? C.red : C.blue],
                      ['총손익',       holdingSummary.totPnlAmt.toLocaleString()       + '원', holdingSummary.totPnlAmt       >= 0 ? C.red : C.blue],
                      ['주문가능금액', holdingSummary.mnyOrdAbleAmt.toLocaleString()   + '원', '#333'],
                    ].map(([label, value, color]) => (
                      <View key={label as string} style={{flexDirection:'row', justifyContent:'space-between'}}>
                        <Text style={{fontSize:12, color:C.subText}}>{label}</Text>
                        <Text style={{fontSize:12, fontWeight:'700', color: color as string}}>{value}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        )}

        {/* ── 정정/취소 ── */}
        {tab === '정정/취소' && (
          <>
            <MiniHoga asks={asks} bids={bids} currentPrice={initPrice} openPrice={openPrice}
              selectedPrice={modifyPx} onSelect={p => setModifyPx(p)}/>
            <ScrollView style={{flex:1}} contentContainerStyle={s.formPad}>

              {/* 종목미체결 / 미체결 버튼 */}
              <View style={s.formBtnRow}>
                <TouchableOpacity style={s.outlineBtn} onPress={fetchPendingOrders}>
                  {pendingLoading
                    ? <ActivityIndicator size="small" color={C.navy}/>
                    : <Text style={s.outlineBtnText}>종목미체결</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.outlineBtn} onPress={fetchPendingOrders}>
                  {pendingLoading
                    ? <ActivityIndicator size="small" color={C.navy}/>
                    : <Text style={s.outlineBtnText}>미체결</Text>}
                </TouchableOpacity>
              </View>

              {/* 선택된 주문 or 주문번호 박스 */}
              {selectedOrder ? (
                <TouchableOpacity style={s.selectedOrderBadge} onPress={() => setSelectedOrder(null)}>
                  <Text style={s.selectedOrderText}>
                    {selectedOrder.expcode} · {selectedOrder.medosu} {selectedOrder.ordrem}계약 · {fmt2(selectedOrder.price)}P  ✕
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={s.ordNoBox} onPress={fetchPendingOrders}>
                  <Text style={{fontSize:13, color:C.dimText}}>주문번호</Text>
                </TouchableOpacity>
              )}

              {/* 호가유형 */}
              <View style={s.formBtnRow}>
                {([['00','지정가'],['03','시장가']] as [OrderPriceType, string][]).map(([code, label]) => (
                  <TouchableOpacity key={code} onPress={() => setModifyOrderType(code)}
                    style={[s.outlineBtn, modifyOrderType === code && {borderColor: C.navy, backgroundColor:'#EEF2FF'}]}>
                    <Text style={[s.outlineBtnText, modifyOrderType === code && {color: C.navy, fontWeight:'700'}]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 가능 / 잔량전부 */}
              <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <Text style={{fontSize:12, color:C.subText}}>
                  가능 {selectedOrder ? `${selectedOrder.ordrem}계약` : '-'}
                </Text>
                <TouchableOpacity style={s.smallBtn}>
                  <Text style={{fontSize:11, color:'#555'}}>잔량전부 ▾</Text>
                </TouchableOpacity>
              </View>

              {/* 수량 스텝퍼 */}
              <View style={s.stepper}>
                <TouchableOpacity onPress={() => setModifyQty(q => Math.max(1, q-1))} style={s.stepBtn}><Text style={s.stepBtnText}>−</Text></TouchableOpacity>
                <Text style={s.stepVal}>{modifyQty} <Text style={s.stepUnit}>계약</Text></Text>
                <TouchableOpacity onPress={() => setModifyQty(q => Math.min(selectedOrder?.ordrem ?? 99, q+1))} style={s.stepBtn}><Text style={s.stepBtnText}>+</Text></TouchableOpacity>
              </View>

              {/* 가격 스텝퍼 */}
              <View style={[s.stepper, modifyOrderType === '03' && {opacity:0.4}]}>
                <TouchableOpacity onPress={() => setModifyPx(p => +(p-0.05).toFixed(2))} style={s.stepBtn} disabled={modifyOrderType === '03'}><Text style={s.stepBtnText}>−</Text></TouchableOpacity>
                <Text style={[s.stepVal, {color: C.navy}]}>
                  {modifyOrderType === '03' ? '시장가' : fmt2(modifyPx)}
                  {modifyOrderType !== '03' && <Text style={s.stepUnit}> P</Text>}
                </Text>
                <TouchableOpacity onPress={() => setModifyPx(p => +(p+0.05).toFixed(2))} style={s.stepBtn} disabled={modifyOrderType === '03'}><Text style={s.stepBtnText}>+</Text></TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => {
                if (selectedOrder) { setModifyQty(selectedOrder.ordrem); setModifyPx(selectedOrder.price); }
                setModifyOrderType('00');
              }}>
                <Text style={s.resetText}>초기화</Text>
              </TouchableOpacity>

              {/* 정정 / 취소 버튼 */}
              <View style={s.formBtnRow}>
                <TouchableOpacity style={[s.actionBtn, {flex:1, backgroundColor: C.navy, opacity: modifying ? 0.7 : 1}]}
                  onPress={handleModifyOrder} disabled={modifying}>
                  {modifying
                    ? <ActivityIndicator color="#FFF" size="small"/>
                    : <Text style={s.actionBtnText}>정정주문</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[s.actionBtn, {flex:1, backgroundColor: C.orange}]}
                  onPress={handleCancelOrder}>
                  <Text style={s.actionBtnText}>취소주문</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* ── 미체결 바텀시트 ── */}
            <Modal visible={pendingSheetVisible} transparent animationType="slide"
              onRequestClose={() => setPendingSheetVisible(false)}>
              <TouchableOpacity style={pbs.overlay} activeOpacity={1}
                onPress={() => setPendingSheetVisible(false)}>
                <TouchableOpacity activeOpacity={1} style={pbs.sheet}>
                  <View style={pbs.handle}/>
                  <View style={pbs.header}>
                    <Text style={pbs.title}>미체결 내역</Text>
                  </View>
                  {/* 필터 + 버튼 */}
                  <View style={pbs.filterRow}>
                    <View style={{flexDirection:'row'}}>
                      {(['전체','매수','매도'] as const).map(f => (
                        <TouchableOpacity key={f} onPress={() => setPendingSheetFilter(f)}
                          style={[pbs.filterBtn, pendingSheetFilter === f && pbs.filterBtnActive]}>
                          <Text style={[pbs.filterText, pendingSheetFilter === f && pbs.filterTextActive]}>{f}</Text>
                          {pendingSheetFilter === f && <View style={pbs.filterUnderline}/>}
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{flexDirection:'row', gap:8}}>
                      <TouchableOpacity style={pbs.actionSmallBtn}>
                        <Text style={pbs.actionSmallBtnText}>일괄취소</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={pbs.actionSmallBtn} onPress={fetchPendingOrders}>
                        <Text style={pbs.actionSmallBtnText}>새로고침</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {/* 목록 */}
                  <ScrollView showsVerticalScrollIndicator={false} style={{flex:1}}>
                    {pendingOrders.filter(o => pendingSheetFilter === '전체' || o.medosu === pendingSheetFilter).length === 0 ? (
                      <View style={{alignItems:'center', paddingVertical:40}}>
                        <Text style={{color:C.dimText, fontSize:14}}>미체결 주문이 없습니다</Text>
                      </View>
                    ) : (
                      pendingOrders
                        .filter(o => pendingSheetFilter === '전체' || o.medosu === pendingSheetFilter)
                        .map(order => {
                          const isBuyO = order.medosu === '매수';
                          return (
                            <TouchableOpacity key={order.ordno} style={pbs.card}
                              onPress={() => { handleSelectOrder(order); setPendingSheetVisible(false); }}
                              activeOpacity={0.7}>
                              <View style={pbs.cardHeader}>
                                <Text style={[pbs.cardMedosu, {color: isBuyO ? C.red : C.blue}]}>{order.medosu}</Text>
                                <Text style={pbs.cardOrdNo}>{order.ordno}</Text>
                                <Text style={pbs.cardName}>{order.expcode}</Text>
                              </View>
                              <View style={pbs.cardBody}>
                                <View style={pbs.cardRow}>
                                  <Text style={pbs.cardLabel}>주문량</Text>
                                  <Text style={pbs.cardVal}>{order.qty}</Text>
                                  <Text style={pbs.cardLabel}>주문유형</Text>
                                  <Text style={pbs.cardVal}>{order.ordgb}</Text>
                                </View>
                                <View style={pbs.cardRow}>
                                  <Text style={pbs.cardLabel}>미체결량</Text>
                                  <Text style={[pbs.cardVal, {color: C.navy, fontWeight:'700'}]}>{order.ordrem}</Text>
                                  <Text style={pbs.cardLabel}>주문가</Text>
                                  <Text style={[pbs.cardVal, {fontWeight:'700'}]}>{fmt2(order.price)}</Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })
                    )}
                  </ScrollView>
                </TouchableOpacity>
              </TouchableOpacity>
            </Modal>
          </>
        )}

        {/* ── 체결 ── */}
        {tab === '체결' && (
          <View style={{flex:1}}>
            <View style={s.historyFilterRow}>
              {([['0','전체'],['1','체결'],['2','미체결']] as ['0'|'1'|'2', string][]).map(([f, label]) => (
                <TouchableOpacity key={f} onPress={() => handleHistoryFilter(f)}
                  style={[s.historyFilterBtn, historyFilter === f && s.historyFilterBtnActive]}>
                  <Text style={[s.historyFilterText, historyFilter === f && s.historyFilterTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => fetchOrderHistory(historyFilter)}
                hitSlop={{top:8,bottom:8,left:8,right:8}} style={{marginLeft:'auto'}}>
                <Text style={{fontSize:12, color:C.navy, fontWeight:'600'}}>새로고침</Text>
              </TouchableOpacity>
            </View>
            <View style={s.historyHead}>
              <Text style={[s.historyHeadText, {flex:1.5}]}>종목/시간</Text>
              <Text style={[s.historyHeadText, {flex:1, textAlign:'center'}]}>구분</Text>
              <Text style={[s.historyHeadText, {flex:1, textAlign:'right'}]}>주문가</Text>
              <Text style={[s.historyHeadText, {flex:1, textAlign:'right'}]}>체결가</Text>
              <Text style={[s.historyHeadText, {flex:1, textAlign:'right'}]}>수량</Text>
              <Text style={[s.historyHeadText, {flex:1, textAlign:'right'}]}>상태</Text>
            </View>
            {historyLoading ? (
              <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
                <ActivityIndicator size="large" color={C.navy}/>
              </View>
            ) : orderHistory.length === 0 ? (
              <View style={{flex:1, alignItems:'center', justifyContent:'center'}}>
                <Text style={{color:C.dimText, fontSize:13}}>내역이 없습니다</Text>
              </View>
            ) : (
              <FlatList
                data={orderHistory}
                keyExtractor={item => String(item.ordno)}
                showsVerticalScrollIndicator={false}
                renderItem={({item}) => {
                  const isBuyO    = item.medosu === '매수';
                  const statusClr = getStatusColor(item.status);
                  return (
                    <View style={s.historyRow}>
                      <View style={{flex:1.5}}>
                        <Text style={{fontSize:12, fontWeight:'600'}}>{item.expcode}</Text>
                        <Text style={{fontSize:10, color:C.subText, marginTop:1}}>{fmtTime(item.ordtime)} · #{item.ordno}</Text>
                      </View>
                      <Text style={[s.historyCell, {flex:1, textAlign:'center', color: isBuyO ? C.red : C.blue, fontWeight:'700'}]}>{item.medosu}</Text>
                      <Text style={[s.historyCell, {flex:1, textAlign:'right'}]}>{fmt2(item.price)}</Text>
                      <Text style={[s.historyCell, {flex:1, textAlign:'right', color: item.cheqty > 0 ? C.green : C.dimText}]}>
                        {item.cheqty > 0 ? fmt2(item.cheprice) : '-'}
                      </Text>
                      <View style={{flex:1, alignItems:'flex-end'}}>
                        <Text style={s.historyCell}>{item.qty}계약</Text>
                        {item.ordrem > 0 && <Text style={{fontSize:10, color:C.orange}}>잔{item.ordrem}</Text>}
                      </View>
                      <View style={{flex:1, alignItems:'flex-end'}}>
                        <Text style={[s.historyCell, {color: statusClr, fontWeight:'700'}]}>{item.status}</Text>
                        <Text style={{fontSize:10, color:C.subText}}>{item.ordgb}</Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}

        {/* ── 자동화 ── */}
        {tab === '자동화' && (
          <View style={{flex:1}}>

            {/* ── 서브탭: 선물이면 조회/수정만 / 옵션이면 추가 + 조회/수정 ── */}
            <View style={as.subTabRow}>
              {!isFuturesCode && (
                <TouchableOpacity
                  onPress={() => setAutoSubTab('추가')}
                  style={[as.subTabBtn, autoSubTab === '추가' && as.subTabBtnActive]}>
                  <Text style={[as.subTabText, autoSubTab === '추가' && as.subTabTextActive]}>추가</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => setAutoSubTab('조회/수정')}
                style={[as.subTabBtn, autoSubTab === '조회/수정' && as.subTabBtnActive]}>
                <Text style={[as.subTabText, autoSubTab === '조회/수정' && as.subTabTextActive]}>조회/수정</Text>
              </TouchableOpacity>
            </View>

            {/* ══════════════════════════════════════════════
                서브탭: 추가 (풋옵션 종목에서만)
            ══════════════════════════════════════════════ */}
            {autoSubTab === '추가' && !isFuturesCode && (
              <ScrollView style={{flex:1}} contentContainerStyle={{padding:12, gap:12}}>

                {/* ══ 섹션 1: 풋옵션 매도 설정 ══ */}
                <View style={as.tlSection}>
                  <View style={as.tlHeader}>
                    <View style={as.tlDot}/>
                    <Text style={as.tlTitle}>풋옵션 매도 설정</Text>
                    <Text style={as.tlDesc}>장중 직접 주문 후 아래 값을 일치시켜 주세요</Text>
                  </View>

                  {/* 풋옵션 종목코드 */}
                  <View style={as.tlRow}>
                    <Text style={as.tlLabel}>종목코드</Text>
                    <View style={as.summaryCodeBox}>
                      <Text style={as.summaryCode}>{autoConfig.putOptCode || (shcode ?? '-')}</Text>
                    </View>
                    <Text style={as.tlMeta}>현재 종목 자동 입력</Text>
                  </View>

                  {/* 행사가 */}
                  <View style={as.tlRow}>
                    <Text style={as.tlLabel}>행사가</Text>
                    <View style={[s.stepper, {flex:1}]}>
                      <TouchableOpacity onPress={() => setAutoConfig(c => ({...c, putStrike: +(c.putStrike - 2.5).toFixed(2)}))} style={s.stepBtn} disabled={autoStatus === 'monitoring'}>
                        <Text style={s.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={[s.stepVal, {color:C.red}]}>{autoConfig.putStrike.toFixed(2)}</Text>
                      <TouchableOpacity onPress={() => setAutoConfig(c => ({...c, putStrike: +(c.putStrike + 2.5).toFixed(2)}))} style={s.stepBtn} disabled={autoStatus === 'monitoring'}>
                        <Text style={s.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                </View>

                {/* ── 선물-현물 / 행사-현물 ── */}
                <View style={as.tlSection}>
                  <View style={as.tlHeader}>
                    <View style={as.tlDot}/>
                    <Text style={as.tlTitle}>현물 대비</Text>
                    {(autoFutPrice === null || autoKospi === null) && (
                      <Text style={as.tlDesc}>자동화 탭 진입 시 자동 조회</Text>
                    )}
                  </View>

                  {/* 선물 - 현물 */}
                  <View style={as.tlRow}>
                    <Text style={as.tlLabel}>선물 - 현물</Text>
                    <View style={as.diffBox}>
                      {autoFutPrice !== null && autoKospi !== null ? (
                        <Text style={as.diffText}>
                          {autoFutPrice.toFixed(2)}
                          <Text style={{color:C.subText}}> - </Text>
                          {autoKospi.toFixed(2)}
                          <Text style={{color:C.subText}}> = </Text>
                          <Text style={{color: (autoFutPrice - autoKospi) >= 0 ? C.red : C.blue, fontWeight:'800'}}>
                            {(autoFutPrice - autoKospi).toFixed(2)}
                          </Text>
                        </Text>
                      ) : (
                        <Text style={[as.diffText, {color:C.dimText}]}>조회 중...</Text>
                      )}
                    </View>
                  </View>

                  {/* 행사 - 현물 */}
                  <View style={as.tlRow}>
                    <Text style={as.tlLabel}>행사 - 현물</Text>
                    <View style={as.diffBox}>
                      {autoKospi !== null ? (
                        <Text style={as.diffText}>
                          {autoConfig.putStrike.toFixed(2)}
                          <Text style={{color:C.subText}}> - </Text>
                          {autoKospi.toFixed(2)}
                          <Text style={{color:C.subText}}> = </Text>
                          <Text style={{color: (autoConfig.putStrike - autoKospi) >= 0 ? C.red : C.blue, fontWeight:'800'}}>
                            {(autoConfig.putStrike - autoKospi).toFixed(2)}
                          </Text>
                        </Text>
                      ) : (
                        <Text style={[as.diffText, {color:C.dimText}]}>조회 중...</Text>
                      )}
                    </View>
                  </View>

                  {/* 새로고침 */}
                  <TouchableOpacity
                    onPress={() => {
                      let futCode = autoConfig.futuresCode;
                      if (!futCode) {
                        const now = new Date();
                        const quarters = [3, 6, 9, 12];
                        let y = now.getFullYear();
                        let m = now.getMonth() + 1;
                        const next = quarters.find(q => q >= m) ?? quarters[0];
                        if (next < m) y += 1;
                        const monthCode = next <= 9 ? String(next) : String.fromCharCode(55 + next);
                        futCode = `A016${monthCode}000`;
                      }
                      getFuturesPrice(futCode)
                        .then(d => { setAutoFutPrice(d.price); setAutoKospi(d.kospijisu); })
                        .catch(() => {});
                    }}
                    style={{alignSelf:'flex-end'}}>
                    <Text style={{fontSize:11, color:C.navy, fontWeight:'600'}}>새로고침</Text>
                  </TouchableOpacity>
                </View>

                {/* ══ 섹션 2: 청산 기준 ══ */}
                <View style={as.tlSection}>
                  <View style={as.tlHeader}>
                    <View style={as.tlDot}/>
                    <Text style={as.tlTitle}>청산 기준</Text>
                    <Text style={as.tlDesc}>옵션가 기준 자동 알림 (수동 청산)</Text>
                  </View>

                  <View style={as.tlRow}>
                    <TouchableOpacity onPress={() => setAutoConfig(c => ({...c, exitEnabled: !c.exitEnabled}))} style={as.checkbox} disabled={autoStatus === 'monitoring'}>
                      <View style={[as.checkboxBox, autoConfig.exitEnabled && as.checkboxBoxChecked]}>
                        {autoConfig.exitEnabled && <Text style={as.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                    <Text style={as.checkLabel}>청산 예약</Text>
                    <View style={[s.stepper, {flex:1, opacity: autoConfig.exitEnabled ? 1 : 0.4}]}>
                      <TouchableOpacity onPress={() => setAutoConfig(c => ({...c, exitThreshold: +(c.exitThreshold - 0.05).toFixed(2)}))} style={s.stepBtn} disabled={!autoConfig.exitEnabled || autoStatus === 'monitoring'}>
                        <Text style={s.stepBtnText}>−</Text>
                      </TouchableOpacity>
                      <TextInput
                        style={[s.stepVal, {color:C.blue, fontSize:13, textAlign:'center', minWidth:60, padding:0}]}
                        value={autoConfig.exitThreshold.toFixed(2)}
                        onChangeText={v => {
                          const n = parseFloat(v);
                          if (!isNaN(n) && n >= 0) setAutoConfig(c => ({...c, exitThreshold: n}));
                          else if (v === '' || v === '.') setAutoConfig(c => ({...c, exitThreshold: 0}));
                        }}
                        keyboardType="decimal-pad"
                        editable={autoConfig.exitEnabled && autoStatus !== 'monitoring'}
                        selectTextOnFocus
                      />
                      <TouchableOpacity onPress={() => setAutoConfig(c => ({...c, exitThreshold: +(c.exitThreshold + 0.05).toFixed(2)}))} style={s.stepBtn} disabled={!autoConfig.exitEnabled || autoStatus === 'monitoring'}>
                        <Text style={s.stepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={[as.nowExitBtn, (!autoConfig.exitEnabled || autoStatus === 'monitoring') && {opacity:0.4}]}
                      disabled={!autoConfig.exitEnabled || autoStatus === 'monitoring'}
                      onPress={() => Alert.alert(
                        '지금 청산',
                        `풋옵션 ${autoConfig.putOptCode}을 지금 청산하시겠습니까?\n(수동 주문 화면으로 이동합니다)`,
                        [
                          {text: '취소', style: 'cancel'},
                          {text: '청산', style: 'destructive', onPress: () => {
                            addLog(`⚠️ 지금 청산 요청 — ${autoConfig.putOptCode}`);
                            navigation.navigate('Order', {
                              mode:      '매수',
                              shcode:    autoConfig.putOptCode,
                              hname:     autoConfig.putOptCode,
                              price:     autoOptPrice ?? 0,
                              openPrice: autoOptPrice ?? 0,
                              sign:      '3',
                              change:    0,
                              diff:      0,
                            });
                          }},
                        ]
                      )}>
                      <Text style={as.nowExitBtnText}>지금{'\n'}청산</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 현재 옵션가 표시 */}
                  <View style={{flexDirection:'row', alignItems:'center', gap:6, paddingLeft:4}}>
                    <Text style={{fontSize:12, color:C.subText}}>현재 옵션가</Text>
                    <Text style={{
                      fontSize:13, fontWeight:'700',
                      color: autoOptPrice !== null && autoConfig.exitEnabled && autoOptPrice <= autoConfig.exitThreshold
                        ? C.orange : '#333',
                    }}>
                      {autoOptPrice !== null ? `${autoOptPrice.toFixed(2)} P` : '-'}
                    </Text>
                    {autoOptPrice !== null && autoConfig.exitEnabled && autoOptPrice <= autoConfig.exitThreshold && (
                      <Text style={{fontSize:11, color:C.orange, fontWeight:'700'}}>← 청산 기준 도달</Text>
                    )}
                  </View>
                </View>

                {/* ══ 섹션 3: 선물 자동 매수 ══ */}
                <View style={as.tlSection}>
                  <View style={as.tlHeader}>
                    <View style={as.tlDot}/>
                    <Text style={as.tlTitle}>선물 자동 매수</Text>
                    <Text style={as.tlDesc}>코스피200 현물 &lt; 행사가 조건 충족 시 실행</Text>
                  </View>

                  <View style={{gap:8, opacity: autoStatus === 'monitoring' ? 0.5 : 1}}>
                    <View style={as.tlRow}>
                      <Text style={as.tlLabel}>선물 코드</Text>
                      <View style={{flex:1, gap:4}}>
                        <View style={[as.textInput, {flex:1, justifyContent:'center'}]}>
                          <Text style={{fontSize:13, fontWeight:'700', color:'#111'}}>
                            {getNearestFuturesCode().name} ({getNearestFuturesCode().code})
                          </Text>
                        </View>
                        <Text style={{fontSize:11, color:C.dimText, paddingLeft:2}}>
                          만기 기준 자동 설정 (분기별 갱신)
                        </Text>
                      </View>
                    </View>
                    <View style={as.tlRow}>
                      <Text style={as.tlLabel}>매수 수량</Text>
                      <View style={[s.stepper, {flex:1}]}>
                        <TouchableOpacity onPress={() => setAutoConfig(c => ({...c, futuresQty: Math.max(1, c.futuresQty - 1)}))} style={s.stepBtn} disabled={autoStatus === 'monitoring'}>
                          <Text style={s.stepBtnText}>−</Text>
                        </TouchableOpacity>
                        <Text style={s.stepVal}>{autoConfig.futuresQty} <Text style={s.stepUnit}>계약</Text></Text>
                        <TouchableOpacity onPress={() => setAutoConfig(c => ({...c, futuresQty: c.futuresQty + 1}))} style={s.stepBtn} disabled={autoStatus === 'monitoring'}>
                          <Text style={s.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={as.infoBox}>
                      <Text style={as.infoText}>주문가 = 선물 현재가 (t2101) + 0.5</Text>
                    </View>
                  </View>
                </View>

                {/* ══ 섹션 4: 시간 설정 ══ */}
                <View style={as.tlSection}>
                  <View style={as.tlHeader}>
                    <View style={as.tlDot}/>
                    <Text style={as.tlTitle}>시간 설정</Text>
                    <Text style={as.tlDesc}>모니터링 시작 ~ 주문 마감 시간을 설정하세요</Text>
                  </View>

                  {/* 시간 조절 헬퍼 */}
                  {(['monitorStart', 'orderDeadline'] as const).map(field => {
                    const val   = autoConfig[field];               // "HH:MM:SS"
                    const [hh, mm] = val.split(':').map(Number);
                    const label = field === 'monitorStart' ? '모니터링 시작' : '주문 마감';
                    const color = field === 'monitorStart' ? C.green : C.red;

                    const setTime = (newHH: number, newMM: number) => {
                      const t = `${String(Math.max(0,Math.min(23,newHH))).padStart(2,'0')}:${String(Math.max(0,Math.min(59,newMM))).padStart(2,'0')}:00`;
                      setAutoConfig(c => ({...c, [field]: t}));
                    };

                    return (
                      <View key={field} style={{gap:4}}>
                        <Text style={[as.tlLabel, {color}]}>{label}</Text>
                        <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
                          {/* 시 스텝퍼 */}
                          <View style={[s.stepper, {flex:1}]}>
                            <TouchableOpacity onPress={() => setTime(hh-1, mm)} style={s.stepBtn} disabled={autoStatus==='monitoring'}>
                              <Text style={s.stepBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={[s.stepVal, {color, fontSize:16}]}>{String(hh).padStart(2,'0')}시</Text>
                            <TouchableOpacity onPress={() => setTime(hh+1, mm)} style={s.stepBtn} disabled={autoStatus==='monitoring'}>
                              <Text style={s.stepBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                          <Text style={{fontSize:14, color:C.dimText}}>:</Text>
                          {/* 분 스텝퍼 */}
                          <View style={[s.stepper, {flex:1}]}>
                            <TouchableOpacity onPress={() => setTime(hh, mm-1)} style={s.stepBtn} disabled={autoStatus==='monitoring'}>
                              <Text style={s.stepBtnText}>−</Text>
                            </TouchableOpacity>
                            <Text style={[s.stepVal, {color, fontSize:16}]}>{String(mm).padStart(2,'0')}분</Text>
                            <TouchableOpacity onPress={() => setTime(hh, mm+1)} style={s.stepBtn} disabled={autoStatus==='monitoring'}>
                              <Text style={s.stepBtnText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* ── 상태 배너 ── */}
                {autoStatus === 'monitoring' && (
                  <View style={[as.statusBanner, {borderColor:C.green, backgroundColor:'#E8F5E9'}]}>
                    <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
                      <ActivityIndicator size="small" color={C.green}/>
                      <Text style={[as.statusText, {color:C.green}]}>
                        모니터링 중 (10초 간격){bgRunning ? '  ·  백그라운드 ✓' : ''}
                      </Text>
                    </View>
                    {(autoKospi !== null || autoOptPrice !== null) && (
                      <View style={{flexDirection:'row', gap:20, marginTop:8}}>
                        {autoKospi !== null && (
                          <View>
                            <Text style={as.statusSubLabel}>코스피200</Text>
                            <Text style={[as.statusSubVal, {color: autoKospi < autoConfig.putStrike ? C.red : C.blue}]}>{autoKospi.toFixed(2)}</Text>
                          </View>
                        )}
                        {autoOptPrice !== null && (
                          <View>
                            <Text style={as.statusSubLabel}>풋옵션가</Text>
                            <Text style={[as.statusSubVal, {color: autoConfig.exitEnabled && autoOptPrice <= autoConfig.exitThreshold ? C.orange : '#333'}]}>{autoOptPrice.toFixed(2)} P</Text>
                          </View>
                        )}
                        {autoFutPrice !== null && (
                          <View>
                            <Text style={as.statusSubLabel}>선물가</Text>
                            <Text style={as.statusSubVal}>{autoFutPrice.toFixed(2)}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                )}
                {autoStatus === 'error' && (
                  <View style={[as.statusBanner, {borderColor:C.red, backgroundColor:'#FFEBEE'}]}>
                    <Text style={[as.statusText, {color:C.red}]}>오류 발생 — 조회/수정 탭 로그를 확인하세요</Text>
                  </View>
                )}
                {/* ── 등록 / 중지 버튼 ── */}
                {/* 항상 등록 버튼 표시 — 모니터링 중에는 현재 모니터링 유지하면서 새 종목 저장만 */}
                <TouchableOpacity
                  style={[s.mainOrderBtn, {backgroundColor: C.green}]}
                  onPress={() => {
                    const lines = [
                      `풋옵션: ${autoConfig.putOptCode || shcode} / 행사가: ${autoConfig.putStrike}`,
                      autoConfig.exitEnabled ? `청산 예약: ${autoConfig.exitThreshold.toFixed(2)}P 이하` : '',
                      `선물 매수: ${autoConfig.futuresCode} ${autoConfig.futuresQty}계약`,
                      '',
                      autoStatus === 'monitoring'
                        ? '현재 모니터링을 유지하면서 이 설정을 추가 저장합니다.'
                        : '자동화를 등록하시겠습니까?',
                    ].filter(Boolean).join('\n');
                    Alert.alert('자동화 등록 확인', lines, [
                      {text: '취소', style: 'cancel'},
                      {text: '등록', onPress: () => {
                        saveAutoConfig(autoConfig);
                        if (autoStatus !== 'monitoring') {
                          startAutoMonitor();
                        } else {
                          addLog(`➕ 추가 등록: ${autoConfig.putOptCode} / 행사가: ${autoConfig.putStrike}`);
                        }
                      }},
                    ]);
                  }}>
                  <Text style={s.mainOrderBtnText}>등록</Text>
                </TouchableOpacity>
                {autoStatus === 'monitoring' && (
                  <TouchableOpacity
                    style={[s.mainOrderBtn, {backgroundColor: C.orange, marginTop:8}]}
                    onPress={() => Alert.alert('모니터링 중지', '자동화를 중지하시겠습니까?', [
                      {text: '취소', style: 'cancel'},
                      {text: '중지', style: 'destructive', onPress: () => {
                        if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null; }
                        stopBackgroundService().then(() => setBgRunning(false)).catch(() => {});
                        setAutoStatus('idle');
                        addLog('사용자가 모니터링을 중지했습니다');
                      }},
                    ])}>
                    <Text style={s.mainOrderBtnText}>중지</Text>
                  </TouchableOpacity>
                )}

              </ScrollView>
            )}

            {/* ══════════════════════════════════════════════
                서브탭: 조회
            ══════════════════════════════════════════════ */}
            {autoSubTab === '조회/수정' && (
              <ScrollView style={{flex:1}} contentContainerStyle={{padding:12, gap:10}}>

                {/* 현재 자동화 설정 요약 */}
                <Text style={as.condTitle}>등록된 자동화</Text>

                {Object.keys(allSavedConfigs).length === 0 ? (
                  <View style={as.emptyBox}>
                    <Text style={as.emptyText}>등록된 자동화가 없습니다</Text>
                    {!isFuturesCode && (
                      <TouchableOpacity onPress={() => setAutoSubTab('추가')} style={{marginTop:12}}>
                        <Text style={{color:C.green, fontWeight:'700', fontSize:13}}>+ 자동화 추가하기</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <>
                    {/* 저장된 자동화 목록 전체 표시 */}
                    {Object.entries(allSavedConfigs).map(([optCode, cfg]) => {
                      const isActive = autoConfig.putOptCode === optCode && autoStatus !== 'idle';
                      const pnlColor = isActive && autoStatus === 'monitoring' ? C.green : C.subText;
                      return (
                        <View key={optCode} style={[as.summaryCard, {marginBottom:8}]}>
                          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                            <Text style={as.summaryName}>{optCode}</Text>
                            <View style={{flexDirection:'row', gap:6, alignItems:'center'}}>
                              {/* 삭제 버튼 */}
                              <TouchableOpacity
                                onPress={() => Alert.alert('삭제 확인', `${optCode} 자동화를 삭제하시겠습니까?`, [
                                  {text: '취소', style: 'cancel'},
                                  {text: '삭제', style: 'destructive', onPress: () => {
                                    AsyncStorage.getItem(STORAGE_KEY).then(val => {
                                      const all: Record<string, AutoConfig> = val ? JSON.parse(val) : {};
                                      delete all[optCode];
                                      setAllSavedConfigs({...all});
                                      return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
                                    }).catch(() => {});
                                  }},
                                ])}
                                style={{padding:4}}>
                                <Text style={{fontSize:11, color:C.red}}>삭제</Text>
                              </TouchableOpacity>
                              {/* 상태 뱃지 */}
                              <View style={[as.statusPill, {
                                backgroundColor: isActive && autoStatus === 'monitoring' ? '#E8F5E9' : '#F5F5F5',
                              }]}>
                                {isActive && autoStatus === 'monitoring' && <ActivityIndicator size="small" color={C.green} style={{marginRight:4}}/>}
                                <Text style={[as.statusPillText, {color: pnlColor}]}>
                                  {isActive && autoStatus === 'monitoring' ? '모니터링 중' : '대기'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {[
                            ['행사가',   `${cfg.putStrike.toFixed(2)}`],
                            ['청산 예약', cfg.exitEnabled ? `${cfg.exitThreshold.toFixed(2)} P 이하` : '미사용'],
                            ['선물 매수', `${cfg.futuresCode} / ${cfg.futuresQty}계약`],
                            ['시간',      `${cfg.monitorStart} ~ ${cfg.orderDeadline}`],
                          ].map(([label, val]) => (
                            <View key={label} style={as.queryRow}>
                              <Text style={as.queryLabel}>{label}</Text>
                              <Text style={as.queryVal}>{val}</Text>
                            </View>
                          ))}

                          {/* 이 항목 선택해서 수정/모니터링 */}
                          {autoStatus !== 'monitoring' && (
                            <TouchableOpacity
                              style={[s.mainOrderBtn, {backgroundColor: C.navy, marginTop:8}]}
                              onPress={() => {
                                setAutoConfig({...cfg});
                                setAutoSubTab('추가');
                              }}>
                              <Text style={s.mainOrderBtnText}>이 설정으로 수정/등록</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}

                    {/* 실행 로그 */}
                    {autoLog.length > 0 && (
                      <View style={as.logBox}>
                        <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom:6}}>
                          <Text style={as.logTitle}>실행 로그</Text>
                          <TouchableOpacity onPress={() => setAutoLog([])}>
                            <Text style={{fontSize:11, color:C.dimText}}>지우기</Text>
                          </TouchableOpacity>
                        </View>
                        {autoLog.map((line, i) => (
                          <Text key={i} style={[as.logLine, {
                            color: line.includes('✅') ? C.green  :
                                   line.includes('❌') ? C.red    :
                                   line.includes('⚠️') ? C.orange :
                                   line.includes('⏰') ? C.navy   : C.subText,
                          }]}>{line}</Text>
                        ))}
                      </View>
                    )}

                    {/* 중지 버튼 */}
                    {autoStatus === 'monitoring' && (
                      <TouchableOpacity
                        style={[s.mainOrderBtn, {backgroundColor: C.orange}]}
                        onPress={() => Alert.alert('모니터링 중지', '자동화를 중지하시겠습니까?', [
                          {text: '취소', style: 'cancel'},
                          {text: '중지', style: 'destructive', onPress: () => {
                            if (autoIntervalRef.current) { clearInterval(autoIntervalRef.current); autoIntervalRef.current = null; }
                            stopBackgroundService().then(() => setBgRunning(false)).catch(() => {});
                            setAutoStatus('idle');
                            addLog('사용자가 모니터링을 중지했습니다');
                          }},
                        ])}>
                        <Text style={s.mainOrderBtnText}>모니터링 중지</Text>
                      </TouchableOpacity>
                    )}
                    {(autoStatus === 'done' || autoStatus === 'ordered') && (
                      <TouchableOpacity
                        style={[s.mainOrderBtn, {backgroundColor: C.subText}]}
                        onPress={() => { setAutoStatus('idle'); setAutoLog([]); setAutoKospi(null); setAutoOptPrice(null); setAutoFutPrice(null); }}>
                        <Text style={s.mainOrderBtnText}>초기화</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </ScrollView>
            )}

          </View>
        )}

        {/* ── 매수/매도 ── */}
        {(tab === '매수' || tab === '매도') && (
          <>
            <MiniHoga asks={asks} bids={bids} currentPrice={initPrice} openPrice={openPrice} selectedPrice={px} onSelect={p => setPx(p)}/>
            <ScrollView style={{flex:1}} contentContainerStyle={s.formPad}>
              <OrderTypeButtons orderType={orderType} setOrderType={setOrderType} accentColor={accentColor} isBuy={isBuy}/>
              <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                <Text style={{fontSize:12, color:C.subText}}>손익</Text>
                <Text style={{fontSize:12, fontWeight:'600'}}>0원</Text>
              </View>
              <View style={{flexDirection:'row', gap:10}}>
                {['가능','신규','청산','총가능'].map(t => (
                  <Text key={t} style={{fontSize:12, color:'#555', textDecorationLine:'underline'}}>{t}</Text>
                ))}
              </View>
              <View style={s.stepper}>
                <TouchableOpacity onPress={() => setQty(q => Math.max(0,q-1))} style={s.stepBtn}><Text style={s.stepBtnText}>−</Text></TouchableOpacity>
                <Text style={s.stepVal}>{qty} <Text style={s.stepUnit}>계약</Text></Text>
                <TouchableOpacity onPress={() => setQty(q => q+1)} style={s.stepBtn}><Text style={s.stepBtnText}>+</Text></TouchableOpacity>
              </View>
              <View style={s.formBtnRow}>
                {[1,2,5,10].map(n => (
                  <TouchableOpacity key={n} onPress={() => setQty(n)} style={s.shortcutBtn}>
                    <Text style={{fontSize:13}}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[s.stepper, orderType === '03' && {opacity:0.4}]}>
                <TouchableOpacity onPress={() => setPx(p => +(p-0.05).toFixed(2))} style={s.stepBtn} disabled={orderType === '03'}><Text style={s.stepBtnText}>−</Text></TouchableOpacity>
                <Text style={[s.stepVal,{color:accentColor}]}>
                  {orderType === '03' ? '시장가' : fmt2(px)}
                  {orderType !== '03' && <Text style={s.stepUnit}> P</Text>}
                </Text>
                <TouchableOpacity onPress={() => setPx(p => +(p+0.05).toFixed(2))} style={s.stepBtn} disabled={orderType === '03'}><Text style={s.stepBtnText}>+</Text></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => { setQty(0); setPx(initPrice); setOrderType('00'); }}>
                <Text style={s.resetText}>초기화</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.mainOrderBtn,{backgroundColor:accentColor, opacity:submitting?0.7:1}]}
                onPress={handleOrder} disabled={submitting}>
                {submitting
                  ? <ActivityIndicator color="#FFF" size="small"/>
                  : <Text style={s.mainOrderBtnText}>{tab}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container:             {flex:1, backgroundColor:C.bg},
  topHeader:             {borderBottomWidth:1, borderBottomColor:C.border, paddingHorizontal:14, paddingTop:12, paddingBottom:8},
  topHeaderRow:          {flexDirection:'row', alignItems:'center', gap:6, marginBottom:10},
  topTitle:              {fontSize:18, fontWeight:'800', flex:1},
  backBtn:               {fontSize:32, color:'#111', fontWeight:'300', lineHeight:36},
  dayToggle:             {flexDirection:'row', borderWidth:1.5, borderColor:C.navy, borderRadius:8, overflow:'hidden'},
  dayBtn:                {paddingHorizontal:12, paddingVertical:5},
  dayBtnActiveText:      {fontSize:13, fontWeight:'700', color:C.navy},
  dayBtnText:            {fontSize:13, color:C.dimText},
  priceRow:              {flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end'},
  bigPrice:              {fontSize:26, fontWeight:'900'},
  pillRow:               {flexDirection:'row', alignItems:'center', gap:8, marginTop:4},
  pill:                  {backgroundColor:C.pillBg, borderRadius:6, paddingHorizontal:10, paddingVertical:3},
  pillText:              {color:C.red, fontWeight:'700', fontSize:12},
  volText:               {color:C.dimText, fontSize:12},
  investorWrap:          {alignItems:'flex-end'},
  investorHeader:        {fontSize:10, color:C.dimText, marginBottom:2},
  investorRow:           {fontSize:11, color:C.subText, lineHeight:18},
  acctBar:               {flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:10, paddingHorizontal:12, backgroundColor:'#F5F6F8', borderBottomWidth:1, borderBottomColor:C.border},
  acctText:              {fontSize:11, color:'#555', flex:1},
  tabRow:                {flexDirection:'row', borderBottomWidth:1, borderBottomColor:C.border},
  tabBtn:                {flex:1, paddingVertical:10, alignItems:'center'},
  tabText:               {fontSize:11, color:'#666'},
  tabTextActive:         {color:'#FFFFFF', fontWeight:'700'},
  formPad:               {padding:10, gap:8},
  formBtnRow:            {flexDirection:'row', gap:8},
  formLabel:             {fontSize:12, color:C.subText, marginTop:4},
  outlineBtn:            {flex:1, paddingVertical:8, borderRadius:8, borderWidth:1, borderColor:'#DDD', alignItems:'center', backgroundColor:C.bg},
  outlineBtnText:        {fontSize:12, color:'#555'},
  smallBtn:              {borderWidth:1, borderColor:'#DDD', borderRadius:6, paddingHorizontal:10, paddingVertical:5},
  ordNoBox:              {borderWidth:1, borderColor:'#DDD', borderRadius:8, paddingHorizontal:12, paddingVertical:11, backgroundColor:C.bg},
  selectedOrderBadge:    {backgroundColor:'#EEF2FF', borderRadius:8, borderWidth:1, borderColor:C.navy, paddingHorizontal:10, paddingVertical:8},
  selectedOrderText:     {fontSize:12, color:C.navy, fontWeight:'700'},
  stepper:               {flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:'#DDD', borderRadius:8},
  stepBtn:               {width:38, paddingVertical:10, alignItems:'center'},
  stepBtnText:           {fontSize:18, color:'#555'},
  stepVal:               {flex:1, textAlign:'center', fontSize:14, fontWeight:'600'},
  stepUnit:              {fontSize:12, fontWeight:'400', color:C.dimText},
  shortcutBtn:           {flex:1, paddingVertical:7, borderRadius:6, borderWidth:1, borderColor:'#DDD', alignItems:'center', backgroundColor:C.bg},
  resetText:             {textAlign:'right', fontSize:11, color:C.dimText},
  mainOrderBtn:          {paddingVertical:15, borderRadius:10, alignItems:'center', marginTop:4},
  mainOrderBtnText:      {color:'#FFF', fontWeight:'800', fontSize:17, letterSpacing:2},
  actionBtn:             {paddingVertical:14, borderRadius:10, alignItems:'center'},
  actionBtnText:         {color:'#FFF', fontWeight:'700', fontSize:15},
  holdingsBadge:         {borderWidth:1, borderColor:'#DDD', borderRadius:6, paddingHorizontal:8, paddingVertical:4},
  holdingsHead:          {flexDirection:'row', paddingVertical:6, borderBottomWidth:1, borderBottomColor:'#EEE'},
  holdingsHeadText:      {flex:1, fontSize:10, color:C.dimText},
  holdingsRow:           {flexDirection:'row', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F5F5F5'},
  holdingsVal:           {fontSize:12, fontWeight:'600', marginTop:2},
  historyFilterRow:      {flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:8, borderBottomWidth:1, borderBottomColor:C.border, gap:8},
  historyFilterBtn:      {paddingHorizontal:14, paddingVertical:6, borderRadius:20, borderWidth:1.5, borderColor:'#DDD', backgroundColor:C.bg},
  historyFilterBtnActive:{backgroundColor:C.navy, borderColor:C.navy},
  historyFilterText:     {fontSize:12, color:'#555'},
  historyFilterTextActive:{color:'#FFF', fontWeight:'700'},
  historyHead:           {flexDirection:'row', paddingHorizontal:10, paddingVertical:6, backgroundColor:'#F5F6F8', borderBottomWidth:1, borderBottomColor:C.border},
  historyHeadText:       {flex:1, fontSize:10, color:C.dimText},
  historyRow:            {flexDirection:'row', alignItems:'center', paddingHorizontal:10, paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F5F5F5'},
  historyCell:           {fontSize:12, fontWeight:'500'},
});

const pbs = StyleSheet.create({
  overlay:            {flex:1, backgroundColor:'rgba(0,0,0,0.45)', justifyContent:'flex-end'},
  sheet:              {backgroundColor:C.bg, borderTopLeftRadius:20, borderTopRightRadius:20, height:'70%', paddingBottom:24},
  handle:             {width:36, height:4, borderRadius:2, backgroundColor:'#DDD', alignSelf:'center', marginVertical:12},
  header:             {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, marginBottom:4},
  title:              {fontSize:18, fontWeight:'800', color:'#111'},
  filterRow:          {flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border},
  filterBtn:          {paddingHorizontal:4, paddingBottom:8, marginRight:16, position:'relative'},
  filterBtnActive:    {},
  filterText:         {fontSize:15, color:C.subText},
  filterTextActive:   {color:C.navy, fontWeight:'700'},
  filterUnderline:    {position:'absolute', bottom:0, left:0, right:0, height:2, backgroundColor:C.navy, borderRadius:1},
  actionSmallBtn:     {borderWidth:1, borderColor:'#DDD', borderRadius:6, paddingHorizontal:12, paddingVertical:6},
  actionSmallBtnText: {fontSize:12, color:'#555'},
  card:               {marginHorizontal:16, marginTop:12, borderRadius:12, borderWidth:1, borderColor:C.border, backgroundColor:C.bg, padding:14},
  cardHeader:         {flexDirection:'row', alignItems:'center', gap:8, marginBottom:10},
  cardMedosu:         {fontSize:14, fontWeight:'800'},
  cardOrdNo:          {fontSize:13, color:C.subText, flex:1},
  cardName:           {fontSize:14, fontWeight:'700', color:'#111'},
  cardBody:           {gap:6},
  cardRow:            {flexDirection:'row', alignItems:'center'},
  cardLabel:          {fontSize:13, color:C.subText, width:60},
  cardVal:            {fontSize:13, flex:1},
});

export default OrderScreen;

// ── 자동화 탭 스타일 ──────────────────────────────────────────────────────────
const as = StyleSheet.create({
  // 서브탭
  subTabRow:         {flexDirection:'row', borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:'#F8F9FA'},
  subTabBtn:         {paddingHorizontal:20, paddingVertical:9, borderBottomWidth:2, borderBottomColor:'transparent'},
  subTabBtnActive:   {borderBottomColor:C.green},
  subTabText:        {fontSize:13, color:C.subText},
  subTabTextActive:  {color:C.green, fontWeight:'700'},
  // 조건 타이틀
  condTitle:         {fontSize:13, fontWeight:'800', color:'#333', paddingBottom:2},
  // 요약 카드
  summaryCard:       {borderWidth:1, borderColor:C.border, borderRadius:10, padding:12, backgroundColor:'#FAFAFA', gap:8},
  summaryName:       {fontSize:13, fontWeight:'800', color:'#111', marginBottom:2},
  summaryRow:        {flexDirection:'row', alignItems:'center', gap:8},
  summaryLabel:      {fontSize:12, color:C.subText, width:72},
  summaryCodeBox:    {borderWidth:1, borderColor:'#DDD', borderRadius:6, paddingHorizontal:10, paddingVertical:5, backgroundColor:C.bg},
  summaryCode:       {fontSize:13, fontWeight:'700', color:'#111'},
  summaryMeta:       {fontSize:11, color:C.dimText},
  summaryValBox:     {flex:1, borderWidth:1, borderColor:'#DDD', borderRadius:6, paddingHorizontal:10, paddingVertical:5, backgroundColor:C.bg},
  summaryValText:    {fontSize:12, color:'#333'},
  // 폼 행 (label + input 가로 배치)
  formRow:           {flexDirection:'row', alignItems:'center', gap:10},
  formLabel:         {fontSize:12, color:C.subText, width:52},
  // 체크박스
  checkRow:          {flexDirection:'row', alignItems:'center', gap:8},
  checkbox:          {padding:2},
  checkboxBox:       {width:20, height:20, borderWidth:1.5, borderColor:'#AAA', borderRadius:4, alignItems:'center', justifyContent:'center'},
  checkboxBoxChecked:{backgroundColor:C.green, borderColor:C.green},
  checkmark:         {color:'#FFF', fontSize:12, fontWeight:'700', lineHeight:14},
  checkLabel:        {fontSize:13, color:'#333'},
  currentPriceBox:   {borderWidth:1, borderColor:'#DDD', borderRadius:6, paddingHorizontal:8, paddingVertical:5, alignItems:'center', minWidth:60},
  currentPriceLabel: {fontSize:9, color:C.dimText},
  currentPriceVal:   {fontSize:12, fontWeight:'700', color:'#333'},
  nowExitBtn:        {borderWidth:1.5, borderColor:C.red, borderRadius:8, paddingHorizontal:10, paddingVertical:6, alignItems:'center', justifyContent:'center', minWidth:52, backgroundColor:'#FFF0F0'},
  nowExitBtnText:    {fontSize:11, fontWeight:'800', color:C.red, textAlign:'center', lineHeight:15},
  // 상태
  statusBanner:      {borderWidth:1.5, borderRadius:10, padding:12, gap:4},
  statusText:        {fontSize:13, fontWeight:'700'},
  statusSubLabel:    {fontSize:10, color:C.subText, marginBottom:1},
  statusSubVal:      {fontSize:15, fontWeight:'800'},
  statusPill:        {flexDirection:'row', alignItems:'center', borderRadius:20, paddingHorizontal:10, paddingVertical:4},
  statusPillText:    {fontSize:11, fontWeight:'700'},
  // 입력
  textInput:         {
    borderWidth:1, borderColor:'#DDD', borderRadius:8,
    paddingHorizontal:12, paddingVertical:9,
    fontSize:13, fontWeight:'600', color:'#111',
    backgroundColor:C.bg,
  },
  inputRow:          {gap:3},
  inputHint:         {fontSize:10, color:C.dimText, paddingLeft:2},
  // 타임라인 섹션
  tlSection:         {borderWidth:1, borderColor:C.border, borderRadius:12, padding:12, gap:10, backgroundColor:'#FAFAFA'},
  diffBox:           {flex:1, borderWidth:1, borderColor:'#DDD', borderRadius:8, paddingHorizontal:12, paddingVertical:8, backgroundColor:C.bg},
  diffText:          {fontSize:13, color:'#333'},
  tlHeader:          {flexDirection:'row', alignItems:'center', flexWrap:'wrap', gap:6, marginBottom:2},
  tlDot:             {width:8, height:8, borderRadius:4, backgroundColor:C.green},
  tlTitle:           {fontSize:13, fontWeight:'800', color:'#111'},
  tlDesc:            {fontSize:11, color:C.subText, width:'100%', paddingLeft:14},
  tlRow:             {flexDirection:'row', alignItems:'center', gap:8},
  tlLabel:           {fontSize:12, color:C.subText, width:56},
  tlMeta:            {fontSize:10, color:C.dimText},
  sectionTitle:      {fontSize:12, fontWeight:'800', color:'#222'},
  sectionDesc:       {fontSize:11, color:C.subText},
  row:               {gap:5},
  label:             {fontSize:12, color:C.subText},
  // 정보 박스
  infoBox:           {backgroundColor:'#EEF2FF', borderRadius:8, padding:10},
  infoText:          {fontSize:11, color:C.navy, lineHeight:16},
  timeRow:           {flexDirection:'row', alignItems:'flex-end', gap:8},
  timeBox:           {borderWidth:1.5, borderRadius:8, paddingVertical:10, alignItems:'center', marginTop:4},
  timeVal:           {fontSize:15, fontWeight:'800', letterSpacing:1},
  // 조회 행
  queryRow:          {flexDirection:'row', paddingVertical:5, borderBottomWidth:1, borderBottomColor:'#F0F0F0'},
  queryLabel:        {fontSize:12, color:C.subText, width:70},
  queryVal:          {fontSize:12, fontWeight:'600', color:'#222', flex:1},
  // 빈 상태
  emptyBox:          {alignItems:'center', paddingVertical:40},
  emptyText:         {fontSize:13, color:C.dimText},
  // 로그
  logBox:            {borderWidth:1, borderColor:C.border, borderRadius:10, padding:12, backgroundColor:'#F8F9FA'},
  logTitle:          {fontSize:12, fontWeight:'700', color:'#333'},
  logLine:           {fontSize:11, lineHeight:18, fontFamily:'monospace' as any},
});