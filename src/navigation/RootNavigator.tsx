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

  const checkAndShowResults = async () => {
    try {
      const raw = await AsyncStorage.getItem(RESULT_KEY);
      if (!raw) return;
      const results: any[] = JSON.parse(raw);
      if (!results || results.length === 0) return;

      await AsyncStorage.removeItem(RESULT_KEY);

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
  };

  useEffect(() => {
    // foreground에 있는 동안 5초마다 결과 체크
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        checkAndShowResults();
      }
    }, 5000);

    // background → active 전환 시에도 즉시 체크
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if (nextState !== 'active' || prev === 'active') return;
      await checkAndShowResults();
    });

    return () => {
      clearInterval(interval);
      sub.remove();
    };
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