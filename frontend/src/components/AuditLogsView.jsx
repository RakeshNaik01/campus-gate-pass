import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import { fetchGateLogs, fetchSyncQueue, flushSyncQueue } from '../services/api';

export default function AuditLogsView() {
  const [logsList, setLogsList] = useState([]);
  const [syncQueue, setSyncQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  useEffect(() => {
    loadAuditData();
    const interval = setInterval(loadAuditData, 3000);
    return () => clearInterval(interval);
  }, []);

  const loadAuditData = async () => {
    try {
      const [logs, queue] = await Promise.all([fetchGateLogs(), fetchSyncQueue()]);
      setLogsList(logs);
      setSyncQueue(queue);
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualRefresh = async () => {
    setIsLoading(true);
    setFeedbackMsg('');
    await loadAuditData();
    setIsLoading(false);
  };

  const handleFlushOfflineQueue = async () => {
    setIsFlushing(true);
    setFeedbackMsg('');
    try {
      const res = await flushSyncQueue();
      setFeedbackMsg(`✓ Dispatched & synced ${res.flushed_count} offline notification(s)`);
      await loadAuditData();
    } catch (e) {
      setFeedbackMsg('✕ Failed to flush queue');
    } finally {
      setIsFlushing(false);
    }
  };

  const pendingCount = syncQueue.filter((q) => q.sync_status === 'PENDING').length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>📋 SECTION 3: REAL-TIME AUDIT LOGS</Text>
          <Text style={styles.subtitle}>
            {logsList.length} Total Gate Entries • {pendingCount} Pending Cloud Sync
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.flushBtn, pendingCount > 0 && styles.flushBtnActive]}
            onPress={handleFlushOfflineQueue}
            disabled={isFlushing || pendingCount === 0}
          >
            {isFlushing ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.flushBtnText}>⚡ Sync Offline ({pendingCount})</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleManualRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.refreshBtnText}>🔄 Refresh Table</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {feedbackMsg ? <Text style={styles.feedbackBanner}>{feedbackMsg}</Text> : null}

      {/* Tabular Header */}
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.thCell, styles.thTime]}>TIMESTAMP</Text>
        <Text style={[styles.thCell, styles.thHtn]}>HALL TICKET</Text>
        <Text style={[styles.thCell, styles.thName]}>NAME & ROLE</Text>
        <Text style={[styles.thCell, styles.thType]}>SCAN TYPE</Text>
        <Text style={[styles.thCell, styles.thStatus]}>STATUS & SYNC</Text>
      </View>

      {/* Tabular Logs List */}
      {logsList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🛡️</Text>
          <Text style={styles.emptyTitle}>No Gate Scans Recorded Yet</Text>
          <Text style={styles.emptySub}>
            Scan a student ID or QR code in Section 1 to generate live audit logs.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.tableBody} contentContainerStyle={styles.tableBodyContent}>
          {logsList.map((log) => {
            const isVerified = log.status === 'VERIFIED';
            const isLecturer = log.role === 'LECTURER' || log.role === 'FACULTY';
            const isSynced = log.sync_status === 'SYNCED';
            const isPending = log.sync_status === 'PENDING';

            return (
              <View
                key={log.id}
                style={[
                  styles.tableRow,
                  {
                    borderLeftColor: isVerified ? colors.emerald.base : colors.crimson.base,
                  },
                ]}
              >
                {/* Timestamp */}
                <View style={[styles.tdCell, styles.thTime]}>
                  <Text style={styles.timeText}>{log.timestamp ? log.timestamp.split(' ')[1] : 'N/A'}</Text>
                  <Text style={styles.dateText}>{log.timestamp ? log.timestamp.split(' ')[0] : ''}</Text>
                </View>

                {/* Hall Ticket Number */}
                <View style={[styles.tdCell, styles.thHtn]}>
                  <Text style={styles.htnText}>{log.hall_ticket_number || 'N/A'}</Text>
                </View>

                {/* Name & Role */}
                <View style={[styles.tdCell, styles.thName]}>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {log.name}
                  </Text>
                  <View
                    style={[
                      styles.rolePill,
                      {
                        backgroundColor: isLecturer
                          ? 'rgba(168, 85, 247, 0.2)'
                          : 'rgba(59, 130, 246, 0.2)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rolePillText,
                        { color: isLecturer ? '#C084FC' : colors.primaryLight },
                      ]}
                    >
                      {log.role || 'STUDENT'}
                    </Text>
                  </View>
                </View>

                {/* Scan Type */}
                <View style={[styles.tdCell, styles.thType]}>
                  <Text style={styles.scanTypeText}>{log.scan_type || 'Card OCR'}</Text>
                </View>

                {/* Status & Sync Badge */}
                <View style={[styles.tdCell, styles.thStatus]}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: isVerified
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(239, 68, 68, 0.2)',
                        borderColor: isVerified ? colors.emerald.light : colors.crimson.light,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        { color: isVerified ? colors.emerald.light : colors.crimson.light },
                      ]}
                    >
                      {log.status}
                    </Text>
                  </View>

                  {/* Sync Indicator */}
                  <View style={styles.syncIndicatorRow}>
                    <View
                      style={[
                        styles.syncDot,
                        {
                          backgroundColor: isSynced
                            ? colors.emerald.light
                            : isPending
                            ? colors.warning
                            : colors.textMuted,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.syncText,
                        {
                          color: isSynced
                            ? colors.emerald.light
                            : isPending
                            ? colors.warning
                            : colors.textMuted,
                        },
                      ]}
                    >
                      {isSynced
                        ? 'Synced'
                        : isPending
                        ? 'Offline Pending'
                        : 'Local'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  flushBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flushBtnActive: {
    backgroundColor: 'rgba(234, 179, 8, 0.2)',
    borderColor: colors.warning,
  },
  flushBtnText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  feedbackBanner: {
    color: colors.emerald.light,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 6,
  },
  thCell: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  thTime: { flex: 1.2 },
  thHtn: { flex: 1.3 },
  thName: { flex: 2 },
  thType: { flex: 1.1 },
  thStatus: { flex: 1.5, alignItems: 'flex-end' },
  tableBody: {
    flex: 1,
  },
  tableBodyContent: {
    gap: 6,
    paddingBottom: 24,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
  },
  tdCell: {
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dateText: {
    fontSize: 9,
    color: colors.textMuted,
  },
  htnText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryLight,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  nameText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 2,
  },
  rolePillText: {
    fontSize: 8,
    fontWeight: '900',
  },
  scanTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  syncIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncText: {
    fontSize: 8,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
  },
});
