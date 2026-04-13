import BackgroundService from 'react-native-background-actions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFuturesPrice, getFuturesHoga, placeOrder, getWeeklyOptionBoard,
} from '../api/lsApi';

const STORAGE_KEY   = 'autoConfigs';
const LOG_KEY       = 'autoLogs';
const STATUS_KEY    = 'autoServiceStatus'; // 'running' | 'stopped'

// ── KST 시간 반환 ─────────────────────────────────────────────────────────────
const nowKST = (): string => {
  const kst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  return `${String(kst.getUTCHours()).padStart(2,'0')}:${String(kst.getUTCMinutes()).padStart(2,'0')}:${String(kst.getUTCSeconds()).padStart(2,'0')}`;
};

// ── 로그 저장 (AsyncStorage) ───────────────────────────────────────────────────
const appendLog = async (msg: string) => {
  const ts   = nowKST();
  const line = `[${ts}] ${msg}`;
  console.log('🤖', line);
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

// ── 단일 자동화 설정 실행 ─────────────────────────────────────────────────────
const runSingleConfig = async (cfg: any) => {
  const now = nowKST();

  if (now < cfg.monitorStart) {
    await appendLog(`[${cfg.putOptCode}] ⏳ ${cfg.monitorStart} 이후 활성화 (현재 ${now})`);
    return;
  }

  if (now >= cfg.orderDeadline) {
    await appendLog(`[${cfg.putOptCode}] ⏰ 마감 시각 ${cfg.orderDeadline} 도달`);
    const futCode   = cfg.futuresCode || 'A0166000';
    const priceData = await getFuturesPrice(futCode);
    const kospi200  = priceData.kospijisu;
    const futPrice  = priceData.price;
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
        await appendLog(`[${cfg.putOptCode}] ✅ 선물 매수 완료 — 주문번호: ${b2?.OrdNo ?? '-'}`);
      } catch (e: any) {
        await appendLog(`[${cfg.putOptCode}] ❌ 선물 매수 실패: ${e?.message}`);
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
      }
    }

    // 완료된 설정 삭제
    const val2 = await AsyncStorage.getItem(STORAGE_KEY);
    const all2: Record<string, any> = val2 ? JSON.parse(val2) : {};
    delete all2[cfg.putOptCode];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all2));
    return;
  }

  // 모니터링 중 — 청산 조건 체크
  try {
    const futCode   = cfg.futuresCode || 'A0166000';
    const priceData = await getFuturesPrice(futCode);
    const kospi200  = priceData.kospijisu;
    const futPrice  = priceData.price;
    const optHoga   = await getFuturesHoga(cfg.putOptCode);
    const optPrice  = optHoga.price;

    await appendLog(`[${cfg.putOptCode}] 코스피: ${kospi200.toFixed(2)} | 옵션: ${optPrice.toFixed(2)}P | 선물: ${futPrice.toFixed(2)}`);

    if (cfg.exitEnabled && optPrice <= cfg.exitThreshold) {
      await appendLog(`[${cfg.putOptCode}] ⚠️ 청산 조건 충족 — 주문 시작`);
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

        // 완료된 설정 삭제
        const val = await AsyncStorage.getItem(STORAGE_KEY);
        const all: Record<string, any> = val ? JSON.parse(val) : {};
        delete all[cfg.putOptCode];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch (e: any) {
        await appendLog(`[${cfg.putOptCode}] ❌ 청산 실패: ${e?.message}`);
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