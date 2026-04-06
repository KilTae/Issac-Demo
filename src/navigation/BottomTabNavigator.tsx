import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {View, Text, TouchableOpacity, StyleSheet, Platform} from 'react-native';
import AccountScreen from '../screens/AccountScreen';
import AccountBalanceScreen from '../screens/AccountBalanceScreen';
import FuturesSearchScreen from '../screens/FuturesSearchScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  {name: 'Home',        label: '홈',        icon: 'home'},
  {name: 'Balance',     label: '잔고',      icon: 'balance'},
  {name: 'OptionBoard', label: '옵션전광판', icon: 'board'},
  {name: 'Account',     label: '설정',      icon: 'account'},
];

const TabIcon = ({name, active}: {name: string; active: boolean}) => {
  const color = active ? '#2A3A6A' : '#BBBBBB';
  const size  = 22;

  if (name === 'home') {
    return (
      <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
        <View style={{
          width: 0, height: 0,
          borderLeftWidth: 11, borderRightWidth: 11, borderBottomWidth: 9,
          borderLeftColor: 'transparent', borderRightColor: 'transparent',
          borderBottomColor: color, marginBottom: -1,
        }}/>
        <View style={{width: 14, height: 10, backgroundColor: color, borderRadius: 1}}/>
      </View>
    );
  }
  if (name === 'balance') {
    return (
      <View style={{width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', gap: 3}}>
        <View style={{width: 5, height: 8,  backgroundColor: color, borderRadius: 2}}/>
        <View style={{width: 5, height: 13, backgroundColor: color, borderRadius: 2}}/>
        <View style={{width: 5, height: 18, backgroundColor: color, borderRadius: 2}}/>
      </View>
    );
  }
  if (name === 'board') {
    return (
      <View style={{width: size, height: size, alignItems: 'center', justifyContent: 'center'}}>
        <View style={{width: 20, height: 15, borderRadius: 3, borderWidth: 1.5, borderColor: color, alignItems: 'flex-start', justifyContent: 'center', padding: 3, gap: 3}}>
          <View style={{width: 12, height: 1.5, backgroundColor: color, borderRadius: 1}}/>
          <View style={{width: 8,  height: 1.5, backgroundColor: color, borderRadius: 1}}/>
        </View>
      </View>
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
    <Tab.Screen name="Home"        component={FuturesSearchScreen}/>
    <Tab.Screen name="Balance"     component={AccountBalanceScreen}/>
    <Tab.Screen name="OptionBoard" component={AccountScreen}/>
    <Tab.Screen name="Account"     component={AccountScreen}/>
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