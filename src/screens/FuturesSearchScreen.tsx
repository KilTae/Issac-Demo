import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList,
  TouchableOpacity, StatusBar, ActivityIndicator, Modal, TextInput, Keyboard,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';
import {getOptionBoard} from '../api/lsApi';

const C = {
  bg:      '#FFFFFF',
  navy:    '#1A3BB8',
  red:     '#E8001C',
  blue:    '#1A73E8',
  border:  '#EEEEEE',
  subText: '#888888',
  dimText: '#AAAAAA',
  atmBg:   '#E8E8E8',
  rowBg:   '#FAFAFA',
  inputBg: '#F5F6FA',
};

const fmt2 = (n: number) => Number(n).toFixed(2);
const ROW_HEIGHT = 34;

type MainTab    = '주간' | '야간';
type ProductTab = 'KP200' | '위클리';
type WeekDay    = '목' | '월';
type KP200Sub   = '월물' | '스프레드';

interface MonthItem  { label: string; shcode: string; yyyymm: string; }
interface OptionRow  {
  strike: number; call: number; callChg: number; callSign: string; callOptcode: string;
  put: number; putChg: number; putSign: string; putOptcode: string; atm: boolean;
}
interface SearchItem {
  shcode: string; hname: string; yyyymm: string;
  type: '콜' | '풋' | '선물' | '위클리콜' | '위클리풋';
  strike: number; price: number; chg: number; sign: string;
}

const getSignColor = (sign: string) => {
  if (sign === '1' || sign === '2') return C.red;
  if (sign === '4' || sign === '5') return C.blue;
  return C.subText;
};
const getArrow = (sign: string) => {
  if (sign === '1' || sign === '2') return '▲';
  if (sign === '4' || sign === '5') return '▼';
  return '';
};
const getWeekNumberByDay = (targetDayOfWeek: number): number => {
  const today = new Date();
  let count = 0;
  for (let d = 1; d <= today.getDate(); d++) {
    if (new Date(today.getFullYear(), today.getMonth(), d).getDay() === targetDayOfWeek) count++;
  }
  return Math.max(count, 1);
};
const checkThursdayPassed = (): boolean => {
  const day = new Date().getDay();
  return day === 5 || day === 6 || day === 0;
};
const generateKP200Months = (): MonthItem[] => {
  const today = new Date();
  let y = today.getFullYear();
  let m = today.getMonth() + 1;
  const quarters = [3, 6, 9, 12];
  const result: MonthItem[] = [];
  while (result.length < 4) {
    const next = quarters.find(q => q >= m) ?? quarters[0];
    if (next < m) y += 1;
    m = next;
    const yy = String(y).slice(2);
    const mm = String(m).padStart(2, '0');
    const monthCode = m <= 9 ? String(m) : String.fromCharCode(55 + m);
    result.push({ label: `F ${yy}${mm}`, shcode: `A016${monthCode}000`, yyyymm: `${y}${mm}` });
    const idx = quarters.indexOf(m);
    if (idx === quarters.length - 1) { m = quarters[0]; y += 1; }
    else { m = quarters[idx + 1]; }
  }
  return result;
};
const generateExpiryMonths = (): string[] => {
  const today = new Date();
  return Array.from({length: 4}, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
};
const generateFuturesSearchItems = (): SearchItem[] =>
  generateKP200Months().map(m => ({
    shcode: m.shcode, hname: m.label, yyyymm: m.yyyymm,
    type: '선물' as const, strike: 0, price: 0, chg: 0, sign: '3',
  }));

// ── 메인 ─────────────────────────────────────────────────────────────────────
const FuturesSearchScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const thuWeekNum     = useMemo(() => getWeekNumberByDay(4), []);
  const monWeekNum     = useMemo(() => getWeekNumberByDay(1), []);
  const thursdayPassed = useMemo(() => checkThursdayPassed(), []);

  const kp200ScrollRef  = useRef<ScrollView>(null) as React.MutableRefObject<ScrollView>;
  const weeklyScrollRef = useRef<ScrollView>(null) as React.MutableRefObject<ScrollView>;
  const isFirstMount    = useRef(true);
  const searchInputRef  = useRef<TextInput>(null);

  const [mainTab,         setMainTab]         = useState<MainTab>('주간');
  const [productTab,      setProductTab]      = useState<ProductTab>('KP200');
  const [kp200Sub,        setKp200Sub]        = useState<KP200Sub>('월물');
  const [kp200Months,     setKp200Months]     = useState<MonthItem[]>([]);
  const [expiryMonths,    setExpiryMonths]    = useState<string[]>([]);
  const [selectedExpiry,  setSelectedExpiry]  = useState<string>('');
  const [weekDay,         setWeekDay]         = useState<WeekDay>(thursdayPassed ? '월' : '목');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [kp200Rows,       setKp200Rows]       = useState<OptionRow[]>([]);
  const [kp200Loading,    setKp200Loading]    = useState(false);
  const [rows,            setRows]            = useState<OptionRow[]>([]);
  const [allCalls,        setAllCalls]        = useState<any[]>([]);
  const [allPuts,         setAllPuts]         = useState<any[]>([]);
  const [gmprice,         setGmprice]         = useState(0);
  const [loading,         setLoading]         = useState(true);

  // ── 검색 모달 state ──────────────────────────────────────────────────────
  const [searchVisible,  setSearchVisible]  = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchItems,    setSearchItems]    = useState<SearchItem[]>([]);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [searchFetched,  setSearchFetched]  = useState(false);

  // ── 검색 종목 로드 ────────────────────────────────────────────────────────
  const loadSearchItems = useCallback(async () => {
    if (searchFetched) return;
    setSearchLoading(true);
    try {
      const items: SearchItem[] = [...generateFuturesSearchItems()];
      const expiries = generateExpiryMonths();
      for (const yyyymm of expiries) {
        try {
          const board = await getOptionBoard(yyyymm, 'G');
          board.calls.forEach(c => items.push({
            shcode: c.optcode, hname: `C ${yyyymm} ${c.actprice}`,
            yyyymm, type: '콜', strike: c.actprice,
            price: c.price, chg: c.change, sign: c.sign ?? '3',
          }));
          board.puts.forEach(p => items.push({
            shcode: p.optcode, hname: `P ${yyyymm} ${p.actprice}`,
            yyyymm, type: '풋', strike: p.actprice,
            price: p.price, chg: p.change, sign: p.sign ?? '3',
          }));
          await new Promise<void>(r => setTimeout(r, 400));
        } catch (e: any) { console.log(`❌ 옵션 ${yyyymm}:`, e?.message); }
      }
      try {
        const weekly = await getOptionBoard('W1 ', 'W');
        weekly.calls.forEach(c => items.push({
          shcode: c.optcode, hname: `WC ${c.actprice}`,
          yyyymm: 'W1 ', type: '위클리콜', strike: c.actprice,
          price: c.price, chg: c.change, sign: c.sign ?? '3',
        }));
        weekly.puts.forEach(p => items.push({
          shcode: p.optcode, hname: `WP ${p.actprice}`,
          yyyymm: 'W1 ', type: '위클리풋', strike: p.actprice,
          price: p.price, chg: p.change, sign: p.sign ?? '3',
        }));
      } catch (e: any) { console.log('❌ 위클리:', e?.message); }
      setSearchItems(items);
      setSearchFetched(true);
    } finally {
      setSearchLoading(false);
      setTimeout(() => searchInputRef.current?.focus(), 200);
    }
  }, [searchFetched]);

  const openSearch = useCallback(() => {
    setSearchVisible(true);
    setSearchQuery('');
    loadSearchItems();
  }, [loadSearchItems]);

  const closeSearch = useCallback(() => {
    Keyboard.dismiss();
    setSearchVisible(false);
    setSearchQuery('');
  }, []);

  const searchFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchItems.filter(it =>
      it.hname.toLowerCase().includes(q) ||
      String(it.strike).includes(q) ||
      it.yyyymm.includes(q)
    );
  }, [searchItems, searchQuery]);

  const handleSearchSelect = useCallback((item: SearchItem) => {
    closeSearch();
    navigation.navigate('FuturesOption', {
      shcode: item.shcode, hname: item.hname, yyyymm: item.yyyymm,
    });
  }, [navigation, closeSearch]);

  const getBadge = (type: SearchItem['type']) => {
    switch (type) {
      case '선물':     return {bg: '#EEF2FF', text: C.navy,    label: 'F'};
      case '콜':       return {bg: '#EEF2FF', text: C.navy,    label: 'C'};
      case '풋':       return {bg: '#FFF0F0', text: C.red,     label: 'P'};
      case '위클리콜': return {bg: '#E8F5E9', text: '#2E7D32', label: 'WC'};
      case '위클리풋': return {bg: '#FFF3E0', text: '#E65100', label: 'WP'};
    }
  };

  const renderSearchItem = ({item}: {item: SearchItem}) => {
    const color = getSignColor(item.sign);
    const arrow = getArrow(item.sign);
    const badge = getBadge(item.type);
    return (
      <TouchableOpacity style={s.searchItem} activeOpacity={0.7} onPress={() => handleSearchSelect(item)}>
        <View style={s.searchItemLeft}>
          <View style={[s.badge, {backgroundColor: badge.bg}]}>
            <Text style={[s.badgeText, {color: badge.text}]}>{badge.label}</Text>
          </View>
          <View>
            <Text style={s.searchItemName}>{item.hname}</Text>
            <Text style={s.searchItemSub}>
              {item.type === '선물' ? 'KP200 선물' :
               item.yyyymm === 'W1 ' ? '위클리 옵션' :
               `KP200 옵션 · ${item.yyyymm}`}
            </Text>
          </View>
        </View>
        {item.type !== '선물' && (
          <View style={s.searchItemRight}>
            <Text style={[s.searchItemPrice, {color}]}>{fmt2(item.price)}</Text>
            {item.chg !== 0 && (
              <Text style={[s.searchItemChg, {color}]}>{arrow} {fmt2(Math.abs(item.chg))}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── 옵션전광판 ────────────────────────────────────────────────────────────
  const scrollToATM = useCallback((boardRows: OptionRow[], ref: React.MutableRefObject<ScrollView>) => {
    const atmIdx = boardRows.findIndex(r => r.atm);
    if (atmIdx <= 0) return;
    setTimeout(() => ref.current?.scrollTo({y: Math.max(0, (atmIdx - 3) * ROW_HEIGHT), animated: true}), 300);
  }, []);

  const buildRowsFromMap = useCallback((map: Map<number, {call?: any; put?: any}>, gmp: number): OptionRow[] => {
    const strikes   = Array.from(map.keys());
    const atmStrike = strikes.reduce((a, b) => Math.abs(b - gmp) < Math.abs(a - gmp) ? b : a, strikes[0] ?? 0);
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]).map(([strike, {call, put}]) => ({
      strike,
      call: call?.price ?? 0, callChg: call?.change ?? 0, callSign: call?.sign ?? '3', callOptcode: call?.optcode ?? '',
      put:  put?.price  ?? 0, putChg:  put?.change  ?? 0, putSign:  put?.sign  ?? '3', putOptcode:  put?.optcode  ?? '',
      atm: strike === atmStrike,
    }));
  }, []);

  const fetchKP200Options = useCallback(async (yyyymm: string) => {
    setKp200Loading(true);
    try {
      const board = await getOptionBoard(yyyymm, 'G');
      const map = new Map<number, {call?: any; put?: any}>();
      board.calls.forEach(c => map.set(c.actprice, {...(map.get(c.actprice) ?? {}), call: c}));
      board.puts.forEach(p  => map.set(p.actprice, {...(map.get(p.actprice) ?? {}), put:  p}));
      const newRows = buildRowsFromMap(map, board.summary.gmprice);
      setKp200Rows(newRows);
      scrollToATM(newRows, kp200ScrollRef);
    } catch (e: any) {
      console.log('❌ KP200 조회 실패:', e?.message);
    } finally {
      setKp200Loading(false);
    }
  }, [buildRowsFromMap, scrollToATM]);

  const fetchKP200Months = useCallback(async () => {
    setKp200Months(generateKP200Months());
    const expiries = generateExpiryMonths();
    setExpiryMonths(expiries);
    setSelectedExpiry(expiries[0]);
    await fetchKP200Options(expiries[0]);
  }, [fetchKP200Options]);

  const fetchWeekly = useCallback(async () => {
    setLoading(true);
    try {
      const board = await getOptionBoard('W1 ', 'W');
      setGmprice(board.summary.gmprice);
      setAllCalls(board.calls);
      setAllPuts(board.puts);
      buildWeeklyRows(board.calls, board.puts, board.summary.gmprice, weekDay);
    } catch (e: any) {
      console.log('❌ 위클리 조회 실패:', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const buildWeeklyRows = useCallback((calls: any[], puts: any[], gmp: number, day: WeekDay) => {
    const fC = calls.filter(c => ((c as any).hname ?? '').includes(day));
    const fP = puts.filter(p  => ((p as any).hname ?? '').includes(day));
    const map = new Map<number, {call?: any; put?: any}>();
    (fC.length > 0 ? fC : calls).forEach(c => map.set(c.actprice, {...(map.get(c.actprice) ?? {}), call: c}));
    (fP.length > 0 ? fP : puts).forEach(p  => map.set(p.actprice, {...(map.get(p.actprice) ?? {}), put:  p}));
    const newRows = buildRowsFromMap(map, gmp);
    setRows(newRows);
    scrollToATM(newRows, weeklyScrollRef);
  }, [buildRowsFromMap, scrollToATM]);

  useEffect(() => {
    const init = async () => {
      await fetchKP200Months();
      await new Promise<void>(resolve => setTimeout(resolve, 400));
      await fetchWeekly();
    };
    init();
  }, []);

  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    if (selectedExpiry) fetchKP200Options(selectedExpiry);
  }, [selectedExpiry]);

  useEffect(() => {
    if (allCalls.length > 0 || allPuts.length > 0) buildWeeklyRows(allCalls, allPuts, gmprice, weekDay);
  }, [weekDay, allCalls, allPuts, gmprice, buildWeeklyRows]);

  const handleWeeklySelect = useCallback((optcode: string, strike: number, type: 'C' | 'P') => {
    if (!optcode) return;
    const label = weekDay === '목' ? `${thuWeekNum}주 목요일` : `${monWeekNum}주 월요일`;
    navigation.navigate('FuturesOption', {
      shcode: optcode,
      hname:  `${type === 'C' ? 'C' : 'P'} ${label} ${fmt2(strike)}`,
      yyyymm: 'W1 ',
    });
  }, [navigation, weekDay, thuWeekNum, monWeekNum]);

  const weekDayTabs: {day: WeekDay; label: string}[] = [
    ...(!thursdayPassed ? [{day: '목' as WeekDay, label: `${thuWeekNum}주 목요일`}] : []),
    {day: '월' as WeekDay, label: `${monWeekNum}주 월요일`},
  ];

  const ColHeader = () => (
    <View style={s.colHeader}>
      <Text style={[s.colText, {textAlign:'center'}]}>대비</Text>
      <Text style={[s.colText, {textAlign:'center', color:'#333', fontWeight:'700'}]}>콜</Text>
      <Text style={[s.colText, {textAlign:'center', color:'#333', fontWeight:'700'}]}>행사가</Text>
      <Text style={[s.colText, {textAlign:'center', color:'#333', fontWeight:'700'}]}>풋</Text>
      <Text style={[s.colText, {textAlign:'center'}]}>대비</Text>
    </View>
  );

  const renderRows = (boardRows: OptionRow[], isWeekly: boolean) =>
    boardRows.map((r, i) => {
      const callArrow    = getArrow(r.callSign);
      const putArrow     = getArrow(r.putSign);
      const callChgColor = (r.callSign === '1' || r.callSign === '2') ? C.red
                         : (r.callSign === '4' || r.callSign === '5') ? C.blue : '#333';
      const putChgColor  = (r.putSign  === '1' || r.putSign  === '2') ? C.red
                         : (r.putSign  === '4' || r.putSign  === '5') ? C.blue : '#333';
      return (
        <View key={i} style={[s.row, r.atm && s.rowATM]}>
          <View style={s.cell}>
            <Text style={[s.chgText, {color:callChgColor, textAlign:'center'}]}>
              {r.callChg !== 0 ? `${callArrow} ${fmt2(Math.abs(r.callChg))}` : '0.00'}
            </Text>
          </View>
          <TouchableOpacity style={s.cell} activeOpacity={0.7}
            onPress={() => isWeekly
              ? handleWeeklySelect(r.callOptcode, r.strike, 'C')
              : navigation.navigate('FuturesOption', {shcode: r.callOptcode, hname: `C ${selectedExpiry} ${r.strike}`, yyyymm: selectedExpiry})}>
            <Text style={[s.priceText, {textAlign:'center', color: callChgColor}]}>{fmt2(r.call)}</Text>
          </TouchableOpacity>
          <View style={s.strikeCell}>
            <Text style={[s.strikeText, r.atm && s.strikeATM]}>{fmt2(r.strike)}</Text>
          </View>
          <TouchableOpacity style={s.cell} activeOpacity={0.7}
            onPress={() => isWeekly
              ? handleWeeklySelect(r.putOptcode, r.strike, 'P')
              : navigation.navigate('FuturesOption', {shcode: r.putOptcode, hname: `P ${selectedExpiry} ${r.strike}`, yyyymm: selectedExpiry})}>
            <Text style={[s.priceText, {textAlign:'center', color: putChgColor}]}>{fmt2(r.put)}</Text>
          </TouchableOpacity>
          <View style={s.cell}>
            <Text style={[s.chgText, {color:putChgColor, textAlign:'center'}]}>
              {r.putChg !== 0 ? `${putArrow} ${fmt2(Math.abs(r.putChg))}` : '0.00'}
            </Text>
          </View>
        </View>
      );
    });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg}/>

      {/* ── 헤더 ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{top:12, bottom:12, left:12, right:12}}>
          <Text style={s.backBtn}>‹</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>국내 선물옵션 검색</Text>
      </View>

      <View style={s.mainTabRow}>
        {(['주간','야간'] as MainTab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setMainTab(t)} activeOpacity={0.8}
            style={[s.mainTabBtn, mainTab === t && s.mainTabBtnActive]}>
            <Text style={[s.mainTabText, mainTab === t && s.mainTabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.productTabRow}>
        {(['KP200', '위클리'] as ProductTab[]).map(t => (
          <TouchableOpacity key={t} onPress={() => setProductTab(t)} activeOpacity={0.8}
            style={[s.productTabBtn, productTab === t && s.productTabBtnActive]}>
            <Text style={[s.productTabText, productTab === t && s.productTabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={openSearch} activeOpacity={0.8} style={s.searchTabBtn}>
          <Text style={s.searchTabBtnText}>기타 종목 검색</Text>
        </TouchableOpacity>
      </View>

      {/* ════ KP200 탭 ════ */}
      {productTab === 'KP200' && (
        <>
          <View style={s.kp200SubTabRow}>
            {(['월물','스프레드'] as KP200Sub[]).map(t => (
              <TouchableOpacity key={t} onPress={() => setKp200Sub(t)} activeOpacity={0.8} style={s.kp200SubTabBtn}>
                <Text style={[s.kp200SubTabText, kp200Sub === t && s.kp200SubTabTextActive]}>{t}</Text>
                {kp200Sub === t && <View style={s.kp200SubTabUnderline}/>}
              </TouchableOpacity>
            ))}
          </View>

          {kp200Sub === '월물' && (
            <View style={s.monthRow}>
              {kp200Months.map(m => (
                <TouchableOpacity key={m.shcode} activeOpacity={0.4} style={s.monthBtn}
                  onPress={() => navigation.navigate('FuturesOption', {shcode: m.shcode, hname: m.label, yyyymm: m.yyyymm})}>
                  <Text style={s.monthBtnText}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity style={s.expiryRow} activeOpacity={0.7} onPress={() => setDropdownVisible(true)}>
            <Text style={s.expiryLabel}>만기월</Text>
            <View style={s.expiryDropdown}>
              <Text style={s.expiryDropdownText}>{selectedExpiry || '-'}</Text>
              <Text style={s.expiryDropdownArrow}>▾</Text>
            </View>
          </TouchableOpacity>

          <Modal visible={dropdownVisible} transparent animationType="fade" onRequestClose={() => setDropdownVisible(false)}>
            <TouchableOpacity style={s.dropdownOverlay} activeOpacity={1} onPress={() => setDropdownVisible(false)}>
              <View style={s.dropdownMenu}>
                <Text style={s.dropdownTitle}>만기월 선택</Text>
                {expiryMonths.map(ym => (
                  <TouchableOpacity key={ym} style={[s.dropdownItem, selectedExpiry === ym && s.dropdownItemActive]}
                    activeOpacity={0.7} onPress={() => { setSelectedExpiry(ym); setDropdownVisible(false); }}>
                    <Text style={[s.dropdownItemText, selectedExpiry === ym && s.dropdownItemTextActive]}>{ym}</Text>
                    {selectedExpiry === ym && <Text style={s.dropdownCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>

          <ColHeader/>
          {kp200Loading ? (
            <View style={s.loadingWrap}><ActivityIndicator size="large" color={C.navy}/><Text style={s.loadingText}>조회 중...</Text></View>
          ) : (
            <ScrollView ref={kp200ScrollRef} showsVerticalScrollIndicator={false}>
              {kp200Rows.length === 0
                ? <View style={s.loadingWrap}><Text style={s.loadingText}>데이터가 없습니다</Text></View>
                : renderRows(kp200Rows, false)}
            </ScrollView>
          )}
        </>
      )}

      {/* ════ 위클리 탭 ════ */}
      {productTab === '위클리' && (
        <>
          <View style={s.weekSubRow}>
            {weekDayTabs.map(({day, label}) => (
              <TouchableOpacity key={day} onPress={() => setWeekDay(day)} activeOpacity={0.8}
                style={[s.weekSubBtn, weekDay === day && s.weekSubBtnActive]}>
                <Text style={[s.weekSubText, weekDay === day && s.weekSubTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ColHeader/>
          {loading ? (
            <View style={s.loadingWrap}><ActivityIndicator size="large" color={C.navy}/><Text style={s.loadingText}>위클리 옵션 조회 중...</Text></View>
          ) : (
            <ScrollView ref={weeklyScrollRef} showsVerticalScrollIndicator={false}>
              {rows.length === 0
                ? <View style={s.loadingWrap}><Text style={s.loadingText}>데이터가 없습니다</Text></View>
                : renderRows(rows, true)}
            </ScrollView>
          )}
        </>
      )}

      {/* ════ 검색 모달 ════ */}
      <Modal visible={searchVisible} animationType="slide" onRequestClose={closeSearch}>
        <SafeAreaView style={s.container} edges={['top']}>
          <StatusBar barStyle="dark-content" backgroundColor={C.bg}/>
          <View style={s.searchHeader}>
            <TouchableOpacity onPress={closeSearch} hitSlop={{top:12,bottom:12,left:12,right:12}}>
              <Text style={s.backBtn}>‹</Text>
            </TouchableOpacity>
            <View style={s.searchInputWrap}>
              <Text style={s.searchInputIcon}>🔍</Text>
              <TextInput
                ref={searchInputRef}
                style={s.searchInput}
                placeholder="종목명·행사가 검색   예) C 202604, 800"
                placeholderTextColor={C.dimText}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                clearButtonMode="while-editing"
                autoCorrect={false}
              />
            </View>
          </View>

          {searchLoading && (
            <View style={s.loadingWrap}>
              <ActivityIndicator size="large" color={C.navy}/>
              <Text style={s.loadingText}>전체 종목 불러오는 중...</Text>
              <Text style={[s.loadingText, {fontSize:12, color:C.dimText}]}>KP200 옵션 4개월 + 위클리</Text>
            </View>
          )}

          {!searchLoading && !searchQuery && (
            <View style={s.guideWrap}>
              <Text style={s.guideTitle}>이렇게 검색해보세요</Text>
              {[
                ['F 2606',   'KP200 선물 2026년 6월물'],
                ['C 202604', 'KP200 콜옵션 4월'],
                ['P 202606', 'KP200 풋옵션 6월'],
                ['WC',       '위클리 콜옵션'],
                ['800',      '행사가 800 전종목'],
              ].map(([ex, desc]) => (
                <TouchableOpacity key={ex} style={s.guideRow} onPress={() => setSearchQuery(ex)} activeOpacity={0.6}>
                  <Text style={s.guideEx}>{ex}</Text>
                  <Text style={s.guideDesc}>{desc}</Text>
                </TouchableOpacity>
              ))}
              {searchFetched && (
                <Text style={s.totalCount}>총 {searchItems.length}개 종목 로드됨</Text>
              )}
            </View>
          )}

          {!searchLoading && !!searchQuery && (
            <>
              <View style={s.resultBar}>
                <Text style={s.resultCount}>{searchFiltered.length}개 종목</Text>
              </View>
              <FlatList
                data={searchFiltered}
                keyExtractor={it => it.shcode}
                renderItem={renderSearchItem}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={s.loadingWrap}>
                    <Text style={s.loadingText}>검색 결과가 없습니다</Text>
                  </View>
                }
              />
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container:             {flex:1, backgroundColor:C.bg},
  header:                {flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border, gap:6},
  backBtn:               {fontSize:32, color:'#111', fontWeight:'300', lineHeight:36},
  headerTitle:           {fontSize:17, fontWeight:'800', flex:1},
  searchTabBtn:          {marginLeft:'auto', paddingHorizontal:14, paddingVertical:8, borderRadius:24, borderWidth:1.5, borderColor:C.navy, backgroundColor:C.bg},
  searchTabBtnText:      {fontSize:13, fontWeight:'600', color:C.navy},
  mainTabRow:            {flexDirection:'row', borderBottomWidth:2, borderBottomColor:C.border},
  mainTabBtn:            {flex:1, paddingVertical:12, alignItems:'center', borderBottomWidth:2.5, borderBottomColor:'transparent', marginBottom:-2},
  mainTabBtnActive:      {borderBottomColor:C.navy},
  mainTabText:           {fontSize:15, fontWeight:'400', color:C.subText},
  mainTabTextActive:     {fontWeight:'700', color:C.navy},
  productTabRow:         {flexDirection:'row', gap:8, paddingHorizontal:14, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border},
  productTabBtn:         {paddingHorizontal:20, paddingVertical:8, borderRadius:24, borderWidth:1.5, borderColor:'#DDD', backgroundColor:C.bg},
  productTabBtnActive:   {backgroundColor:C.navy, borderColor:C.navy},
  productTabText:        {fontSize:13, fontWeight:'500', color:'#555'},
  productTabTextActive:  {color:'#FFFFFF', fontWeight:'700'},
  kp200SubTabRow:        {flexDirection:'row', paddingHorizontal:14, paddingTop:10, paddingBottom:0, gap:20, borderBottomWidth:1, borderBottomColor:C.border},
  kp200SubTabBtn:        {paddingBottom:8, position:'relative'},
  kp200SubTabText:       {fontSize:14, color:C.subText},
  kp200SubTabTextActive: {color:C.navy, fontWeight:'700'},
  kp200SubTabUnderline:  {position:'absolute', bottom:0, left:0, right:0, height:2, backgroundColor:C.navy},
  monthRow:              {flexDirection:'row', gap:8, paddingHorizontal:14, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border},
  monthBtn:              {flex:1, height:38, justifyContent:'center', alignItems:'center', borderRadius:8, borderWidth:1.5, borderColor:'#DDD', backgroundColor:C.bg},
  monthBtnText:          {fontSize:13, color:C.subText, fontWeight:'500'},
  expiryRow:             {flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:14, paddingVertical:10, backgroundColor:C.rowBg, borderBottomWidth:1, borderBottomColor:C.border},
  expiryLabel:           {fontSize:14, fontWeight:'700', color:C.navy},
  expiryDropdown:        {flexDirection:'row', alignItems:'center', gap:6, borderWidth:1, borderColor:C.border, borderRadius:8, paddingHorizontal:12, paddingVertical:6, backgroundColor:C.bg, minWidth:130},
  expiryDropdownText:    {fontSize:13, color:'#333', flex:1},
  expiryDropdownArrow:   {fontSize:11, color:C.subText},
  dropdownOverlay:       {flex:1, backgroundColor:'rgba(0,0,0,0.3)', justifyContent:'center', alignItems:'center'},
  dropdownMenu:          {backgroundColor:C.bg, borderRadius:12, paddingVertical:8, width:220, borderWidth:1, borderColor:C.border},
  dropdownTitle:         {fontSize:13, fontWeight:'700', color:C.subText, paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border},
  dropdownItem:          {flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:14},
  dropdownItemActive:    {backgroundColor:'#F0F5FF'},
  dropdownItemText:      {fontSize:14, color:'#333'},
  dropdownItemTextActive:{color:C.navy, fontWeight:'700'},
  dropdownCheck:         {fontSize:14, color:C.navy, fontWeight:'700'},
  weekSubRow:            {flexDirection:'row', gap:10, paddingHorizontal:14, paddingVertical:12, borderBottomWidth:1, borderBottomColor:C.border},
  weekSubBtn:            {paddingHorizontal:20, paddingVertical:9, borderRadius:24, borderWidth:1.5, borderColor:'#DDD', backgroundColor:C.bg},
  weekSubBtnActive:      {borderColor:C.navy},
  weekSubText:           {fontSize:13, color:'#555'},
  weekSubTextActive:     {color:C.navy, fontWeight:'700'},
  colHeader:             {flexDirection:'row', paddingHorizontal:12, paddingVertical:6, backgroundColor:C.rowBg, borderBottomWidth:1, borderBottomColor:C.border},
  colText:               {flex:1, fontSize:11, color:C.subText},
  row:                   {flexDirection:'row', paddingHorizontal:12, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#F5F5F5', alignItems:'center'},
  rowATM:                {backgroundColor:C.atmBg},
  cell:                  {flex:1},
  strikeCell:            {flex:1, alignItems:'center'},
  chgText:               {fontSize:12},
  priceText:             {fontSize:14, fontWeight:'700'},
  strikeText:            {fontSize:13, fontWeight:'500', color:'#333', textAlign:'center'},
  strikeATM:             {fontWeight:'800'},
  loadingWrap:           {paddingVertical:40, alignItems:'center', justifyContent:'center', gap:12},
  loadingText:           {fontSize:14, color:C.subText},
  // 검색 모달
  searchHeader:          {flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, borderBottomWidth:1, borderBottomColor:C.border, gap:8},
  searchInputWrap:       {flex:1, flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:9, backgroundColor:C.inputBg, borderRadius:12, gap:6},
  searchInputIcon:       {fontSize:14},
  searchInput:           {flex:1, fontSize:14, color:'#333', padding:0},
  guideWrap:             {flex:1, paddingHorizontal:20, paddingTop:24},
  guideTitle:            {fontSize:13, fontWeight:'700', color:C.subText, marginBottom:12},
  guideRow:              {flexDirection:'row', alignItems:'center', gap:12, paddingVertical:12, borderBottomWidth:1, borderBottomColor:'#F5F5F5'},
  guideEx:               {fontSize:14, fontWeight:'700', color:C.navy, width:100},
  guideDesc:             {fontSize:13, color:C.subText},
  totalCount:            {marginTop:20, fontSize:12, color:C.dimText, textAlign:'center'},
  resultBar:             {paddingHorizontal:14, paddingVertical:8, backgroundColor:C.rowBg, borderBottomWidth:1, borderBottomColor:C.border},
  resultCount:           {fontSize:12, color:C.subText},
  searchItem:            {flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:14, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F5F5F5'},
  searchItemLeft:        {flexDirection:'row', alignItems:'center', gap:12},
  badge:                 {width:32, height:32, borderRadius:8, alignItems:'center', justifyContent:'center'},
  badgeText:             {fontSize:11, fontWeight:'800'},
  searchItemName:        {fontSize:14, fontWeight:'700', color:'#111'},
  searchItemSub:         {fontSize:12, color:C.subText, marginTop:2},
  searchItemRight:       {alignItems:'flex-end'},
  searchItemPrice:       {fontSize:14, fontWeight:'700'},
  searchItemChg:         {fontSize:12, marginTop:2},
});

export default FuturesSearchScreen;