import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Animated, ActivityIndicator, Dimensions } from 'react-native';
import { colors } from '../theme/colors';
import {
  getWarmOcrWorker,
  scanFullIdCardImage,
  preprocessCanvasForOcr,
} from '../services/ocr';

const { width: windowWidth } = Dimensions.get('window');

/**
 * Large Wide-Viewfinder ID Card Scanner with Auto-Crop and Hall Ticket Extractor
 * Fits entire physical ID cards naturally with standard ISO ID-1 card aspect ratio (85.6mm x 54mm)
 */
export default function WebCameraStream({ onScanDetected, isLocked, scanMode }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const isAnalyzingRef = useRef(false);

  const [cameraFacing, setCameraFacing] = useState('environment'); // Default to high-res rear lens on mobile
  const [streamActive, setStreamActive] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [hudMessage, setHudMessage] = useState('🪪 FIT ENTIRE ID CARD INSIDE THE GREEN BORDER');
  const [extractedPreview, setExtractedPreview] = useState('');

  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Scanning laser animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const stopExistingStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (targetFacing = cameraFacing) => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;

    stopExistingStream();
    setCameraError('');
    setIsStarting(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera device API not available.');
      }

      // Warm up OCR worker in background
      getWarmOcrWorker().catch(() => {});

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        });
      } catch (err1) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: targetFacing },
            audio: false,
          });
        } catch (err2) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (!stream) throw new Error('No video stream received.');

      streamRef.current = stream;

      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('webkit-playsinline', 'true');
        video.muted = true;
        await video.play();
      }

      setStreamActive(true);
      setCameraFacing(targetFacing);
      setHudMessage('🪪 FIT ENTIRE ID CARD INSIDE THE GREEN BORDER');
    } catch (err) {
      console.warn('[Camera Access Error]:', err);
      setCameraError(err.message || 'Camera permission denied.');
      setStreamActive(false);
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    startCamera(cameraFacing);
    return () => {
      stopExistingStream();
    };
  }, []);

  // CONTINUOUS LARGE-VIEWPORT AUTO-CROP & OCR ANALYSIS LOOP
  useEffect(() => {
    if (isLocked || !streamActive) return;

    let barcodeDetector = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'data_matrix'] });
      } catch (e) {}
    }

    let scanTick = 0;

    const interval = setInterval(async () => {
      if (isLocked || !videoRef.current || videoRef.current.readyState < 2 || isAnalyzingRef.current) {
        return;
      }

      const video = videoRef.current;
      scanTick++;

      // 1. Instant Barcode/QR auto-detect (<15ms)
      if (barcodeDetector) {
        try {
          const barcodes = await barcodeDetector.detect(video);
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            const rawVal = barcodes[0].rawValue;
            setHudMessage('⚡ QR CODE RECOGNIZED • VERIFYING...');
            onScanDetected(rawVal);
            return;
          }
        } catch (e) {}
      }

      // 2. Full-Card Auto-Crop and High-Speed OCR (Runs every ~300ms)
      if (canvasRef.current && scanTick % 2 === 0) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          isAnalyzingRef.current = true;

          // AUTO-CROP LOGIC: Calculate full ID card boundary from the video feed
          const vidW = video.videoWidth;
          const vidH = video.videoHeight;

          // Standard ID Card Aspect Ratio = 1.58 (Width / Height)
          let cropWidth = vidW * 0.90; // Use 90% of camera width for comfortable fitting
          let cropHeight = cropWidth / 1.58;

          if (cropHeight > vidH * 0.85) {
            cropHeight = vidH * 0.85;
            cropWidth = cropHeight * 1.58;
          }

          const startX = (vidW - cropWidth) / 2;
          const startY = (vidH - cropHeight) / 2;

          // Render high-res auto-cropped card on processing canvas
          canvas.width = 720;
          canvas.height = 456;
          ctx.drawImage(video, startX, startY, cropWidth, cropHeight, 0, 0, 720, 456);

          // Apply adaptive edge and contrast filter
          preprocessCanvasForOcr(canvas);

          try {
            setHudMessage('⚡ AUTO-CROPPED ID CARD • EXTRACTING HALL TICKET...');
            
            // Run high-speed OCR on the auto-cropped card
            const ocrData = await scanFullIdCardImage(canvas);
            
            if (ocrData.bestMatch) {
              const matchedKey = ocrData.hallTicket || ocrData.admNo || ocrData.bestMatch;
              setExtractedPreview(`Extracted: ${matchedKey}`);
              setHudMessage(`✓ MATCHED: ${matchedKey} • ACCESS GRANTED!`);
              
              // Automatically freeze and verify!
              onScanDetected(matchedKey);
              isAnalyzingRef.current = false;
              return;
            } else {
              setHudMessage('🪪 ID CARD DETECTED • SCANNING TEXT...');
            }
          } catch (e) {
            // pass
          } finally {
            isAnalyzingRef.current = false;
          }
        }
      }
    }, 150);

    return () => clearInterval(interval);
  }, [isLocked, streamActive, scanMode]);

  const handleToggleCamera = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    startCamera(nextFacing);
  };

  return (
    <View style={styles.webContainer}>
      {/* Live Video Feed */}
      {Platform.OS === 'web' && (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: cameraFacing === 'user' ? 'scaleX(-1)' : 'none',
              backgroundColor: '#000000',
              display: streamActive ? 'block' : 'none',
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
      )}

      {/* Large Full-Size ID Card Target Reticle */}
      {streamActive && (
        <View style={styles.reticleOverlay} pointerEvents="box-none">
          <View style={styles.reticleFrameLarge}>
            {/* Prominent Neon Corners */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Continuous Laser Scanning Beam */}
            {!isLocked && (
              <Animated.View
                style={[
                  styles.scanLaser,
                  {
                    top: scanLineAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            )}

            {/* Auto-Crop Guideline Badge */}
            <View style={styles.autoTargetBadge}>
              <Text style={styles.autoTargetText}>
                📸 LARGE ID CARD FIT • AUTO-CROPS & EXTRACTS HALL TICKET
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Top Floating Controls */}
      <View style={styles.topControlBar}>
        <View style={styles.cameraTypeTag}>
          <View
            style={[
              styles.statusPulse,
              { backgroundColor: streamActive ? colors.emerald.light : colors.crimson.light },
            ]}
          />
          <Text style={styles.cameraTypeText}>
            {cameraFacing === 'environment' ? '📱 REAR HD CAMERA' : '💻 FRONT CAMERA'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.switchCameraBtn}
          activeOpacity={0.8}
          onPress={handleToggleCamera}
        >
          <Text style={styles.switchCameraBtnText}>🔄 Flip Camera</Text>
        </TouchableOpacity>
      </View>

      {/* Real-time Extraction HUD Feedback */}
      {streamActive && (
        <View style={styles.hudStatusBar}>
          <Text style={styles.hudStatusText}>{hudMessage}</Text>
          {extractedPreview ? (
            <Text style={styles.extractedPreviewText}>{extractedPreview}</Text>
          ) : null}
        </View>
      )}

      {/* One-time Camera Activation Overlay */}
      {!streamActive && (
        <View style={styles.startCameraOverlay}>
          <Text style={styles.startCameraIcon}>📷</Text>
          <Text style={styles.startCameraTitle}>Large Viewport ID Scanner</Text>
          <Text style={styles.startCameraSub}>
            Tap once to start wide-view ID card auto-scanning and Hall Ticket extraction:
          </Text>

          <TouchableOpacity
            style={styles.activateBtn}
            activeOpacity={0.85}
            onPress={() => startCamera(cameraFacing)}
            disabled={isStarting}
          >
            {isStarting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.activateBtnText}>▶️ TAP TO START LARGE ID SCANNER</Text>
            )}
          </TouchableOpacity>

          {cameraError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>Notice: {cameraError}</Text>
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  // Large Full-Size ID Card Reticle Box (92% width, standard 1.58:1 card ratio)
  reticleFrameLarge: {
    width: '92%',
    maxWidth: 420,
    aspectRatio: 1.58,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(16, 185, 129, 0.55)',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: colors.emerald.light,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderColor: colors.emerald.light,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 14 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 14 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 14 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 14 },
  scanLaser: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.emerald.accent,
    shadowColor: colors.emerald.light,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 12,
  },
  autoTargetBadge: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  autoTargetText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  topControlBar: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  cameraTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusPulse: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cameraTypeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  switchCameraBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  switchCameraBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  hudStatusBar: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.emerald.light,
    alignItems: 'center',
    zIndex: 10,
    maxWidth: '92%',
  },
  hudStatusText: {
    color: colors.emerald.light,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  extractedPreviewText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  startCameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 5,
  },
  startCameraIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  startCameraTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  startCameraSub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    maxWidth: 290,
  },
  activateBtn: {
    backgroundColor: colors.emerald.base,
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: colors.emerald.light,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  activateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  errorBox: {
    marginTop: 14,
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.crimson.light,
  },
  errorText: {
    color: colors.crimson.light,
    fontSize: 10,
    textAlign: 'center',
  },
});
