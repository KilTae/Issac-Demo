import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

const AccountScreen = () => (
  <SafeAreaView style={styles.container}>
    <Text style={styles.title}>👤 계정</Text>
    <Text style={styles.sub}>곧 오픈 예정이에요</Text>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8},
  sub: {color: '#8B9AB0', fontSize: 14},
});

export default AccountScreen;