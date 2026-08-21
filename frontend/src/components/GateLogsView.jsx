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
import { fetchGateLogs, resetDatabase } from '../services/api';

export default function GateLogsView({ onReseedSuccess }) {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGateLogs();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleResetDb = async () => {
    setIsLoading(true);
    await resetDatabase();
    await loadLogs();
    if (onReseedSuccess) onReseedSuccess();
  };

  return (
    <View style={styles.container}>
      {/* Action Bar */}
      <View style={styles.actionBar}>
        <View>
          <Text style={styles.title}>📋 LIVE GATE ACCESS AUDIT</Text>
          <Text style={styles.subtitle}>
            {logs.length} scan records captured
          </Text>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadLogs}
            disabled={isLoading}
          >
            <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={handleResetDb}
            disabled={isLoading}
          >
            <Text style={styles.resetBtnText}>🧹 Reseed DB</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logs Scroll List */}
      {isLoading && logs.length === 0 ? (
        <ActivityIndicator color={colors.primaryLight} style={{ marginTop: 40 }} />
      ) : logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛡️</Text>
          <Text style={styles.emptyTitle}>No Gate Scans Recorded Yet</Text>
          <Text style={styles.emptySub}>
            Scan a QR code or Physical ID card in Scanner View to populate live records.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {logs.map((log, idx) => {
            const isVerified = log.status === 'VERIFIED';
            return (
              <View
                key={idx}
                style={[
                  styles.logCard,
                  {
                    borderColor: isVerified
                      ? colors.emerald.dark
                      : colors.crimson.dark,
                  },
                ]}
              >
                <View style={styles.logHeader}>
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
                    <Text style={styles.statusText}>
                      {isVerified ? 'VERIFIED' : 'NOT VERIFIED'}
                    </Text>
                  </View>
                  <Text style={styles.timestampText}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </Text>
                </View>

                <View style={styles.logBody}>
                  <Text style={styles.userName}>{log.name}</Text>
                  <Text style={styles.userRole}>
                    ROLE: {log.role || 'UNKNOWN'}
                  </Text>
                  <Text style={styles.reasonText}>{log.reason}</Text>
                </View>

                <Text style={styles.payloadSnippet}>
                  Payload: {log.payload_snippet}
                </Text>
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
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  refreshBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshBtnText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  resetBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
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
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
    paddingBottom: 20,
  },
  logCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  timestampText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  logBody: {
    marginBottom: 6,
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  userRole: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.roleStudent,
    marginTop: 2,
  },
  reasonText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  payloadSnippet: {
    fontSize: 10,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 280,
  },
});
