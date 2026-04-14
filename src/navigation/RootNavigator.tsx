import React, {useEffect, useRef} from 'react';
import {AppState, Alert} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import LoginScreen from '../screens/LoginScreen';
import FuturesOptionScreen from '../screens/FuturesOptionScreen';
import OrderScreen from '../screens/OrderScreen';
import FuturesSearchScreen from '../screens/FuturesSearchScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {FuturesHoga} from '../api/lsApi';

export type RootStackParamList = {
  Login:         undefined;
  Main:          undefined;
  FuturesOption: {
    shcode: string;
    hname:  string;
    yyyymm?: string;
  };
  FuturesSearch: {
    selectMode?: boolean;  // true면 종목 선택 후 OrderScreen으로 복귀
  };
  Order: {
    mode:      '매수' | '매도' | '정정/취소' | '체결' | '잔고' | '자동화';
    shcode:    string;
    hname:     string;
    price:     number;
    openPrice: number;
    sign:      string;
    change:    number;
    diff:      number;
    hoga?:     FuturesHoga;
    autoOpen?: boolean;
  };
  AccountBalance: undefined;
  StrategyOrder:  undefined;
};

const RESULT_KEY = 'autoResults';

const iconMap: Record<string, string> = {
  futures_buy: '✅',
  next_weekly: '📋',
  exit:        '✅',
  error:       '❌',
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      console.log(`🔍 AppState: ${prev} → ${nextState}`);

      // background/inactive → active 전환 시에만 실행
      if (nextState !== 'active' || prev === 'active') return;

      console.log('✅ foreground 복귀 감지 — autoResults 확인 중');

      try {
        const raw = await AsyncStorage.getItem(RESULT_KEY);
        console.log('📦 autoResults raw:', raw);

        if (!raw) {
          console.log('⚠️ autoResults 없음 — 백그라운드에서 결과가 저장되지 않았음');
          return;
        }

        const results: any[] = JSON.parse(raw);
        if (!results || results.length === 0) {
          console.log('⚠️ autoResults 비어있음');
          return;
        }

        console.log(`🔔 알림 ${results.length}건 발견`);

        // 읽은 즉시 삭제 — 중복 알람 방지
        await AsyncStorage.removeItem(RESULT_KEY);

        // 여러 건이면 순서대로 체이닝
        const showNext = (idx: number) => {
          if (idx >= results.length) return;
          const r = results[idx];
          const icon = iconMap[r.type] ?? '🔔';
          const remaining = results.length - idx - 1;
          Alert.alert(
            `${icon} 자동매매 알림 (${r.ts})`,
            `${r.message}\n\n${r.detail ?? ''}`.trim(),
            [{
              text: remaining > 0 ? `다음 알림 (${remaining}건 남음)` : '확인',
              onPress: () => showNext(idx + 1),
            }],
            {cancelable: false},
          );
        };

        showNext(0);
      } catch (e) {
        console.log('❌ 자동매매 결과 알림 오류:', e);
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Login" component={LoginScreen}/>
      <Stack.Screen name="Main"  component={BottomTabNavigator}/>
      <Stack.Screen
        name="FuturesOption"
        component={FuturesOptionScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="Order"
        component={OrderScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="FuturesSearch"
        component={FuturesSearchScreen}
        options={{animation: 'slide_from_bottom'}}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;