import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import BottomTabNavigator from './BottomTabNavigator';
import LoginScreen from '../screens/LoginScreen';
import FuturesOptionScreen from '../screens/FuturesOptionScreen';
import OrderScreen from '../screens/OrderScreen';

import {FuturesHoga} from '../api/lsApi';

export type RootStackParamList = {
  Login:         undefined;
  Main:          undefined;
  FuturesOption: {
    shcode: string;
    hname:  string;
    yyyymm?: string;
  };
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
    </Stack.Navigator>
  );
};

export default RootNavigator;