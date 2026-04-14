import React, {useState} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, Modal,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RootStackParamList} from '../navigation/RootNavigator';

const NOTICES = [
  {
    id: 1,
    title: 'LS증권 Open API 점검 안내',
    date: '2025.04.10',
    content: '2025년 4월 12일(토) 00:00 ~ 06:00 동안 시스템 점검이 있을 예정입니다. 해당 시간 동안 API 서비스가 일시 중단됩니다.',
  },
  {
    id: 2,
    title: '선물/옵션 자동주문 v1.2 업데이트',
    date: '2025.04.05',
    content: '체결 탭 조회 안정성 개선, 자동화 탭 백그라운드 서비스 버그 수정, 계좌 정보 실시간 연동 기능이 추가되었습니다.',
  },
  {
    id: 3,
    title: '위클리 옵션 만기일 변경 안내',
    date: '2025.03.28',
    content: '위클리 옵션 만기일 관련 일부 조회 오류가 수정되었습니다. 월요일/목요일 만기 구분이 정확히 동작합니다.',
  },
];

const MENU_ITEMS = [
  {icon: '📋', label: '공지사항', type: 'notice'},
  {icon: '📞', label: '고객센터', type: 'cs'},
  {icon: '📄', label: '이용약관', type: 'terms'},
  {icon: '🔒', label: '개인정보처리방침', type: 'privacy'},
  {icon: '🚪', label: '로그아웃', type: 'logout'},
];

const AccountScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [noticeModal, setNoticeModal]       = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<typeof NOTICES[0] | null>(null);

  const handleMenu = (type: string) => {
    if (type === 'notice') {
      setNoticeModal(true);
    } else if (type === 'logout') {
      Alert.alert(
        '로그아웃',
        '로그아웃 하시겠습니까?',
        [
          {text: '취소', style: 'cancel'},
          {
            text: '로그아웃',
            style: 'destructive',
            onPress: () => navigation.reset({index: 0, routes: [{name: 'Login'}]}),
          },
        ],
      );
    } else {
      Alert.alert('준비 중', '곧 오픈 예정입니다.');
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── 헤더 ── */}
        <View style={s.header}>
          <View style={s.avatarWrap}>
            <Text style={s.avatarText}>LS</Text>
          </View>
          <Text style={s.appName}>선물/옵션 자동주문</Text>
          <Text style={s.appSub}>LS증권 Open API 연동</Text>
          <View style={s.versionBadge}>
            <Text style={s.versionText}>v1.2.0</Text>
          </View>
        </View>

        {/* ── 메뉴 리스트 ── */}
        <View style={s.menuSection}>
          {MENU_ITEMS.map((item, idx) => {
            const isLogout = item.type === 'logout';
            const isLast   = idx === MENU_ITEMS.length - 1;
            return (
              <TouchableOpacity
                key={item.type}
                style={[s.menuRow, isLast && s.menuRowLast, isLogout && s.menuRowLogout]}
                onPress={() => handleMenu(item.type)}
                activeOpacity={0.7}>
                <Text style={s.menuIcon}>{item.icon}</Text>
                <Text style={[s.menuLabel, isLogout && s.menuLabelLogout]}>{item.label}</Text>
                {!isLogout && <Text style={s.menuArrow}>›</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.footer}>
          본 앱은 LS증권 Open API를 사용합니다.{'\n'}선물·옵션 거래는 원금 손실 위험이 있습니다.
        </Text>
      </ScrollView>

      {/* ── 공지사항 모달 ── */}
      <Modal
        visible={noticeModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setNoticeModal(false); setSelectedNotice(null); }}>
        <View style={m.overlay}>
          <View style={m.sheet}>
            <View style={m.handle}/>

            {!selectedNotice ? (
              /* 공지사항 목록 */
              <>
                <View style={m.header}>
                  <Text style={m.title}>공지사항</Text>
                  <TouchableOpacity onPress={() => setNoticeModal(false)}>
                    <Text style={m.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {NOTICES.map((notice, idx) => (
                    <TouchableOpacity
                      key={notice.id}
                      style={[m.noticeRow, idx < NOTICES.length - 1 && m.noticeBorder]}
                      onPress={() => setSelectedNotice(notice)}
                      activeOpacity={0.7}>
                      <View style={{flex: 1}}>
                        <Text style={m.noticeTitle}>{notice.title}</Text>
                        <Text style={m.noticeDate}>{notice.date}</Text>
                      </View>
                      <Text style={m.noticeArrow}>›</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              /* 공지사항 상세 */
              <>
                <View style={m.header}>
                  <TouchableOpacity
                    onPress={() => setSelectedNotice(null)}
                    style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                    <Text style={m.backBtn}>‹</Text>
                    <Text style={m.backLabel}>목록</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setNoticeModal(false); setSelectedNotice(null); }}>
                    <Text style={m.closeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={{padding: 20}} showsVerticalScrollIndicator={false}>
                  <Text style={m.detailTitle}>{selectedNotice.title}</Text>
                  <Text style={m.detailDate}>{selectedNotice.date}</Text>
                  <View style={m.detailDivider}/>
                  <Text style={m.detailContent}>{selectedNotice.content}</Text>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container:       {flex: 1, backgroundColor: '#F4F6FB'},
  header:          {alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24},
  avatarWrap:      {width: 72, height: 72, borderRadius: 20, backgroundColor: '#1A2A6C', alignItems: 'center', justifyContent: 'center', marginBottom: 14},
  avatarText:      {color: '#FFF', fontSize: 26, fontWeight: '900', letterSpacing: -1},
  appName:         {fontSize: 18, fontWeight: '900', color: '#1A2A6C', marginBottom: 4},
  appSub:          {fontSize: 13, color: '#7A86A8', marginBottom: 10},
  versionBadge:    {backgroundColor: '#E4E8F4', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4},
  versionText:     {fontSize: 12, fontWeight: '700', color: '#1A2A6C'},
  menuSection:     {marginHorizontal: 16, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E4E8F4', overflow: 'hidden', marginBottom: 24},
  menuRow:         {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F2F8'},
  menuRowLast:     {borderBottomWidth: 0},
  menuRowLogout:   {marginTop: 0},
  menuIcon:        {fontSize: 18, marginRight: 12},
  menuLabel:       {flex: 1, fontSize: 14, fontWeight: '600', color: '#1A2A6C'},
  menuLabelLogout: {color: '#E8001C'},
  menuArrow:       {fontSize: 20, color: '#AAAAAA', fontWeight: '300'},
  footer:          {textAlign: 'center', fontSize: 11.5, color: '#9AA3BE', lineHeight: 19, paddingBottom: 32},
});

const m = StyleSheet.create({
  overlay:       {flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end'},
  sheet:         {backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%'},
  handle:        {width: 36, height: 4, borderRadius: 2, backgroundColor: '#DDD', alignSelf: 'center', marginTop: 12, marginBottom: 4},
  header:        {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0'},
  title:         {fontSize: 17, fontWeight: '800', color: '#111'},
  closeBtn:      {fontSize: 16, color: '#888', fontWeight: '600', padding: 4},
  backBtn:       {fontSize: 28, color: '#1A2A6C', fontWeight: '300', lineHeight: 32},
  backLabel:     {fontSize: 14, color: '#1A2A6C', fontWeight: '600'},
  noticeRow:     {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16},
  noticeBorder:  {borderBottomWidth: 1, borderBottomColor: '#F0F0F0'},
  noticeTitle:   {fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 4},
  noticeDate:    {fontSize: 12, color: '#888'},
  noticeArrow:   {fontSize: 20, color: '#CCC', marginLeft: 8},
  detailTitle:   {fontSize: 16, fontWeight: '800', color: '#111', marginBottom: 6},
  detailDate:    {fontSize: 12, color: '#888', marginBottom: 16},
  detailDivider: {height: 1, backgroundColor: '#F0F0F0', marginBottom: 16},
  detailContent: {fontSize: 14, color: '#333', lineHeight: 22},
});

export default AccountScreen;