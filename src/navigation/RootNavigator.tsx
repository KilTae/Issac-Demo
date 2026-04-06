import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import LoginScreen from '../screens/LoginScreen';
import FuturesOptionScreen from '../screens/FuturesOptionScreen';
import OrderScreen from '../screens/OrderScreen';
import FuturesSearchScreen from '../screens/FuturesSearchScreen';

import {FuturesHoga} from '../api/lsApi';

export type RootStackParamList = {
  Login:         undefined;
  Main:          undefined;
  FuturesOption: {
    shcode: string;
    hname:  string;
    yyyymm?: string;  // 옵션전광판 탭에서 만기월 기준 조회용
  };
  FuturesSearch: undefined;
  Order: {
    mode:      '매수' | '매도' | '정정/취소' | '체결' | '잔고';
    shcode:    string;
    hname:     string;
    price:     number;
    openPrice: number;
    sign:      string;
    change:    number;
    diff:      number;
    hoga?:     FuturesHoga;
  };
  AccountBalance: undefined;
  StrategyOrder:  undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const RootNavigator = () => {
  return (
    // initialRouteName으로 초기 화면 명시 — JSX prop 안에 주석 넣으면 문법 오류남
    <Stack.Navigator
      screenOptions={{headerShown: false}}>
      <Stack.Screen name="Login"         component={LoginScreen} />
      <Stack.Screen name="Main"          component={BottomTabNavigator} />
      <Stack.Screen
        name="FuturesOption"
        component={FuturesOptionScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="FuturesSearch"
        component={FuturesSearchScreen}
        options={{animation: 'slide_from_right'}}
      />
      <Stack.Screen
        name="Order"
        component={OrderScreen}
        options={{animation: 'slide_from_right'}}
      />

    </Stack.Navigator>
  );
};

export default RootNavigator;