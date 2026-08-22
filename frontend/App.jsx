import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { colors } from './src/theme/colors';
import ScannerView from './src/components/ScannerView';
import DatabaseManagementView from './src/components/DatabaseManagementView';
import AuditLogsView from './src/components/AuditLogsView';
import VerificationOverlay from './src/components/VerificationOverlay';
import MobileRemoteLensView from './src/components/MobileRemoteLensView';
import {
  verifyGateEntry,
  getClientModePreference,
  setClientModePreference,
  flushSyncQueue,
} from './src/services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('SECTION_1'); // 'SECTION_1' | 'SECTION_2' | 'SECTION_3'
  const [verificationResult, setVerificationResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
  const [remoteSessionId, setRemoteSessionId] = useState(null);

  // Explicit Manual Mode: 'ONLINE' or 'OFFLINE'
  const [appMode, setAppMode] = useState(getClientModePreference());
  const [modeBannerMsg, setModeBannerMsg] = useState(null);

  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    // Check if opened as mobile remote companion
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const sessionParam = params.get('session');
      if (sessionParam) {
        setRemoteSessionId(sessionParam);
      }
    }

    // PWA Install Prompt Listener
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsInstallable(true);
      });
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const handleSetMode = async (selectedMode) => {
    if (appMode === selectedMode) return;

    setAppMode(selectedMode);
    setClientModePreference(selectedMode);

    if (selectedMode === 'ONLINE') {
      setModeBannerMsg('🟢 ONLINE MODE ACTIVATED: Live Cloud Verification & Twilio SMS/Email Dispatchers Active');
      try {
        await flushSyncQueue();
      } catch (e) {}
    } else {
      setModeBannerMsg('🟠 OFFLINE MODE ACTIVATED: Running 100% on Phone Storage (Zero Internet/Laptop Needed)');
    }

    setTimeout(() => {
      setModeBannerMsg(null);
    }, 4500);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallGuide(true);
    }
  };

  const handleVerify = async (payload) => {
    if (isProcessing || !payload) return;
    setIsProcessing(true);
    try {
      const result = await verifyGateEntry(payload);
      setVerificationResult(result);
    } catch (err) {
      setVerificationResult({
        status: 'NOT VERIFIED',
        name: 'System Error',
        course: 'GATE_TERMINAL',
        hall_ticket_number: 'N/A',
        adm_no: 'N/A',
        reason: err.message || 'Verification Error',
        notification_status: 'FAILED',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismissOverlay = () => {
    setVerificationResult(null);
  };

  // If opened on phone with ?session=...
  if (remoteSessionId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#090D16" />
        <MobileRemoteLensView
          sessionId={remoteSessionId}
          onBackToStation={() => {
            if (typeof window !== 'undefined') {
              window.history.pushState({}, document.title, window.location.pathname);
            }
            setRemoteSessionId(null);
          }}
        />
      </SafeAreaView>
    );
  }

  const handleTestScanAtGate = (payload) => {
    setActiveTab('SECTION_1');
    setTimeout(() => {
      handleVerify(payload);
    }, 200);
  };

  const isOnlineMode = appMode === 'ONLINE';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topHeader}>
          <View style={styles.brandingRow}>
            <View style={styles.campusBadge}>
              <Text style={styles.campusBadgeText}>CAMPUS GATEWAY</Text>
            </View>
            <Text style={styles.systemTitle}>Security Access Terminal</Text>
          </View>

          <View style={styles.headerRightRow}>
            {/* Install App Button */}
            <TouchableOpacity
              style={styles.installBtn}
              activeOpacity={0.8}
              onPress={handleInstallClick}
            >
              <Text style={styles.installBtnText}>📲 INSTALL APP</Text>
            </TouchableOpacity>

            {/* Digital Clock */}
            <View style={styles.clockBadge}>
              <Text style={styles.clockText}>{currentTime}</Text>
            </View>
          </View>
        </View>

        {/* EXPLICIT 2-BUTTON MANUAL MODE SWITCHER BAR */}
        <View style={styles.modeControlBar}>
          <Text style={styles.modeBarLabel}>MANUAL MODE SELECTOR:</Text>
          <View style={styles.modeButtonGroup}>
            <TouchableOpacity
              style={[
                styles.modeOptionBtn,
                isOnlineMode ? styles.modeOptionBtnOnlineActive : styles.modeOptionBtnInactive,
              ]}
              activeOpacity={0.85}
              onPress={() => handleSetMode('ONLINE')}
            >
              <View
                style={[
                  styles.modeDotIndicator,
                  { backgroundColor: isOnlineMode ? '#10B981' : '#64748B' },
                ]}
              />
              <Text
                style={[
                  styles.modeOptionText,
                  isOnlineMode ? styles.modeOptionTextOnlineActive : styles.modeOptionTextInactive,
                ]}
              >
                🟢 ONLINE (CLOUD)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modeOptionBtn,
                !isOnlineMode ? styles.modeOptionBtnOfflineActive : styles.modeOptionBtnInactive,
              ]}
              activeOpacity={0.85}
              onPress={() => handleSetMode('OFFLINE')}
            >
              <View
                style={[
                  styles.modeDotIndicator,
                  { backgroundColor: !isOnlineMode ? '#F59E0B' : '#64748B' },
                ]}
              />
              <Text
                style={[
                  styles.modeOptionText,
                  !isOnlineMode ? styles.modeOptionTextOfflineActive : styles.modeOptionTextInactive,
                ]}
              >
                🟠 OFFLINE (LOCAL)
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Operational Mode Feedback Notification Banner */}
        {modeBannerMsg && (
          <View
            style={[
              styles.modeBanner,
              isOnlineMode ? styles.modeBannerOnline : styles.modeBannerOffline,
            ]}
          >
            <Text
              style={[
                styles.modeBannerText,
                isOnlineMode ? styles.modeBannerTextOnline : styles.modeBannerTextOffline,
              ]}
            >
              {modeBannerMsg}
            </Text>
          </View>
        )}

        {/* STRICT 3-SECTION NAVIGATION BAR */}
        <View style={styles.navigationBar}>
          <TouchableOpacity
            style={[styles.navTab, activeTab === 'SECTION_1' && styles.navTabActive]}
            onPress={() => setActiveTab('SECTION_1')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.navTabText,
                activeTab === 'SECTION_1' && styles.navTabTextActive,
              ]}
            >
              📹 1. SCAN & VERIFY
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'SECTION_2' && styles.navTabActive]}
            onPress={() => setActiveTab('SECTION_2')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.navTabText,
                activeTab === 'SECTION_2' && styles.navTabTextActive,
              ]}
            >
              🗄️ 2. DATABASE & EVENTS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navTab, activeTab === 'SECTION_3' && styles.navTabActive]}
            onPress={() => setActiveTab('SECTION_3')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.navTabText,
                activeTab === 'SECTION_3' && styles.navTabTextActive,
              ]}
            >
              📋 3. AUDIT LOGS
            </Text>
          </TouchableOpacity>
        </View>

        {/* VIEWPORT BODY */}
        <View style={styles.bodyContent}>
          {activeTab === 'SECTION_1' && (
            <ScannerView
              onVerify={handleVerify}
              isProcessing={isProcessing}
              appMode={appMode}
              onSetMode={handleSetMode}
            />
          )}

          {activeTab === 'SECTION_2' && (
            <DatabaseManagementView onTestScanAtGate={handleTestScanAtGate} />
          )}

          {activeTab === 'SECTION_3' && <AuditLogsView />}
        </View>

        {/* Full-Screen Verification Interception Overlay */}
        <VerificationOverlay
          result={verificationResult}
          onDismiss={handleDismissOverlay}
        />

        {/* Install Guide Modal for iOS / Web */}
        {showInstallGuide && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>📱 Install GatePass on Mobile</Text>
              <Text style={styles.modalSub}>
                Install this app to your home screen for full-screen camera scanning and instant offline access:
              </Text>

              <View style={styles.instructionStep}>
                <Text style={styles.stepNum}>1</Text>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>On Android (Chrome):</Text>
                  <Text style={styles.stepText}>
                    Tap the 3 dots (⋮) in the browser menu ➔ select <Text style={styles.bold}>"Install App"</Text> or <Text style={styles.bold}>"Add to Home Screen"</Text>.
                  </Text>
                </View>
              </View>

              <View style={styles.instructionStep}>
                <Text style={styles.stepNum}>2</Text>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>On iPhone (Safari):</Text>
                  <Text style={styles.stepText}>
                    Tap the Share icon (<Text style={styles.bold}>📤</Text>) at the bottom ➔ scroll down and tap <Text style={styles.bold}>"Add to Home Screen"</Text>.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowInstallGuide(false)}
              >
                <Text style={styles.modalCloseBtnText}>GOT IT</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHeader: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  campusBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  campusBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  systemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  installBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  installBtnText: {
    color: colors.primaryLight,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  clockBadge: {
    backgroundColor: colors.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clockText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  modeControlBar: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexWrap: 'wrap',
    gap: 6,
  },
  modeBarLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  modeButtonGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  modeOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 5,
  },
  modeOptionBtnOnlineActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10B981',
  },
  modeOptionBtnOfflineActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B',
  },
  modeOptionBtnInactive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    opacity: 0.6,
  },
  modeDotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modeOptionText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modeOptionTextOnlineActive: {
    color: '#34D399',
    fontWeight: '900',
  },
  modeOptionTextOfflineActive: {
    color: '#FBBF24',
    fontWeight: '900',
  },
  modeOptionTextInactive: {
    color: colors.textMuted,
  },
  modeBanner: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  modeBannerOnline: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderBottomColor: colors.emerald.light,
  },
  modeBannerOffline: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderBottomColor: '#F59E0B',
  },
  modeBannerText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  modeBannerTextOnline: {
    color: colors.emerald.light,
  },
  modeBannerTextOffline: {
    color: '#FCD34D',
  },
  navigationBar: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    padding: 6,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
  },
  navTabActive: {
    backgroundColor: colors.primary,
  },
  navTabText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  navTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  bodyContent: {
    flex: 1,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 16,
  },
  instructionStep: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
    backgroundColor: colors.surface,
    padding: 12,
    borderRadius: 10,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 24,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: colors.primaryLight,
    fontWeight: '800',
    fontSize: 12,
    marginBottom: 2,
  },
  stepText: {
    color: colors.textPrimary,
    fontSize: 11,
    lineHeight: 16,
  },
  bold: {
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
});
