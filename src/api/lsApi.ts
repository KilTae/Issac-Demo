const BASE_URL = 'https://openapi.ls-sec.co.kr:8080';

// 런타임에 로그인 화면에서 세팅됨
let APP_KEY    = '';
let APP_SECRET = '';
let accessToken: string | null = null;

// AsyncStorage 키 — LoginScreen과 동일하게 맞춤
const SAVE_KEY = 'savedApiKeys';

// 로그인 시 키 세팅 + 기존 토큰 초기화
export const setApiKeys = (appKey: string, appSecret: string) => {
  APP_KEY    = appKey;
  APP_SECRET = appSecret;
  accessToken = null;
};

export const getApiKeys = () => ({ appKey: APP_KEY, appSecret: APP_SECRET });

// ============================
// 인증
// ============================
export const getAccessToken = async (): Promise<string> => {
  // 키가 없으면 AsyncStorage에서 복원 시도 (앱 재시작 / 모듈 리로드 대응)
  if (!APP_KEY || !APP_SECRET) {
    try {
      const {default: AsyncStorage} = await import('@react-native-async-storage/async-storage');
      const val = await AsyncStorage.getItem(SAVE_KEY);
      if (val) {
        const {appKey, secretKey} = JSON.parse(val);
        if (appKey && secretKey) {
          APP_KEY    = appKey;
          APP_SECRET = secretKey;
        }
      }
    } catch {}
  }
  if (!APP_KEY || !APP_SECRET) throw new Error('앱 키와 시크릿 키를 먼저 입력해주세요.');

  const body = [
    'grant_type=client_credentials',
    `appkey=${encodeURIComponent(APP_KEY)}`,
    `appsecretkey=${encodeURIComponent(APP_SECRET)}`,
    'scope=oob',
  ].join('&');
  const response = await fetch(`${BASE_URL}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  console.log('🔑 토큰 발급 완료, APP_KEY 앞10자:', APP_KEY.slice(0, 10), '/ token 앞20자:', data.access_token?.slice(0, 20));
  if (!response.ok) throw new Error(data?.rsp_msg ?? '토큰 발급 실패');
  accessToken = data.access_token;
  return data.access_token;
};

const ensureToken = async () => {
  if (!accessToken) await getAccessToken();
};

const postApi = async (path: string, trCd: string, body: object) => {
  await ensureToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      authorization: `Bearer ${accessToken}`,
      tr_cd: trCd,
      tr_cont: 'N',
      tr_cont_key: '0',
      mac_address: '',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  console.log(`📡 [${trCd}] 응답:`, JSON.stringify(data).slice(0, 300));
  if (!response.ok) throw new Error(data?.rsp_msg ?? `${trCd} 조회 실패`);
  if (data?.rsp_cd && data.rsp_cd !== '00000' && data.rsp_cd !== '00200') {
    console.log(`⚠️ [${trCd}] rsp_cd=${data.rsp_cd} rsp_msg=${data.rsp_msg}`);
  }
  return data;
};

// ============================
// 계좌 잔고 조회 (t0424)
// ============================
export const getAccountBalance = async () => {
  return postApi('/stock/accno', 't0424', {
    t0424InBlock: { prcgb: '1', chegb: '0', dangb: '0', charge: '1', cts_expcode: '' },
  });
};

// ============================
// 계좌 거래내역 조회 (CDPCQ04700)
// ============================
export const getAccountTrades = async (startDt: string, endDt: string) => {
  return postApi('/stock/accno', 'CDPCQ04700', {
    CDPCQ04700InBlock1: {
      RecCnt: 1, QryTp: '0', QrySrtDt: startDt, QryEndDt: endDt,
      SrtNo: 0, PdptnCode: '01', IsuLgclssCode: '01', IsuNo: '',
    },
  });
};

// ============================
// 상승/하락 상위 종목 조회 (t1441)
// ============================
export const getHighStockItems = async (gubun2: '0' | '1' | '2' = '0') => {
  return postApi('/stock/high-item', 't1441', {
    t1441InBlock: {
      gubun1: '0', gubun2, gubun3: '0', jc_num: 0,
      sprice: 0, eprice: 999999, volume: 0, idx: 0, jc_num2: 0, exchgubun: 'K',
    },
  });
};

// ============================
// 주식 현재가 조회 (t1102)
// ============================
export const getStockPrice = async (shcode: string) => {
  return postApi('/stock/market-data', 't1102', { t1102InBlock: { shcode } });
};

// ============================
// 업종 현재가 조회 (t1511)
// ============================
export const getSectorPrice = async (upcode: string) => {
  return postApi('/stock/sector', 't1511', { t1511InBlock: { upcode } });
};

// ============================
// 주식계좌 기간별수익률 상세 조회 (FOCCQ33600)
// ============================
export const getAccountPeriodPnl = async (
  startDt: string, endDt: string, termTp: '1' | '2' | '3' = '1',
) => {
  return postApi('/stock/accno', 'FOCCQ33600', {
    FOCCQ33600InBlock1: { RecCnt: 1, QrySrtDt: startDt, QryEndDt: endDt, TermTp: termTp },
  });
};

// ============================
// ============================
// 선물옵션 계좌잔고 및 평가현황 (CFOAQ50600)
// BalEvalTp: '2' = 선입선출법 (HTS 기준과 동일)
// ============================
export interface FuturesBalanceHolding {
  fnoIsuNo:  string;  // 종목번호
  isuNm:     string;  // 종목명 (예: F 2606)
  bnsTpNm:   string;  // 매매구분명 (매수/매도)
  bnsTpCode: string;  // 매매구분코드 (1:매도 2:매수)
  unsttQty:  number;  // 미결제수량 (잔고)
  lqdtAbleQty: number; // 청산가능수량
  fnoAvrPrc: number;  // 평균가
  fnoNowPrc: number;  // 현재가
  evalAmt:   number;  // 평가금액
  evalPnl:   number;  // 평가손익
  pnlRat:    number;  // 손익율
  bnsplAmt:  number;  // 매매손익금액
}

export interface FuturesBalanceSummary {
  acntNo:           string; // 계좌번호
  acntNm:           string; // 계좌명
  evalDpsamtTotamt: number;
  futsEvalPnlAmt:   number;
  optEvalPnlAmt:    number;
  totPnlAmt:        number;
  mnyOrdAbleAmt:    number;
}

export const getFuturesBalance = async (): Promise<{
  summary:  FuturesBalanceSummary;
  holdings: FuturesBalanceHolding[];
}> => {
  const today = new Date();
  const ordDt = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;

  const res = await postApi('/futureoption/accno', 'CFOAQ50600', {
    CFOAQ50600InBlock1: {
      RecCnt: 1, OrdDt: ordDt,
      BalEvalTp: '2',
      FutsPrcEvalTp: '2',
      LqtQtyQryTp: '1',
    },
  });

  const b1 = res.CFOAQ50600OutBlock1 ?? {};
  const b2 = res.CFOAQ50600OutBlock2 ?? {};
  const b3 = Array.isArray(res.CFOAQ50600OutBlock3) ? res.CFOAQ50600OutBlock3 : [];

  return {
    summary: {
      acntNo:           String(b1.AcntNo          ?? ''),
      acntNm:           String(b2.AcntNm           ?? ''),
      evalDpsamtTotamt: Number(b2.EvalDpsamtTotamt ?? 0),
      futsEvalPnlAmt:   Number(b2.FutsEvalPnlAmt   ?? 0),
      optEvalPnlAmt:    Number(b2.OptEvalPnlAmt     ?? 0),
      totPnlAmt:        Number(b2.TotPnlAmt         ?? 0),
      mnyOrdAbleAmt:    Number(b2.MnyOrdAbleAmt     ?? 0),
    },
    holdings: b3.map((r: any) => ({
      fnoIsuNo:    String(r.FnoIsuNo     ?? ''),
      isuNm:       String(r.IsuNm        ?? ''),
      bnsTpNm:     String(r.BnsTpNm      ?? ''),
      bnsTpCode:   String(r.BnsTpCode    ?? ''),
      unsttQty:    Number(r.UnsttQty     ?? 0),
      lqdtAbleQty: Number(r.LqdtAbleQty  ?? 0),
      fnoAvrPrc:   Number(r.FnoAvrPrc    ?? 0),
      fnoNowPrc:   Number(r.FnoNowPrc    ?? 0),
      evalAmt:     Number(r.EvalAmt      ?? 0),
      evalPnl:     Number(r.EvalPnl      ?? 0),
      pnlRat:      Number(r.PnlRat       ?? 0),
      bnsplAmt:    Number(r.BnsplAmt     ?? 0),
    })),
  };
};

// ============================
// 선물옵션 차트 (t8416)
// ============================
export const getFuturesChart = async (
  shcode: string, gubun: '2' | '3' | '4',
  qrycnt: number = 100, sdate: string = '',
  edate: string = '99999999', cts_date: string = '',
) => {
  return postApi('/futureoption/chart', 't8416', {
    t8416InBlock: { shcode, gubun, qrycnt, sdate, edate, cts_date, comp_yn: 'N' },
  });
};

// ============================
// 코스피200 현물지수 분봉 샘플 조회 (디버그용)
// t8416 1분봉에서 kospijisu 필드 확인
// ============================
export const debugKospi200MinuteSamples = async (
  futCode: string,   // 선물 종목코드 (예: A0166000)
  count: number = 10,
): Promise<void> => {
  try {
    console.log(`\n🔍 [t8416 분봉 조회] futCode=${futCode}, count=${count}`);
    const res = await postApi('/futureoption/chart', 't8416', {
      t8416InBlock: {
        shcode:   futCode,
        gubun:    '2',       // 2 = 분봉
        qrycnt:   count,
        sdate:    '',
        edate:    '99999999',
        cts_date: '',
        comp_yn:  'N',
      },
    });

    // OutBlock 헤더 정보
    const header = res.t8416OutBlock;
    console.log('📋 OutBlock (헤더):', JSON.stringify(header));

    // 봉 데이터
    const bars = Array.isArray(res.t8416OutBlock1) ? res.t8416OutBlock1 : [];
    console.log(`📊 봉 개수: ${bars.length}개`);

    if (bars.length === 0) {
      console.log('⚠️ 봉 데이터 없음');
      return;
    }

    // 첫 번째 봉 전체 필드 출력 (어떤 필드가 있는지 확인)
    console.log('🔎 첫 번째 봉 전체 필드:', JSON.stringify(bars[0]));

    // 최신순으로 오는 데이터를 오래된 것부터 출력
    const reversed = [...bars].reverse();
    reversed.forEach((b: any, i: number) => {
      console.log(
        `[${i + 1}] time=${b.date ?? b.dtime ?? b.time ?? '?'} | ` +
        `close=${b.close ?? b.price ?? '?'} | ` +
        `kospijisu=${b.kospijisu ?? '없음'} | ` +
        `jisu=${b.jisu ?? '없음'} | ` +
        `open=${b.open ?? '?'} | ` +
        `high=${b.high ?? '?'} | ` +
        `low=${b.low ?? '?'}`,
      );
    });

    // kospijisu 필드 존재 여부 최종 판단
    const hasKospi = bars.some((b: any) => b.kospijisu !== undefined && Number(b.kospijisu) > 0);
    console.log(`\n✅ kospijisu 필드 사용 가능: ${hasKospi ? 'YES ✓' : 'NO ✗'}`);
    if (hasKospi) {
      const values = reversed.map((b: any) => Number(b.kospijisu)).filter(v => v > 0);
      const avg = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
      console.log(`📈 코스피200 샘플값: [${values.map(v => v.toFixed(2)).join(', ')}]`);
      console.log(`📊 평균: ${avg}`);
    }

  } catch (e: any) {
    console.log('❌ debugKospi200MinuteSamples 오류:', e?.message);
  }
};

// ============================
// 선물옵션 신규주문 (CFOAT00100)
// ============================
export type OrderPriceType = '00' | '03';
export type TrdPtnCode = '00' | '03'; // 00:신규, 03:청산

export const placeOrder = async (params: {
  fnoIsuNo:    string;
  bnsTpCode:   '1' | '2';
  orderType:   OrderPriceType;
  price:       number;
  qty:         number;
  trdPtnCode?: TrdPtnCode;  // 00:신규(기본), 03:청산
}) => {
  return postApi('/futureoption/order', 'CFOAT00100', {
    CFOAT00100InBlock1: {
      FnoIsuNo:         params.fnoIsuNo,
      BnsTpCode:        params.bnsTpCode,
      FnoOrdprcPtnCode: params.orderType,
      FnoOrdPrc:        params.orderType === '03' ? 0 : params.price,
      OrdQty:           params.qty,
      FnoTrdPtnCode:    params.trdPtnCode ?? '00',
    },
  });
};

// ============================
// 선물옵션 정정주문 (CFOAT00200)
// ============================
export const modifyOrder = async (params: {
  fnoIsuNo:         string;
  orgOrdNo:         number;
  fnoOrdprcPtnCode: OrderPriceType;
  fnoOrdPrc:        number;
  mdfyQty:          number;
}) => {
  return postApi('/futureoption/order', 'CFOAT00200', {
    CFOAT00200InBlock1: {
      FnoIsuNo:         params.fnoIsuNo,
      OrgOrdNo:         params.orgOrdNo,
      FnoOrdprcPtnCode: params.fnoOrdprcPtnCode,
      FnoOrdPrc:        params.fnoOrdprcPtnCode === '03' ? 0 : params.fnoOrdPrc,
      MdfyQty:          params.mdfyQty,
    },
  });
};

// ============================
// 선물/옵션 현재가 조회 (t2101)
// ============================
export interface FuturesPrice {
  hname: string; price: number; sign: string; change: number; diff: number;
  volume: number; open: number; high: number; low: number; jnilclose: number;
  mgjv: number; mgjvdiff: number; basis: number; kospijisu: number;
  kospisign: string; kospichange: number; kospidiff: number;
  lastmonth: string; jandatecnt: number; theoryprice: number; focode: string;
}

export const getFuturesPrice = async (focode: string): Promise<FuturesPrice> => {
  const res = await postApi('/futureoption/market-data', 't2101', {
    t2101InBlock: { focode },
  });
  const b = res.t2101OutBlock;
  return {
    hname: b.hname, price: Number(b.price), sign: b.sign,
    change: Number(b.change), diff: Number(b.diff), volume: Number(b.volume),
    open: Number(b.open), high: Number(b.high), low: Number(b.low),
    jnilclose: Number(b.jnilclose), mgjv: Number(b.mgjv), mgjvdiff: Number(b.mgjvdiff),
    basis: Number(b.basis), kospijisu: Number(b.kospijisu), kospisign: b.kospisign,
    kospichange: Number(b.kospichange), kospidiff: Number(b.kospidiff),
    lastmonth: b.lastmonth, jandatecnt: Number(b.jandatecnt),
    theoryprice: Number(b.theoryprice), focode: b.focode,
  };
};

// ============================
// 선물/옵션 현재가 호가 조회 (t2105)
// ============================
export interface FuturesHoga {
  price: number; sign: string; change: number; diff: number;
  volume: number; jnilclose: number;
  asks: { price: number; qty: number }[];
  bids: { price: number; qty: number }[];
  dvol: number; svol: number; time: string;
}

export const getFuturesHoga = async (shcode: string): Promise<FuturesHoga> => {
  const res = await postApi('/futureoption/market-data', 't2105', {
    t2105InBlock: { shcode },
  });
  const b = res.t2105OutBlock;
  return {
    price: Number(b.price), sign: b.sign, change: Number(b.change),
    diff: Number(b.diff), volume: Number(b.volume), jnilclose: Number(b.jnilclose),
    asks: [1,2,3,4,5].map(i => ({ price: Number(b[`offerho${i}`]), qty: Number(b[`offerrem${i}`]) })),
    bids: [1,2,3,4,5].map(i => ({ price: Number(b[`bidho${i}`]),   qty: Number(b[`bidrem${i}`])   })),
    dvol: Number(b.dvol), svol: Number(b.svol), time: b.time,
  };
};

// ============================
// 선물/옵션 잔고평가 이동평균 (t0441)
// ============================
export interface FuturesHolding {
  expcode: string; medosu: string; medocd: string;
  jqty: number; cqty: number; pamt: number; mamt: number;
  price: number; appamt: number; dtsunik1: number; sunikrt: number; dtsunik: number;
}

export interface FuturesHoldingSummary {
  tsunik: number; tappamt: number; tdtsunik: number;
}

export const getFuturesHoldings = async (): Promise<{
  summary: FuturesHoldingSummary; holdings: FuturesHolding[];
}> => {
  const res = await postApi('/futureoption/accno', 't0441', {
    t0441InBlock: { cts_expcode: '', cts_medocd: '' },
  });
  const b  = res.t0441OutBlock;
  const b1 = Array.isArray(res.t0441OutBlock1) ? res.t0441OutBlock1 : [];
  return {
    summary: {
      tsunik: Number(b.tsunik), tappamt: Number(b.tappamt), tdtsunik: Number(b.tdtsunik),
    },
    holdings: b1.map((r: any) => ({
      expcode: r.expcode, medosu: r.medosu, medocd: r.medocd,
      jqty: Number(r.jqty), cqty: Number(r.cqty), pamt: Number(r.pamt),
      mamt: Number(r.mamt), price: Number(r.price), appamt: Number(r.appamt),
      dtsunik1: Number(r.dtsunik1), sunikrt: Number(r.sunikrt), dtsunik: Number(r.dtsunik),
    })),
  };
};

// ============================
// 옵션 전광판 (t2301)
// gubun: 'G'=정규 'M'=미니 'W'=위클리
// yyyymm: 정규/미니='202604', 위클리 월요일='W1 ', 위클리 목요일='W2 '
// ============================
export interface OptionItem {
  actprice: number; optcode: string; price: number; sign: string;
  change: number; diff: number; volume: number; iv: number;
  delt: number; theoryprice: number; mgjv: number; atmgubun: string;
}

export interface OptionBoard {
  summary: { cimpv: number; pimpv: number; gmprice: number; jandatecnt: number; };
  calls: OptionItem[];
  puts:  OptionItem[];
}

export const getOptionBoard = async (
  yyyymm: string = '',
  gubun:  string = 'G',
): Promise<OptionBoard> => {
  const res = await postApi('/futureoption/market-data', 't2301', {
    t2301InBlock: { yyyymm, gubun },
  });
  const b  = res.t2301OutBlock;
  const b1 = Array.isArray(res.t2301OutBlock1) ? res.t2301OutBlock1 : [];
  const b2 = Array.isArray(res.t2301OutBlock2) ? res.t2301OutBlock2 : [];
  const parseItem = (r: any): OptionItem => ({
    actprice:    Number(r.actprice),
    optcode:     r.optcode,
    price:       Number(r.price),
    sign:        r.sign,
    change:      Number(r.change),
    diff:        Number(r.diff),
    volume:      Number(r.volume),
    iv:          Number(r.iv),
    delt:        Number(r.delt),
    theoryprice: Number(r.theoryprice),
    mgjv:        Number(r.mgjv),
    atmgubun:    r.atmgubun,
  });
  return {
    summary: {
      cimpv:      Number(b.cimpv),
      pimpv:      Number(b.pimpv),
      gmprice:    Number(b.gmprice),
      jandatecnt: Number(b.jandatecnt),
    },
    calls: b1.map(parseItem),
    puts:  b2.map(parseItem),
  };
};

// 위클리 옵션 전광판 — 월요일('W1 ')과 목요일('W2 ') 분리 조회
export const getWeeklyOptionBoard = async (
  weekDay: '월' | '목',
): Promise<OptionBoard> => {
  // W1 = 월요일 만기, W2 = 목요일 만기
  const yyyymm = weekDay === '월' ? 'W1 ' : 'W2 ';
  return getOptionBoard(yyyymm, 'W');
};

// ============================
// 선물/옵션 체결/미체결 조회 (t0434)
// chegb: '0'=전체 '1'=체결 '2'=미체결
// sortgb: '1'=주문번호 역순 '2'=주문번호 순
// ============================
export interface FuturesOrderItem {
  ordno:    number;  // 주문번호
  orgordno: number;  // 원주문번호
  medosu:   string;  // 구분 (매수/매도)
  ordgb:    string;  // 유형 (지정가 등)
  qty:      number;  // 주문수량
  price:    number;  // 주문가격
  cheqty:   number;  // 체결수량
  cheprice: number;  // 체결가격
  ordrem:   number;  // 미체결잔량
  status:   string;  // 상태 (완료/접수 등)
  ordtime:  string;  // 주문시간
  ordermtd: string;  // 주문매체
  expcode:  string;  // 종목번호
  hogatype: string;  // 호가타입
}

export const getFuturesOrders = async (
  expcode: string,
  chegb:   '0' | '1' | '2' = '0',
  sortgb:  '1' | '2'       = '1',
): Promise<FuturesOrderItem[]> => {
  const res = await postApi('/futureoption/accno', 't0434', {
    t0434InBlock: { expcode, chegb, sortgb, cts_ordno: ' ' },
  });
  const list = Array.isArray(res.t0434OutBlock1) ? res.t0434OutBlock1 : [];
  return list.map((r: any) => ({
    ordno:    Number(r.ordno),
    orgordno: Number(r.orgordno),
    medosu:   r.medosu,
    ordgb:    r.ordgb,
    qty:      Number(r.qty),
    price:    Number(r.price),
    cheqty:   Number(r.cheqty),
    cheprice: Number(r.cheprice),
    ordrem:   Number(r.ordrem),
    status:   r.status,
    ordtime:  r.ordtime,
    ordermtd: r.ordermtd,
    expcode:  r.expcode,
    hogatype: r.hogatype,
  }));
};

// 미체결 전용 래퍼
export const getPendingOrders = (expcode: string): Promise<FuturesOrderItem[]> =>
  getFuturesOrders(expcode, '2', '1');

// ============================
// 선물옵션 계좌 주문체결내역 조회 (CFOAQ00600)
// 계좌번호 + 계좌명 가져오는 용도로도 사용
// ============================
export interface FuturesAccountInfo {
  acntNo: string;  // 계좌번호
  acntNm: string;  // 계좌명
}

export const getFuturesAccountInfo = async (): Promise<FuturesAccountInfo> => {
  const today = new Date();
  const dt = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;
  const res = await postApi('/futureoption/accno', 'CFOAQ00600', {
    CFOAQ00600InBlock1: {
      RecCnt:         1,
      QrySrtDt:       dt,
      QryEndDt:       dt,
      FnoClssCode:    '00',
      PrdgrpCode:     '00',
      PrdtExecTpCode: '0',
      StnlnSeqTp:     '3',
      CommdaCode:     '99',
    },
  });
  const b1 = res.CFOAQ00600OutBlock1 ?? {};
  const b2 = res.CFOAQ00600OutBlock2 ?? {};
  return {
    acntNo: String(b1.AcntNo ?? ''),
    acntNm: String(b2.AcntNm ?? ''),
  };
};

// ============================
// 선물옵션 취소주문 (CFOAT00300)
// ============================
export const cancelOrder = async (params: {
  fnoIsuNo: string;  // 종목번호
  orgOrdNo: number;  // 원주문번호
  cancQty:  number;  // 취소수량
}) => {
  return postApi('/futureoption/order', 'CFOAT00300', {
    CFOAT00300InBlock1: {
      FnoIsuNo: params.fnoIsuNo,
      OrgOrdNo: params.orgOrdNo,
      CancQty:  params.cancQty,
    },
  });
};

// ============================
// 업종차트 N분 (t8418)
// 코스피200 현물지수 분봉 조회
// shcode: '101' = 코스피200, '001' = 코스피 종합
// ncnt: 1 = 1분봉
// ============================
export interface KospiMinuteBar {
  date:  string;  // "YYYYMMDD"
  time:  string;  // "HHMMSS"
  open:  number;
  high:  number;
  low:   number;
  close: number;  // 코스피200 현물지수값
}

export const getKospi200MinuteBars = async (
  count: number = 12,
  shcode: string = '101',  // 101 = 코스피200
): Promise<KospiMinuteBar[]> => {
  const res = await postApi('/indtp/chart', 't8418', {
    t8418InBlock: {
      shcode,
      ncnt:     1,
      qrycnt:   count,
      nday:     '0',
      sdate:    ' ',
      stime:    '',
      edate:    '99999999',
      etime:    '',
      cts_date: ' ',
      cts_time: '',
      comp_yn:  'N',
    },
  });
  const bars = Array.isArray(res.t8418OutBlock1) ? res.t8418OutBlock1 : [];
  return bars.map((b: any) => ({
    date:  String(b.date  ?? ''),
    time:  String(b.time  ?? ''),
    open:  Number(b.open  ?? 0),
    high:  Number(b.high  ?? 0),
    low:   Number(b.low   ?? 0),
    close: Number(b.close ?? 0),
  }));
};