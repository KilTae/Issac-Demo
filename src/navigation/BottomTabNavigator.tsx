import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {View, Text, TouchableOpacity, StyleSheet, Platform} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import AccountScreen from '../screens/AccountScreen';
import AccountBalanceScreen from '../screens/AccountBalanceScreen';
import FuturesSearchScreen from '../screens/FuturesSearchScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  {name: 'Balance', label: '잔고',  icon: 'balance'},
  {name: 'Search',  label: '검색',  icon: 'search'},
  {name: 'Account', label: '설정',  icon: 'account'},
];

const TabIcon = ({name, active}: {name: string; active: boolean}) => {
  const color = active ? '#2A3A6A' : '#BBBBBB';
  const size  = 22;

  if (name === 'balance') {
    return (
      <View style={{width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', gap: 3}}>
        <View style={{width: 5, height: 8,  backgroundColor: color, borderRadius: 2}}/>
        <View style={{width: 5, height: 13, backgroundColor: color, borderRadius: 2}}/>
        <View style={{width: 5, height: 18, backgroundColor: color, borderRadius: 2}}/>
      </View>
    );
  }
  if (name === 'search') {
    return (
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Circle cx={10} cy={10} r={6.5} stroke={color} strokeWidth={2} strokeLinecap="round"/>
        <Path d="M15.5 15.5L21 21" stroke={color} strokeWidth={2} strokeLinecap="round"/>
      </Svg>
    );
  }
  if (name === 'account') {
    return (
      <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center', gap: 2}}>
        <View style={{width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: color}}/>
        <View style={{width: 16, height: 6, borderRadius: 4, borderWidth: 1.5, borderColor: color, borderBottomWidth: 0}}/>
      </View>
    );
  }
  return null;
};

const CustomTabBar = ({state, navigation}: any) => (
  <View style={s.tabBar}>
    {TABS.map((tab, idx) => {
      const active = state.index === idx;
      return (
        <TouchableOpacity
          key={tab.name}
          style={s.tabItem}
          onPress={() => navigation.navigate(tab.name)}
          activeOpacity={0.7}>
          <TabIcon name={tab.icon} active={active}/>
          <Text style={[s.tabLabel, active && s.tabLabelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const BottomTabNavigator = () => (
  <Tab.Navigator
    initialRouteName="Balance"
    tabBar={props => <CustomTabBar {...props}/>}
    screenOptions={{headerShown: false}}>
    <Tab.Screen name="Balance" component={AccountBalanceScreen}/>
    <Tab.Screen name="Search"  component={FuturesSearchScreen}/>
    <Tab.Screen name="Account" component={AccountScreen}/>
  </Tab.Navigator>
);

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EAEAEA',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tabItem:        {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4},
  tabLabel:       {fontSize: 10, color: '#BBBBBB', fontWeight: '500'},
  tabLabelActive: {color: '#2A3A6A', fontWeight: '800'},
});

export default BottomTabNavigator;