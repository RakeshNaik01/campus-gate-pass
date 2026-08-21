import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';

const { width, height } = Dimensions.get('window');

/**
 * High-Visibility Verification Overlay
 * - ACTIVE: Full-screen Emerald Green (#059669) + "ACCESS GRANTED – NOTIFICATION DISPATCHED" + 3s Auto-reset
 * - SUSPENDED / INACTIVE / DENIED: Full-screen Crimson Red (#DC2626) + Failure Reason + Manual Guard Tap Dismiss
 */
export default function VerificationOverlay({ result, onDismiss }) {
  if (!result) return null;

  const isVerified = result.status === 'VERIFIED';
  const reasonText = (result.reason || '').toLowerCase();
  const isSuspended = reasonText.includes('suspended');
  const isInactive = reasonText.includes('inactive');

  const progressAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(1)).current;

  const [timeLeft, setTimeLeft] = useState(3);

  useEffect(() => {
    // Entrance bounce
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: Platform.OS !== 'web',
    }).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    ).start();

    if (isVerified) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 0.4, duration: 400, useNativeDriver: false }),
          Animated.timing(flashAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        ])
      ).start();

      // 3-second animated auto-reset countdown
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 3000,
        useNativeDriver: false,
      }).start();

      const timerInterval = setInterval(() => {
        setTimeLeft((prev) => (prev > 1 ? prev - 1 : 1));
      }, 1000);

      const autoDismissTimeout = setTimeout(() => {
        onDismiss();
      }, 3000);

      return () => {
        clearInterval(timerInterval);
        clearTimeout(autoDismissTimeout);
      };
    }
  }, [isVerified]);

  const bgStyle = isVerified ? styles.verifiedBg : styles.deniedBg;
  const badgeBg = isVerified ? colors.emerald.card : colors.crimson.card;
  const badgeBorder = isVerified ? colors.emerald.accent : colors.crimson.accent;

  const getDenialTitle = () => {
    if (isSuspended) return 'ACCESS DENIED – PROFILE SUSPENDED';
    if (isInactive) return 'ACCESS DENIED – PROFILE INACTIVE';
    return 'ACCESS DENIED – UNRECOGNIZED ID';
  };

  return (
    <View style={[styles.container, bgStyle]}>
      {/* Animated Card Body */}
      <Animated.View
        style={[
          styles.contentCard,
          {
            backgroundColor: badgeBg,
            borderColor: badgeBorder,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Status Icon */}
        <Animated.View style={[styles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.statusIcon}>{isVerified ? '✓' : '✕'}</Text>
        </Animated.View>

        {/* Title Header */}
        <Text
          style={[
            styles.statusTitle,
            !isVerified && styles.statusTitleDenied,
          ]}
        >
          {isVerified ? 'ACCESS GRANTED – NOTIFICATION DISPATCHED' : getDenialTitle()}
        </Text>

        {isVerified && (
          <Animated.View style={[styles.demoFlashBadge, { opacity: flashAnim }]}>
            <Text style={styles.demoFlashText}>⭐ VAAGDEVI COLLEGE LIVE VERIFIED ⭐</Text>
          </Animated.View>
        )}

        <View style={styles.divider} />

        {/* Centered User Verification Variables */}
        <View style={styles.infoSection}>
          <Text style={styles.variableLabel}>STUDENT / HOLDER NAME</Text>
          <Text style={styles.userName}>
            {result.name && result.name !== 'Unknown' ? result.name : 'Unregistered Student'}
          </Text>

          <View style={styles.detailsGrid}>
            <View style={styles.gridItem}>
              <Text style={styles.gridItemLabel}>ADMISSION NUMBER</Text>
              <Text style={styles.gridItemVal}>
                {result.adm_no && result.adm_no !== 'N/A' ? result.adm_no : 'N/A'}
              </Text>
            </View>

            <View style={styles.gridItem}>
              <Text style={styles.gridItemLabel}>SYSTEM HALL TICKET KEY</Text>
              <Text style={styles.gridItemVal}>
                {result.hall_ticket_number && result.hall_ticket_number !== 'N/A' ? result.hall_ticket_number : 'N/A'}
              </Text>
            </View>
          </View>

          <View style={styles.courseCard}>
            <Text style={styles.courseLabel}>COURSE / BATCH</Text>
            <Text style={styles.courseValue}>
              {result.course && result.course !== 'Unknown' ? result.course : 'N/A'}
            </Text>
          </View>

          <View
            style={[
              styles.reasonCard,
              !isVerified && styles.reasonCardDenied,
            ]}
          >
            <Text style={styles.reasonLabel}>
              {isVerified ? 'SECURITY VALIDATION LOG' : 'SECURITY ALERT / REASON'}
            </Text>
            <Text
              style={[
                styles.reasonText,
                !isVerified && styles.reasonTextDenied,
              ]}
            >
              {result.reason}
            </Text>
          </View>
        </View>

        {/* Auto-reset Countdown & Dismiss Controls */}
        {isVerified ? (
          <View style={styles.verifiedFooter}>
            <View style={styles.progressContainer}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.autoDismissText}>
              Live camera stream resuming in {timeLeft}s...
            </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.quickDismissBtn}
              onPress={onDismiss}
            >
              <Text style={styles.quickDismissText}>Resume Camera Now</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.deniedFooter}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.dismissDeniedBtn}
              onPress={onDismiss}
            >
              <Text style={styles.dismissDeniedBtnText}>
                ⚠️ TAP TO DISMISS ACCESS DENIAL (GUARD OVERRIDE)
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 9999,
  },
  verifiedBg: {
    backgroundColor: '#059669', // Emerald Green #059669
  },
  deniedBg: {
    backgroundColor: '#DC2626', // Crimson Red #DC2626
  },
  contentCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 24,
  },
  iconWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusIcon: {
    fontSize: 34,
    color: '#FFFFFF',
    fontWeight: '900',
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusTitleDenied: {
    color: '#FEE2E2',
  },
  demoFlashBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  demoFlashText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginVertical: 12,
  },
  infoSection: {
    width: '100%',
    alignItems: 'center',
  },
  variableLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.75)',
    letterSpacing: 0.8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 10,
  },
  detailsGrid: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
    marginBottom: 8,
  },
  gridItem: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  gridItemLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  gridItemVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  courseCard: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  courseLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  courseValue: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  reasonCard: {
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  reasonCardDenied: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  reasonLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  reasonText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 2,
  },
  reasonTextDenied: {
    color: '#FEE2E2',
    fontWeight: '900',
  },
  verifiedFooter: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  progressContainer: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },
  autoDismissText: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '700',
  },
  quickDismissBtn: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  quickDismissText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  deniedFooter: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  dismissDeniedBtn: {
    width: '100%',
    backgroundColor: '#7F1D1D',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F87171',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  dismissDeniedBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
