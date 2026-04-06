import React, {useState, useEffect, useRef} from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, Modal,
  TouchableOpacity, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {
  placeOrder, modifyOrder, cancelOrder, getPendingOrders, getFuturesOrders,
  getFuturesHoga, getFuturesHoldings,
  FuturesHolding, FuturesHoldingSummary, FuturesOrderItem,
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

type OrderMode = '매수' | '매도' | '정정/취소' | '체결' | '잔고';

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
  const [holdings,            setHoldings]            = useState<FuturesHolding[]>([]);
  const [holdingSummary,      setHoldingSummary]      = useState<FuturesHoldingSummary | null>(null);
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
    getFuturesHoldings()
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
        // 전체 = 체결 + 미체결 순차 조회 후 합치기 (동시 호출 시 트랜잭션 초과 방지)
        const cheolList = await getFuturesOrders(shcode ?? 'A0166000', '1', '1');
        await new Promise<void>(r => setTimeout(r, 800));
        const micheList = await getFuturesOrders('', '2', '1');
        const merged = [...cheolList, ...micheList];
        const seen = new Set<number>();
        list = merged.filter(o => {
          if (seen.has(o.ordno)) return false;
          seen.add(o.ordno);
          return true;
        }).sort((a, b) => b.ordno - a.ordno);
      } else if (filter === '2') {
        list = await getFuturesOrders('', '2', '1');
      } else {
        list = await getFuturesOrders(shcode ?? 'A0166000', filter, '1');
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
  const ORDER_TABS: OrderMode[] = ['매수', '매도', '정정/취소', '체결', '잔고'];

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
          const bg = isActive ? accentColor : 'transparent';
          return (
            <TouchableOpacity key={t} onPress={() => setTab(t)} activeOpacity={0.8}
              style={[s.tabBtn, {backgroundColor: bg}]}>
              <Text style={[s.tabText, isActive && s.tabTextActive]}>{t}</Text>
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
                <View style={{flexDirection:'row', alignItems:'center', gap:8, marginBottom:12}}>
                  <View style={s.holdingsBadge}><Text style={{fontSize:11}}>평가손익 ⋮</Text></View>
                  <Text style={{color:(holdingSummary?.tsunik ?? 0) >= 0 ? C.red : C.blue, fontWeight:'800', fontSize:15, flex:1}}>
                    {holdingSummary?.tsunik?.toLocaleString() ?? '-'}
                  </Text>
                  <TouchableOpacity style={s.holdingsBadge}><Text style={{fontSize:11}}>일괄청산</Text></TouchableOpacity>
                  <TouchableOpacity style={s.holdingsBadge}><Text style={{fontSize:11}}>이평 ⋮</Text></TouchableOpacity>
                </View>
                <View style={s.holdingsHead}>
                  {['종목번호\n구분','평균단가\n잔고','매입금액\n평가금액','수익율\n평가손익'].map((h,i) => (
                    <Text key={i} style={[s.holdingsHeadText, i > 0 && {textAlign:'right'}]}>{h}</Text>
                  ))}
                </View>
                {holdings.length === 0
                  ? <View style={{alignItems:'center', marginTop:30}}><Text style={{color:C.dimText, fontSize:13}}>보유 포지션이 없습니다</Text></View>
                  : holdings.map((h, i) => {
                    const pnlColor = h.dtsunik1 >= 0 ? C.red : C.blue;
                    return (
                      <View key={i} style={s.holdingsRow}>
                        <View style={{flex:1.2}}>
                          <Text style={{fontSize:12, fontWeight:'600'}}>{h.expcode}</Text>
                          <Text style={{color: h.medocd === '2' ? C.red : C.blue, fontSize:11, marginTop:2}}>{h.medosu}</Text>
                        </View>
                        <View style={{flex:1, alignItems:'flex-end'}}>
                          <Text style={s.holdingsVal}>{Number(h.pamt).toFixed(2)}</Text>
                          <Text style={s.holdingsVal}>{h.jqty}</Text>
                        </View>
                        <View style={{flex:1.2, alignItems:'flex-end'}}>
                          <Text style={s.holdingsVal}>{h.mamt.toLocaleString()}</Text>
                          <Text style={s.holdingsVal}>{h.appamt.toLocaleString()}</Text>
                        </View>
                        <View style={{flex:1, alignItems:'flex-end'}}>
                          <Text style={[s.holdingsVal, {color:pnlColor}]}>{h.sunikrt}%</Text>
                          <Text style={[s.holdingsVal, {color:pnlColor}]}>{h.dtsunik1.toLocaleString()}</Text>
                        </View>
                      </View>
                    );
                  })}
                {holdingSummary && (
                  <View style={{marginTop:12, borderTopWidth:1, borderTopColor:C.border, paddingTop:10, gap:6}}>
                    {[
                      ['평가금액 합계', holdingSummary.tappamt.toLocaleString() + '원', '#333'],
                      ['평가손익 합계', holdingSummary.tsunik.toLocaleString() + '원',   holdingSummary.tsunik   >= 0 ? C.red : C.blue],
                      ['매매손익 합계', holdingSummary.tdtsunik.toLocaleString() + '원', holdingSummary.tdtsunik >= 0 ? C.red : C.blue],
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