import BackgroundService from 'react-native-background-actions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFuturesPrice, getFuturesHoga, placeOrder, getWeeklyOptionBoard,
  getKospi200MinuteBars,
} from '../api/lsApi';

const STORAGE_KEY   = 'autoConfigs';
const LOG_KEY       = 'autoLogs';
const STATUS_KEY    = 'autoServiceStatus'; // 'running' | 'stopped'
const RESULT_KEY    = 'autoResults';       // 백그라운드 실행 결과 이벤트 목록

// ── 결과 이벤트 저장 ──────────────────────────────────────────────────────────
type ResultType = 'futures_buy' | 'next_weekly' | 'exit' | 'error';
interface ResultEvent {
  type:      ResultType;
  ts:        string;
  optCode:   string;
  message:   string;
  detail?:   string;
}

const appendResult = async (event: ResultEvent) => {
  try {
    const val  = await AsyncStorage.getItem(RESULT_KEY);
    const list: ResultEvent[] = val ? JSON.parse(val) : [];
    list.unshift(event);
    await AsyncStorage.setItem(RESULT_KEY, JSON.stringify(list.slice(0, 50)));
    console.log('💾 appendResult 저장 완료:', event.type, event.message);
  } catch (e: any) {
    console.log('❌ appendResult 저장 실패:', e?.message);
  }
};

// ── KST 시간 반환 ─────────────────────────────────────────────────────────────
const nowKST = (): string => {
  const kst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  return `${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}:${String(kst.getUTCSeconds()).padStart(2,'0')}`;
};

// ── 로그 저장 (AsyncStorage) ───────────────────────────────────────────────────
const appendLog = async (msg: string) => {
  const ts   = nowKST();
  const line = `[${ts}] ${msg}`;
  try {
    const val  = await AsyncStorage.getItem(LOG_KEY);
    const logs: string[] = val ? JSON.parse(val) : [];
    logs.unshift(line);
    await AsyncStorage.setItem(LOG_KEY, JSON.stringify(logs.slice(0, 200)));
  } catch {}
};

// ── 다음 위클리 풋옵션 탐색 ────────────────────────────────────────────────────
const findNextWeeklyPutCode = async (
  currentHname: string,
  strike: number,
): Promise<{ optcode: string; yyyymm: string; nextHname: string } | null> => {
  const isMon  = currentHname.includes('월');
  const nextDay: '월' | '목' = isMon ? '목' : '월';
  const nextYyyymm = nextDay === '목' ? 'W2 ' : 'W1 ';

  await appendLog(`🔍 다음 위클리(${nextDay}요일) 탐색 중...`);
  try {
    const board = await getWeeklyOptionBoard(nextDay);
    const exact = board.puts.find(p => Math.abs(p.actprice - strike) < 0.01);
    if (exact) {
      await appendLog(`✅ 발견: ${exact.optcode} (행사가 ${exact.actprice})`);
      return { optcode: exact.optcode, yyyymm: nextYyyymm, nextHname: `P ${nextDay} W? ${strike}` };
    }
    if (board.puts.length > 0) {
      const closest = board.puts.reduce((a, b) =>
        Math.abs(b.actprice - strike) < Math.abs(a.actprice - strike) ? b : a
      );
      await appendLog(`⚠️ 가장 가까운 행사가 ${closest.actprice}: ${closest.optcode}`);
      return { optcode: closest.optcode, yyyymm: nextYyyymm, nextHname: `P ${nextDay} W? ${closest.actprice}` };
    }
  } catch (e: any) {
    await appendLog(`❌ 위클리(${nextDay}) 조회 실패: ${e?.message}`);
  }
  return null;
};

// ── 시간 문자열 → 분 변환 ──────────────────────────────────────────────────────
const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// ── 위클리 만기일 계산 ────────────────────────────────────────────────────────
// hname 예) "P 목 W3 937.5" → 이번 달 3번째 목요일
//          "P 월 W1 937.5" → 이번 달 1번째 월요일
//          "P 월 W2 937.5" → 이번 달 2번째 월요일
const getWeeklyExpiryDate = (hname: string): Date | null => {
  // 형식1: "P 3주 목요일 937.50"
  // 형식2: "P 목 W3 937.5"
  const isMon = hname.includes('월요일') || hname.includes('월 W') || /P 월 /.test(hname);
  const isThu = hname.includes('목요일') || hname.includes('목 W') || /P 목 /.test(hname);
  if (!isMon && !isThu) return null;
  const targetDow = isMon ? 1 : 4;

  // 주차: "3주" 또는 "W3" 형식 모두 지원
  const weekMatch = hname.match(/(\d)주/) || hname.match(/W(\d)/);
  if (!weekMatch) return null;
  const weekNum = parseInt(weekMatch[1], 10);

  // 이번 달 기준으로 n번째 요일 찾기
  const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000); // KST
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth();

  let count = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === targetDow) {
      count++;
      if (count === weekNum) return date;
    }
  }
  return null;
};

// ── 오늘이 만기일 1일 전인지 확인 (일자만 비교) ──────────────────────────────
const isTodayExpiryDate = (hname: string): boolean => {
  const expiryDate = getWeeklyExpiryDate(hname);
  if (!expiryDate) return true; // 날짜 파악 불가 시 항상 실행
  const now = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  // 만기일 1일 전 날짜 계산
  const dayBefore = new Date(expiryDate);
  dayBefore.setDate(expiryDate.getDate() - 1);
  return dayBefore.getDate() === now.getUTCDate();
};

// ── 종목별 샘플 저장소 (백그라운드용) ────────────────────────────────────────
const kospiSampleMap: Record<string, number[]> = {};

// ── 단일 자동화 설정 실행 ─────────────────────────────────────────────────────
const runSingleConfig = async (cfg: any) => {
  const now = nowKST();
  // 주문 마감시간 14:50:00 고정
  const ORDER_DEADLINE = '15:32:00';

  // 날짜 조건 체크 — 만기일이 아니면 스킵
  if (!isTodayExpiryDate(cfg.putOptHname || '')) {
    const expiryDate = getWeeklyExpiryDate(cfg.putOptHname || '');
    const expiryStr  = expiryDate
      ? `${expiryDate.getMonth()+1}/${expiryDate.getDate()}`
      : '알 수 없음';
    await appendLog(`[${cfg.putOptCode}] 📅 오늘은 만기일이 아님 (만기: ${expiryStr}) — 대기 중`);
    return;
  }

  if (now >= ORDER_DEADLINE) {
    await appendLog(`[${cfg.putOptCode}] ⏰ 마감 시각 ${ORDER_DEADLINE} 도달`);
    const futCode   = cfg.futuresCode || 'A0166000';
    const priceData = await getFuturesPrice(futCode);
    const futPrice  = priceData.price;

    // ── 코스피200 결정: 샘플 평균 or 현재값 폴백 ─────────────────────────────
    let kospi200: number;
    const samples = kospiSampleMap[cfg.putOptCode] ?? [];
    if (samples.length > 0) {
      kospi200 = +(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(2);
      // 샘플 목록 상세 로그
      const deadlineMin2 = toMinutes(ORDER_DEADLINE.slice(0, 5));
      const sampleStart2 = deadlineMin2 - 10;
      const sampleList = samples
        .map((v, i) => {
          const m = sampleStart2 + i;
          return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}→${v.toFixed(2)}`;
        })
        .join(' / ');
      await appendLog(`[${cfg.putOptCode}] 📊 샘플 목록 [${samples.length}개]: ${sampleList}`);
      await appendLog(`[${cfg.putOptCode}] 📊 코스피200 평균 (${samples.length}개): ${kospi200.toFixed(2)}`);
    } else {
      try {
        const fallbackBars = await getKospi200MinuteBars(2, '101');
        kospi200 = fallbackBars[0]?.close ?? priceData.kospijisu;
      } catch {
        kospi200 = priceData.kospijisu;
      }
      await appendLog(`[${cfg.putOptCode}] 📊 코스피200 현재값 사용 (샘플 없음, t8418): ${kospi200.toFixed(2)}`);
    }
    // 사용 후 샘플 초기화
    delete kospiSampleMap[cfg.putOptCode];

    await appendLog(`[${cfg.putOptCode}] 마감 코스피200: ${kospi200.toFixed(2)} / 행사가: ${cfg.putStrike}`);

    if (kospi200 < cfg.putStrike) {
      // 선물 매수
      await appendLog(`[${cfg.putOptCode}] ⚠️ 선물 매수 조건 충족 — 주문 시작`);
      try {
        const res = await placeOrder({
          fnoIsuNo:  cfg.futuresCode,
          bnsTpCode: '2',
          orderType: '00',
          price:     +(futPrice + 0.5).toFixed(2),
          qty:       cfg.futuresQty,
        });
        const b2 = res.CFOAT00100OutBlock2;

        // 주문번호 없으면 실패로 처리
        if (!b2?.OrdNo) {
          const errMsg = res.rsp_msg ?? '주문번호가 없습니다. 잔고를 확인해주세요.';
          await appendLog(`[${cfg.putOptCode}] ❌ 선물 매수 실패 — ${errMsg}`);
          await appendResult({
            type:    'error',
            ts:      nowKST(),
            optCode: cfg.putOptCode,
            message: '❌ 선물 매수 실패 — 잔고를 확인해주세요',
            detail:  errMsg,
          });
          return;
        }

        await appendLog(`[${cfg.putOptCode}] ✅ 선물 매수 완료 — 주문번호: ${b2.OrdNo}`);
        const sampleDetailBg = samples.length > 0
          ? `\n\n[코스피200 샘플 ${samples.length}개]\n` + samples.map((v, i) => {
              const dm = toMinutes(ORDER_DEADLINE.slice(0, 5));
              const m = (dm - 10) + i;
              return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')} → ${v.toFixed(2)}`;
            }).join('\n') + `\n평균: ${kospi200.toFixed(2)}`
          : `\n코스피200: ${kospi200.toFixed(2)} (실시간 단일값)`;
        await appendResult({
          type:    'futures_buy',
          ts:      nowKST(),
          optCode: cfg.putOptCode,
          message: `✅ 선물 자동 매수 완료`,
          detail:  `종목: ${cfg.futuresCode}\n주문번호: ${b2?.OrdNo ?? '-'}\n수량: ${cfg.futuresQty}계약\n가격: ${(futPrice + 0.5).toFixed(2)}${sampleDetailBg}`,
        });
      } catch (e: any) {
        const errMsg = e?.message ?? '알 수 없는 오류';
        const isInsufficient = errMsg.includes('잔고') || errMsg.includes('증거금') || errMsg.includes('부족') || errMsg.includes('한도');
        await appendLog(`[${cfg.putOptCode}] ❌ 선물 매수 실패: ${errMsg}`);
        await appendResult({
          type:    'error',
          ts:      nowKST(),
          optCode: cfg.putOptCode,
          message: isInsufficient ? '❌ 선물 매수 실패 — 잔고/증거금 부족' : '❌ 선물 매수 실패',
          detail:  isInsufficient
            ? `잔고 또는 증거금이 부족하여 매수에 실패했습니다.\n\n${errMsg}`
            : errMsg,
        });
      }
    } else {
      // 다음 위클리 탐색
      await appendLog(`[${cfg.putOptCode}] 📋 코스피 >= 행사가 — 다음 위클리 탐색`);
      const result = await findNextWeeklyPutCode(cfg.putOptHname || '', cfg.putStrike);
      if (result) {
        // 저장된 설정 업데이트
        const val = await AsyncStorage.getItem(STORAGE_KEY);
        const all: Record<string, any> = val ? JSON.parse(val) : {};
        delete all[cfg.putOptCode];
        all[result.optcode] = { ...cfg, putOptCode: result.optcode, putOptHname: result.nextHname };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        await appendLog(`[${cfg.putOptCode}] 🔄 다음 위클리 변경: ${result.optcode}`);
        await appendResult({
          type:    'next_weekly',
          ts:      nowKST(),
          optCode: cfg.putOptCode,
          message: `📋 다음 위클리 풋매도 진입 필요`,
          detail:  `코스피200 현물(${kospi200.toFixed(2)})이 행사가(${cfg.putStrike})보다 높습니다.\n\n현재 풋옵션은 안전하게 만기 소멸됩니다.\n다음 위클리 풋옵션으로 매도 진입하세요.`,
        });
      }
    }

    // 완료된 설정 삭제
    const val2 = await AsyncStorage.getItem(STORAGE_KEY);
    const all2: Record<string, any> = val2 ? JSON.parse(val2) : {};
    delete all2[cfg.putOptCode];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all2));
    return;
  }

  // 모니터링 중 — 샘플 수집 + 청산 조건 체크
  try {
    const futCode   = cfg.futuresCode || 'A0166000';
    const priceData = await getFuturesPrice(futCode);
    const kospi200  = priceData.kospijisu;
    const futPrice  = priceData.price;
    const optHoga   = await getFuturesHoga(cfg.putOptCode);
    const optPrice  = optHoga.price;

    // ── 코스피200 샘플 수집 (deadline 10분 전부터 1분 간격) ──────────────────
    const nowMin      = toMinutes(now.slice(0, 5));
    const deadlineMin = toMinutes(ORDER_DEADLINE.slice(0, 5));
    const sampleStart = deadlineMin - 10;
    const nowSec      = parseInt(now.slice(6, 8), 10);

    // 처음 수집 구간 진입 시 t8418로 코스피200 현물지수 분봉 소급
    if (!kospiSampleMap[cfg.putOptCode]) {
      kospiSampleMap[cfg.putOptCode] = [];

      const missedCount = Math.max(0, nowMin - sampleStart);
      if (missedCount > 0) {
        await appendLog(`[${cfg.putOptCode}] 🔍 코스피200 분봉 소급 조회 (t8418) — ${missedCount}개 필요`);
        try {
          const bars = await getKospi200MinuteBars(missedCount + 3, '101');
          // API는 최신순 → 시간 오름차순 정렬 (과거→최신)
          const sorted = [...bars].sort((a, b) => {
            const toMin = (t: string) => parseInt(t.slice(0,2),10)*60 + parseInt(t.slice(2,4),10);
            return toMin(a.time) - toMin(b.time);
          });
          const backfilled: { min: number; val: number }[] = [];

          for (const b of sorted) {
            const t = b.time; // "HHMMSS"
            if (t.length < 6) continue;
            const hh = parseInt(t.slice(0, 2), 10);
            const mm = parseInt(t.slice(2, 4), 10);
            const ss = parseInt(t.slice(4, 6), 10);
            const barMin = hh * 60 + mm;
            const timeDisplay = `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
            const kospiVal = b.close;

            if (barMin >= sampleStart && barMin < nowMin && kospiVal > 0) {
              backfilled.push({ min: barMin, val: kospiVal });
              await appendLog(`[${cfg.putOptCode}] 📈 소급 [${backfilled.length}] ${timeDisplay} → ${kospiVal.toFixed(2)}`);
            } else {
              await appendLog(`[${cfg.putOptCode}] ⏭ 스킵 | ${timeDisplay} | barMin=${barMin} | close=${kospiVal}`);
            }
          }

          if (backfilled.length > 0) {
            kospiSampleMap[cfg.putOptCode] = backfilled.map(x => x.val);
            const avg = (backfilled.reduce((a, b) => a + b.val, 0) / backfilled.length).toFixed(2);
            const sampleListStr = backfilled
              .map(x => `${String(Math.floor(x.min/60)).padStart(2,'0')}:${String(x.min%60).padStart(2,'0')}→${x.val.toFixed(2)}`)
              .join(' / ');
            await appendLog(`[${cfg.putOptCode}] ✅ 소급 완료 — ${backfilled.length}개`);
            await appendLog(`[${cfg.putOptCode}] 📋 소급 샘플: [${sampleListStr}]`);
            await appendLog(`[${cfg.putOptCode}] 📊 현재 평균: ${avg} / 앞으로 ${10 - backfilled.length}개 실시간 수집 예정`);
          } else {
            await appendLog(`[${cfg.putOptCode}] ⚠️ 소급 범위 내 데이터 없음 — 실시간 수집만 사용`);
          }
        } catch (e: any) {
          await appendLog(`[${cfg.putOptCode}] ❌ t8418 소급 실패: ${e?.message}`);
        }
      }
    }

    // 수집 구간 진입 전 — 몇 분 후 시작인지 안내
    if (nowMin < sampleStart && nowSec < 15) {
      const remainMin = sampleStart - nowMin;
      const sHH = String(Math.floor(sampleStart / 60)).padStart(2, '0');
      const sMM = String(sampleStart % 60).padStart(2, '0');
      await appendLog(`[${cfg.putOptCode}] ⏳ 샘플 수집 대기 — ${sHH}:${sMM} 부터 시작 (${remainMin}분 후)`);
    }

    // 수집 구간 — 1분 간격 수집
    if (nowMin >= sampleStart && nowMin < deadlineMin && nowSec < 15) {
      if (!kospiSampleMap[cfg.putOptCode]) kospiSampleMap[cfg.putOptCode] = [];
      const samples = kospiSampleMap[cfg.putOptCode];
      const expectedCount = nowMin - sampleStart;
      const slotHH = String(Math.floor(nowMin / 60)).padStart(2, '0');
      const slotMM = String(nowMin % 60).padStart(2, '0');

      if (samples.length < expectedCount) {  // 소급 슬롯 중복 방지
        // t8418로 현재 분의 코스피200 현물지수 조회
        let kospi200Realtime = kospi200;
        try {
          const realtimeBars = await getKospi200MinuteBars(2, '101');
          kospi200Realtime = realtimeBars[0]?.close ?? kospi200;
        } catch { /* t2101 폴백 */ }
        samples.push(kospi200Realtime);
        const remaining = 10 - samples.length;
        await appendLog(
          `[${cfg.putOptCode}] 📈 샘플 [${samples.length}/10]` +
          ` | 시각: ${slotHH}:${slotMM}:${String(nowSec).padStart(2,'0')}` +
          ` | 코스피200: ${kospi200Realtime.toFixed(2)}` +
          ` | 남은: ${remaining}개 | 마감까지: ${deadlineMin - nowMin}분`,
        );
        const sampleList = samples
          .map((v, i) => {
            const m = sampleStart + i;
            const h = String(Math.floor(m / 60)).padStart(2, '0');
            const mm2 = String(m % 60).padStart(2, '0');
            return `${h}:${mm2}→${v.toFixed(2)}`;
          })
          .join(' / ');
        await appendLog(`[${cfg.putOptCode}] 📋 누적 샘플: [${sampleList}]`);
      } else {
        await appendLog(
          `[${cfg.putOptCode}] ⏭ ${slotHH}:${slotMM} 슬롯 이미 수집됨 (count=${samples.length})`,
        );
      }
    }

    // 수집 구간 내 정각이 아닐 때
    if (nowMin >= sampleStart && nowMin < deadlineMin && nowSec >= 15) {
      const currentCount = kospiSampleMap[cfg.putOptCode]?.length ?? 0;
      await appendLog(
        `[${cfg.putOptCode}] 🕐 수집 진행 중 [${currentCount}/10]` +
        ` | ${now.slice(0,8)} | 다음 수집까지 약 ${60 - nowSec}초`,
      );
    }

    await appendLog(`[${cfg.putOptCode}] 코스피: ${kospi200.toFixed(2)} | 옵션: ${optPrice.toFixed(2)}P | 선물: ${futPrice.toFixed(2)}${(kospiSampleMap[cfg.putOptCode]?.length ?? 0) > 0 ? ` | 샘플 ${kospiSampleMap[cfg.putOptCode].length}/10` : ''}`);

    if (cfg.exitEnabled && cfg.exitPrice > 0 && optPrice <= cfg.exitPrice) {
      await appendLog(`[${cfg.putOptCode}] ⚠️ 청산 조건 충족 — 옵션가 ${optPrice.toFixed(2)} ≤ 기준가 ${cfg.exitPrice.toFixed(2)} — 주문 시작`);
      try {
        const res = await placeOrder({
          fnoIsuNo:  cfg.putOptCode,
          bnsTpCode: '1',
          orderType: '03',
          price:     0,
          qty:       1,
        });
        const b2 = res.CFOAT00100OutBlock2;
        await appendLog(`[${cfg.putOptCode}] ✅ 청산 완료 — 주문번호: ${b2?.OrdNo ?? '-'}`);
        await appendResult({
          type:    'exit',
          ts:      nowKST(),
          optCode: cfg.putOptCode,
          message: `✅ 풋옵션 자동 청산 완료`,
          detail:  `종목: ${cfg.putOptCode}\n주문번호: ${b2?.OrdNo ?? '-'}\n청산가: ${optPrice.toFixed(2)}P\n(기준가: ${cfg.exitPrice.toFixed(2)}P 이하 도달)`,
        });

        // 완료된 설정 삭제
        const val = await AsyncStorage.getItem(STORAGE_KEY);
        const all: Record<string, any> = val ? JSON.parse(val) : {};
        delete all[cfg.putOptCode];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch (e: any) {
        await appendLog(`[${cfg.putOptCode}] ❌ 청산 실패: ${e?.message}`);
        await appendResult({
          type:    'error',
          ts:      nowKST(),
          optCode: cfg.putOptCode,
          message: `❌ 풋옵션 청산 실패`,
          detail:  e?.message ?? '알 수 없는 오류',
        });
      }
    }
  } catch (e: any) {
    await appendLog(`[${cfg.putOptCode}] ❌ API 조회 실패: ${e?.message}`);
  }
};

// ── 백그라운드 태스크 메인 루프 ───────────────────────────────────────────────
const backgroundTask = async (taskData?: any) => {
  await appendLog('🚀 백그라운드 자동화 서비스 시작');

  // 10초마다 저장된 모든 자동화 설정 실행
  await new Promise<void>(async (resolve) => {
    const loop = async () => {
      try {
        const val = await AsyncStorage.getItem(STORAGE_KEY);
        const all: Record<string, any> = val ? JSON.parse(val) : {};
        const configs = Object.values(all);

        if (configs.length === 0) {
          await appendLog('⏸ 등록된 자동화 없음 — 대기 중');
        } else {
          for (const cfg of configs) {
            await runSingleConfig(cfg);
          }
        }

        // 서비스 중지 신호 체크
        const status = await AsyncStorage.getItem(STATUS_KEY);
        if (status === 'stopped') {
          await appendLog('🛑 백그라운드 서비스 중지');
          resolve();
          return;
        }
      } catch (e: any) {
        await appendLog(`❌ 루프 오류: ${e?.message}`);
      }

      setTimeout(loop, 10000); // 10초 후 재실행
    };
    loop();
  });
};

// ── 서비스 옵션 ───────────────────────────────────────────────────────────────
const serviceOptions = {
  taskName:  'AutoTradeService',
  taskTitle: '자동매매 실행 중',
  taskDesc:  '백그라운드에서 선물/옵션 자동매매를 모니터링합니다',
  taskIcon:  { name: 'ic_launcher_round', type: 'mipmap' },
  color:     '#1B3764',
};

// ── 외부 API ──────────────────────────────────────────────────────────────────
export const startBackgroundService = async () => {
  try {
    await AsyncStorage.setItem(STATUS_KEY, 'running');
    await BackgroundService.start(backgroundTask, serviceOptions);
    console.log('✅ 백그라운드 서비스 시작');
  } catch (e: any) {
    console.log('❌ 백그라운드 서비스 시작 실패:', e?.message);
  }
};

export const stopBackgroundService = async () => {
  try {
    await AsyncStorage.setItem(STATUS_KEY, 'stopped');
    await BackgroundService.stop();
    console.log('🛑 백그라운드 서비스 중지');
  } catch (e: any) {
    console.log('❌ 백그라운드 서비스 중지 실패:', e?.message);
  }
};

export const isBackgroundServiceRunning = (): boolean => {
  return BackgroundService.isRunning();
};

export const getBackgroundLogs = async (): Promise<string[]> => {
  try {
    const val = await AsyncStorage.getItem(LOG_KEY);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
};

export const clearBackgroundLogs = async () => {
  await AsyncStorage.removeItem(LOG_KEY);
};

export const getAutoResults = async (): Promise<ResultEvent[]> => {
  try {
    const val = await AsyncStorage.getItem(RESULT_KEY);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
};

export const clearAutoResults = async () => {
  await AsyncStorage.removeItem(RESULT_KEY);
};