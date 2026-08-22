import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors } from '../theme/colors';
import { extractCardNumberFromText } from '../services/ocr';
import { getNetworkStatus, toggleNetworkStatus } from '../services/api';
import WebCameraStream from './WebCameraStream';
import MobileCameraModal from './MobileCameraModal';

export default function ScannerView({ onVerify, isProcessing, appMode = 'ONLINE', onSetMode }) {
  const [scanMode, setScanMode] = useState('QR'); // 'QR' or 'OCR'
  const [manualInput, setManualInput] = useState('');
  const [scannedRecent, setScannedRecent] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  const isOnlineMode = appMode === 'ONLINE';

  const handleScanPayload = (data) => {
    if (scannedRecent || isProcessing || !data) return;
    setScannedRecent(true);
    onVerify(data);
    setTimeout(() => setScannedRecent(false), 3200);
  };

  const handleOcrSubmit = (textToProcess) => {
    const targetText = textToProcess || manualInput;
    if (!targetText.trim() || isProcessing) return;
    
    const extracted = extractCardNumberFromText(targetText);
    handleScanPayload(extracted || targetText.trim());
    setManualInput('');
  };

  const presetTestCases = [
    { label: '🎓 Vaagdevi ID: Rakesh (25-5-117)', value: '25-5-117', type: 'DEMO' },
    { label: '🧑‍🎓 Aarav Sharma (086256001)', value: '086256001', type: 'QR' },
    { label: '💳 Priya Patel (25-5-102)', value: '25-5-102', type: 'OCR' },
    { label: '👩‍🏫 Dr. Meera (Dean / Lecturer)', value: 'FAC-25-01', type: 'OCR' },
    { label: '🚫 Vikram Malhotra (Suspended)', value: '25-5-105', type: 'SUSPENDED' },
    { label: '❓ Unrecognized Card', value: '99-9-999', type: 'UNREG' },
  ];

  return (
    <View style={styles.container}>
      {/* Explicit 2-Button Manual Mode Selector Bar */}
      <View style={styles.networkBanner}>
        <View style={styles.netInfo}>
          <Text style={styles.netText}>
            GATE MODE: {isOnlineMode ? '🟢 ONLINE (Cloud Sync)' : '🟠 OFFLINE (Phone Memory)'}
          </Text>
        </View>

        <View style={styles.bannerBtnGroup}>
          <TouchableOpacity
            style={[
              styles.choiceBtn,
              isOnlineMode ? styles.choiceBtnOnlineActive : styles.choiceBtnInactive,
            ]}
            onPress={() => onSetMode && onSetMode('ONLINE')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.choiceBtnText,
                isOnlineMode ? styles.choiceBtnTextOnline : styles.choiceBtnTextInactive,
              ]}
            >
              🟢 ONLINE
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.choiceBtn,
              !isOnlineMode ? styles.choiceBtnOfflineActive : styles.choiceBtnInactive,
            ]}
            onPress={() => onSetMode && onSetMode('OFFLINE')}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.choiceBtnText,
                !isOnlineMode ? styles.choiceBtnTextOffline : styles.choiceBtnTextInactive,
              ]}
            >
              🟠 OFFLINE
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Mode Switcher: "Scan QR Code" vs "Scan Physical ID Card (OCR)" */}
      <View style={styles.modeSwitcher}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.modeTab, scanMode === 'QR' && styles.modeTabActive]}
          onPress={() => setScanMode('QR')}
        >
          <Text style={[styles.modeTabText, scanMode === 'QR' && styles.modeTabTextActive]}>
            📱 SCAN QR CODE
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.modeTab, scanMode === 'OCR' && styles.modeTabActive]}
          onPress={() => setScanMode('OCR')}
        >
          <Text style={[styles.modeTabText, scanMode === 'OCR' && styles.modeTabTextActive]}>
            💳 SCAN PHYSICAL ID CARD (OCR)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.modeTab, styles.modeTabMobile]}
          onPress={() => setIsMobileModalOpen(true)}
        >
          <Text style={styles.modeTabMobileText}>
            📱 MOBILE LENS
          </Text>
        </TouchableOpacity>
      </View>

      {/* Main Camera Viewport */}
      <View style={styles.viewportContainer}>
        {Platform.OS === 'web' ? (
          /* Laptop Webcam & Web Camera Stream */
          <WebCameraStream
            onScanDetected={handleScanPayload}
            isLocked={isProcessing || scannedRecent}
            scanMode={scanMode}
          />
        ) : (
          /* Native Mobile Smartphone expo-camera Stream */
          <View style={styles.nativeCameraBox}>
            {permission && permission.granted ? (
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['qr'],
                }}
                onBarcodeScanned={scannedRecent ? undefined : ({ data }) => handleScanPayload(data)}
              />
            ) : (
              <View style={styles.permissionBox}>
                <Text style={styles.permissionTitle}>Camera Permission Required</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                  <Text style={styles.permissionBtnText}>Enable Native Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Manual Input Search Keypad */}
      <View style={styles.ocrInputCard}>
        <View style={styles.ocrInputRow}>
          <TextInput
            style={styles.ocrTextInput}
            placeholder={
              scanMode === 'QR'
                ? 'Type/Scan Hall Ticket Number (e.g. 086256008)...'
                : 'Type/Scan Admission Number (e.g. 25-5-117)...'
            }
            placeholderTextColor={colors.textMuted}
            value={manualInput}
            onChangeText={setManualInput}
          />
          <TouchableOpacity
            style={styles.ocrProcessBtn}
            onPress={() => handleOcrSubmit()}
            disabled={isProcessing || !manualInput.trim()}
          >
            {isProcessing ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ocrProcessBtnText}>VERIFY</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Gate Simulation Presets */}
      <View style={styles.testPanel}>
        <View style={styles.testHeaderRow}>
          <Text style={styles.testPanelTitle}>⚡ QUICK TEST PRESETS</Text>
          <Text style={styles.testPanelSub}>Tap to simulate instant gate scan</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.testScroll}
        >
          {presetTestCases.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.testCardButton,
                item.type === 'DEMO' && styles.testCardButtonDemo,
              ]}
              activeOpacity={0.7}
              onPress={() => handleOcrSubmit(item.value)}
              disabled={isProcessing}
            >
              <Text
                style={[
                  styles.testButtonLabel,
                  item.type === 'DEMO' && styles.testButtonLabelDemo,
                ]}
              >
                {item.label}
              </Text>
              <Text style={styles.testButtonValue}>{item.value}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Mobile Remote Scanner Modal */}
      <MobileCameraModal
        visible={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
        onVerificationSuccess={(payload) => {
          setIsMobileModalOpen(false);
          handleScanPayload(payload);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  networkBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  netInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  netDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  netText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  bannerBtnGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  choiceBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  choiceBtnOnlineActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10B981',
  },
  choiceBtnOfflineActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B',
  },
  choiceBtnInactive: {
    backgroundColor: '#0F172A',
    borderColor: colors.border,
    opacity: 0.5,
  },
  choiceBtnText: {
    fontSize: 9,
    fontWeight: '800',
  },
  choiceBtnTextOnline: {
    color: '#34D399',
    fontWeight: '900',
  },
  choiceBtnTextOffline: {
    color: '#FBBF24',
    fontWeight: '900',
  },
  choiceBtnTextInactive: {
    color: colors.textMuted,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: colors.primary,
  },
  modeTabText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  modeTabTextActive: {
    color: '#FFFFFF',
  },
  modeTabMobile: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  modeTabMobileText: {
    fontSize: 10,
    fontWeight: '900',
    color: colors.primaryLight,
  },
  viewportContainer: {
    flex: 1,
    minHeight: 380,
    backgroundColor: '#090D16',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeCameraBox: {
    width: '100%',
    height: '100%',
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  permissionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
  },
  ocrInputCard: {
    marginTop: 10,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ocrInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ocrTextInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 11,
  },
  ocrProcessBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  ocrProcessBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  testPanel: {
    marginTop: 10,
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  testHeaderRow: {
    marginBottom: 6,
  },
  testPanelTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.warningLight,
    letterSpacing: 0.5,
  },
  testPanelSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  testScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  testCardButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  testCardButtonDemo: {
    borderColor: colors.emerald.light,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  testButtonLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  testButtonLabelDemo: {
    color: colors.emerald.light,
    fontWeight: '900',
  },
  testButtonValue: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});
