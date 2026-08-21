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
import { fetchSyncQueue, flushSyncQueue, fetchGateLogs, resetDatabase } from '../services/api';

export default function OfflineSyncManager({ onReseedSuccess }) {
  const [activeSubTab, setActiveSubTab] = useState('QUEUE'); // 'QUEUE' | 'AUDIT'
  const [syncQueue, setSyncQueue] = useState([]);
  const [gateLogs, setGateLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushMsg, setFlushMsg] = useState('');

  const loadData = async () => {
    try {
      const [qData, lData] = await Promise.all([fetchSyncQueue(), fetchGateLogs()]);
      setSyncQueue(qData);
      setGateLogs(lData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleFlush = async () => {
    setIsFlushing(true);
    setFlushMsg('');
    try {
      const res = await flushSyncQueue();
      setFlushMsg(`Flushed ${res.flushed_count} queued notification(s)!`);
      await loadData();
    } catch (e) {
      setFlushMsg('Failed to flush queue');
    } finally {
      setIsFlushing(false);
    }
  };

  const handleResetDb = async () => {
    setIsLoading(true);
    await resetDatabase();
    await loadData();
    if (onReseedSuccess) onReseedSuccess();
    setIsLoading(false);
  };

  const pendingCount = syncQueue.filter((i) => i.sync_status === 'PENDING').length;

  return (
    <View style={styles.container}>
      {/* Header & Sub-tabs */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>🔄 OFFLINE SYNC QUEUE & AUDIT</Text>
          <Text style={styles.subtitle}>
            {pendingCount} Pending Offline Actions • {syncQueue.length} Total Logs
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.flushBtn, pendingCount > 0 && styles.flushBtnActive]}
            onPress={handleFlush}
            disabled={isFlushing}
          >
            {isFlushing ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.flushBtnText}>⚡ Flush Queue</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetBtn} onPress={handleResetDb}>
            <Text style={styles.resetBtnText}>🧹 Reseed</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Subtab Toggle */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'QUEUE' && styles.subTabActive]}
          onPress={() => setActiveSubTab('QUEUE')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'QUEUE' && styles.subTabTextActive]}>
            📦 OFFLINE SYNC QUEUE ({pendingCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'AUDIT' && styles.subTabActive]}
          onPress={() => setActiveSubTab('AUDIT')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'AUDIT' && styles.subTabTextActive]}>
            📋 GATE ACCESS LOGS ({gateLogs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {flushMsg ? <Text style={styles.feedbackMsg}>{flushMsg}</Text> : null}

      {/* Content */}
      {activeSubTab === 'QUEUE' ? (
        syncQueue.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyTitle}>Sync Queue Is Empty</Text>
            <Text style={styles.emptySub}>
              When the station operates in OFFLINE mode, verified entry passes are automatically cached here until network connectivity resumes.
            </Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {syncQueue.map((item) => {
              const isPending = item.sync_status === 'PENDING';
              return (
                <View
                  key={item.id}
                  style={[
                    styles.syncCard,
                    {
                      borderColor: isPending
                        ? colors.warning
                        : colors.emerald.dark,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isPending
                            ? colors.warning
                            : colors.emerald.base,
                        },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {item.sync_status === 'PENDING' ? '⏳ PENDING CLOUD SYNC' : '✅ SYNCED TO CLOUD'}
                      </Text>
                    </View>
                    <Text style={styles.timestampText}>
                      {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'N/A'}
                    </Text>
                  </View>

                  <Text style={styles.studentName}>{item.student_name || 'Student'}</Text>
                  <Text style={styles.idInfo}>
                    HTN: {item.hall_ticket_number} • ADM: {item.adm_no || 'N/A'}
                  </Text>
                  {item.message ? (
                    <Text style={styles.messageSnippet}>"{item.message}"</Text>
                  ) : null}
                  {item.dispatched_at && (
                    <Text style={styles.dispatchedAt}>
                      Dispatched At: {new Date(item.dispatched_at).toLocaleString()}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )
      ) : (
        /* Gate Scan Logs View */
        gateLogs.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>No Live Gate Scans Yet</Text>
            <Text style={styles.emptySub}>Perform a scan in the Scanner tab to view live access logs.</Text>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {gateLogs.map((log, idx) => {
              const isVerified = log.status === 'VERIFIED';
              return (
                <View
                  key={idx}
                  style={[
                    styles.syncCard,
                    {
                      borderColor: isVerified
                        ? colors.emerald.dark
                        : colors.crimson.dark,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isVerified
                            ? colors.emerald.base
                            : colors.crimson.base,
                        },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>{log.status}</Text>
                    </View>
                    <Text style={styles.timestampText}>{log.timestamp}</Text>
                  </View>

                  <Text style={styles.studentName}>{log.name}</Text>
                  <Text style={styles.idInfo}>
                    HTN: {log.hall_ticket_number} • ADM: {log.adm_no} • {log.course}
                  </Text>
                  <Text style={styles.reasonText}>{log.reason}</Text>
                  {log.notification_status && (
                    <Text style={styles.notifStatus}>
                      Notification: {log.notification_status}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  flushBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flushBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  flushBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  resetBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.crimson.light,
  },
  resetBtnText: {
    color: colors.crimson.light,
    fontSize: 11,
    fontWeight: '700',
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabActive: {
    backgroundColor: colors.surface,
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  subTabTextActive: {
    color: colors.primaryLight,
  },
  feedbackMsg: {
    color: colors.emerald.light,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 8,
    paddingBottom: 20,
  },
  syncCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  timestampText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  studentName: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  idInfo: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  reasonText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
  },
  notifStatus: {
    fontSize: 10,
    color: colors.primaryLight,
    marginTop: 3,
    fontWeight: '700',
  },
  messageSnippet: {
    fontSize: 10,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  dispatchedAt: {
    fontSize: 9,
    color: colors.emerald.light,
    marginTop: 4,
  },
  emptyBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 40,
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
