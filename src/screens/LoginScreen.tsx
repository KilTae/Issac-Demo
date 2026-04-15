import React, {useState, useEffect} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, StatusBar, KeyboardAvoidingView,
  Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RootStackParamList} from '../navigation/RootNavigator';
import {setApiKeys, getAccessToken} from '../api/lsApi';

const SAVE_KEY = 'savedApiKeys';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen = ({navigation}: Props) => {
  const [tab,        setTab]        = useState<'real' | 'demo'>('real');
  const [appKey,     setAppKey]     = useState('');
  const [secretKey,  setSecretKey]  = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [saveKey,    setSaveKey]    = useState(false);
  const [loading,    setLoading]    = useState(false);

  // 앱 시작 시 저장된 키 불러오기
  useEffect(() => {
    AsyncStorage.getItem(SAVE_KEY).then(val => {
      if (val) {
        try {
          const {appKey: ak, secretKey: sk} = JSON.parse(val);
          if (ak && sk) {
            setAppKey(ak);
            setSecretKey(sk);
            setSaveKey(true);
          }
        } catch {}
      }
    });
  }, []);

  const isReady = appKey.trim().length > 0 && secretKey.trim().length > 0;

  const handleConnect = async () => {
    if (!isReady) return;
    setLoading(true);
    try {
      const trimmedKey    = appKey.trim();
      const trimmedSecret = secretKey.trim();

      // 1. 입력받은 키를 lsApi에 세팅 (기존 토큰 초기화 포함)
      setApiKeys(trimmedKey, trimmedSecret);

      // 2. 토큰 발급 시도 (키 유효성 확인)
      await getAccessToken();

      // 3. 키 저장 여부 처리
      if (saveKey) {
        await AsyncStorage.setItem(SAVE_KEY, JSON.stringify({appKey: trimmedKey, secretKey: trimmedSecret}));
      } else {
        await AsyncStorage.removeItem(SAVE_KEY);
      }

      // 4. 모의/실전 탭 정보 저장
      await AsyncStorage.setItem('accountType', tab);

      // 4. 성공 → 메인으로 이동
      navigation.replace('Main');
    } catch (e: any) {
      Alert.alert(
        '연결 실패',
        e?.message ?? '앱 키 또는 시크릿 키를 확인해주세요.',
        [{text: '확인'}],
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6FB"/>

      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>

          {/* ── 아이콘 & 타이틀 ── */}
          <View style={s.headerWrap}>
            <View style={s.iconWrap}>
              <Text style={s.iconText}>LS</Text>
            </View>
            <Text style={s.title}>선물/옵션 자동주문</Text>
            <Text style={s.subtitle}>LS증권 Open API 연동 자동매매 시스템</Text>
          </View>

          {/* ── 탭 ── */}
          <View style={s.tabWrap}>
            {(['real', 'demo'] as const).map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tabBtn, tab === t && s.tabBtnActive]}
                onPress={() => setTab(t)}
                activeOpacity={0.8}>
                <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                  {t === 'real' ? '실전투자' : '모의투자'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── 앱 키 ── */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>앱 키 (App Key)</Text>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                placeholder="발급받은 앱 키를 입력하세요"
                placeholderTextColor="#A0AABB"
                value={appKey}
                onChangeText={setAppKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={s.inputIcon}>🔑</Text>
            </View>
          </View>

          {/* ── 시크릿 키 ── */}
          <View style={s.fieldWrap}>
            <Text style={s.fieldLabel}>시크릿 키 (Secret Key)</Text>
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                placeholder="발급받은 시크릿 키를 입력하세요"
                placeholderTextColor="#A0AABB"
                value={secretKey}
                onChangeText={setSecretKey}
                secureTextEntry={showSecret ? false : true}
                textContentType="none"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowSecret(p => !p)}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text style={s.inputIcon}>{showSecret ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── 앱 키 저장 ── */}
          <TouchableOpacity
            style={s.checkRow}
            onPress={() => setSaveKey(p => !p)}
            activeOpacity={0.7}>
            <View style={[s.checkbox, saveKey && s.checkboxOn]}>
              {saveKey && <Text style={s.checkMark}>✓</Text>}
            </View>
            <Text style={s.checkLabel}>앱 키 저장 (다음 실행 시 자동 입력)</Text>
          </TouchableOpacity>

          {/* ── 안내 배너 ── */}
          <View style={s.infoBanner}>
            <View style={s.infoDot}>
              <Text style={s.infoDotText}>i</Text>
            </View>
            <Text style={s.infoText}>
              앱 키·시크릿 키는{' '}
              <Text style={s.infoTextBold}>LS증권 개발자센터</Text>
              에서 발급받을 수 있습니다. 키 정보는 이 기기에만 저장됩니다.
            </Text>
          </View>

          {/* ── 연결 시작 버튼 ── */}
          <TouchableOpacity
            style={[s.connectBtn, !isReady && s.connectBtnDisabled]}
            onPress={handleConnect}
            disabled={!isReady || loading}
            activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#FFFFFF" size="small"/>
              : <Text style={[s.connectBtnText, !isReady && s.connectBtnTextDisabled]}>
                  연결 시작
                </Text>
            }
          </TouchableOpacity>

          {/* ── 보조 버튼 3개 ── */}
          <View style={s.subBtnRow}>
            {['키 발급 안내', '계좌 개설', '도움말'].map(label => (
              <TouchableOpacity key={label} style={s.subBtn} activeOpacity={0.7}>
                <Text style={s.subBtnText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── 푸터 ── */}
          <Text style={s.footer}>
            본 앱은 LS증권 Open API를 사용합니다.{'\n'}
            선물·옵션 거래는 원금 손실 위험이 있습니다.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const C = {
  pageBg:      '#F4F6FB',
  navy:        '#1A2A6C',
  border:      '#CDD3E8',
  fieldBg:     '#FFFFFF',
  labelColor:  '#1A2A6C',
  subText:     '#7A86A8',
  infoBg:      '#EEF0FA',
  infoBorder:  '#C8CEED',
  infoText:    '#2D3D80',
  footer:      '#9AA3BE',
  disabledBg:  '#C8CEED',
  disabledText:'#8A96B3',
};

const s = StyleSheet.create({
  container:   {flex: 1, backgroundColor: C.pageBg},
  scroll:      {flexGrow: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 36},

  headerWrap:  {alignItems: 'center', marginBottom: 32},
  iconWrap:    {width: 72, height: 72, borderRadius: 20, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', marginBottom: 16},
  iconText:    {color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: -1},
  title:       {fontSize: 22, fontWeight: '900', color: C.navy, letterSpacing: -0.5, marginBottom: 6},
  subtitle:    {fontSize: 13, color: C.subText, fontWeight: '500'},

  tabWrap:     {flexDirection: 'row', backgroundColor: '#E4E8F4', borderRadius: 12, padding: 4, marginBottom: 28},
  tabBtn:      {flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center'},
  tabBtnActive:{backgroundColor: C.navy},
  tabText:     {fontSize: 14, fontWeight: '600', color: C.subText},
  tabTextActive:{color: '#FFFFFF', fontWeight: '800'},

  fieldWrap:   {marginBottom: 18},
  fieldLabel:  {fontSize: 13, fontWeight: '800', color: C.labelColor, marginBottom: 8},
  inputRow:    {flexDirection: 'row', alignItems: 'center', backgroundColor: C.fieldBg, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 16, paddingVertical: 2},
  input:       {flex: 1, fontSize: 14, fontWeight: '500', color: C.navy, paddingVertical: 13},
  inputIcon:   {fontSize: 16, opacity: 0.45},

  checkRow:    {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18},
  checkbox:    {width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.fieldBg, alignItems: 'center', justifyContent: 'center'},
  checkboxOn:  {backgroundColor: C.navy, borderColor: C.navy},
  checkMark:   {color: '#FFFFFF', fontSize: 11, fontWeight: '900'},
  checkLabel:  {fontSize: 13, fontWeight: '500', color: C.subText},

  infoBanner:  {flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.infoBg, borderWidth: 1, borderLeftWidth: 3, borderColor: C.infoBorder, borderLeftColor: C.navy, borderRadius: 10, padding: 14, marginBottom: 28},
  infoDot:     {width: 16, height: 16, borderRadius: 8, backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0},
  infoDotText: {color: '#FFFFFF', fontSize: 10, fontWeight: '900'},
  infoText:    {flex: 1, fontSize: 12.5, fontWeight: '500', color: C.infoText, lineHeight: 19},
  infoTextBold:{fontWeight: '800'},

  connectBtn:         {backgroundColor: C.navy, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 14},
  connectBtnDisabled: {backgroundColor: C.disabledBg},
  connectBtnText:     {color: '#FFFFFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3},
  connectBtnTextDisabled: {color: C.disabledText},

  subBtnRow:   {flexDirection: 'row', gap: 8, marginBottom: 32},
  subBtn:      {flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.fieldBg, alignItems: 'center'},
  subBtnText:  {fontSize: 12.5, fontWeight: '700', color: '#2D3D80'},

  footer:      {textAlign: 'center', fontSize: 11.5, fontWeight: '500', color: C.footer, lineHeight: 19},
});

export default LoginScreen;