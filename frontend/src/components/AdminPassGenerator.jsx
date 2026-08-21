import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import QRCodeRenderer from './QRCodeRenderer';
import { colors } from '../theme/colors';
import {
  fetchUsers,
  fetchEvents,
  generatePermanentQR,
  generateEventQR,
  importStudentRegistry,
} from '../services/api';

export default function AdminPassGenerator({ onTestScanAtGate }) {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [passType, setPassType] = useState('PERMANENT'); // 'PERMANENT' or 'EVENT'
  const [selectedEventId, setSelectedEventId] = useState('');
  const [durationPreset, setDurationPreset] = useState('ACTIVE_NOW');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generatedPass, setGeneratedPass] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uList, eList] = await Promise.all([fetchUsers(), fetchEvents()]);
      setUsers(uList);
      setEvents(eList);
      if (uList.length > 0) setSelectedUser(uList[0]);
      if (eList.length > 0) setSelectedEventId(eList[0].id);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to load users from backend');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMsg('');
    setUploadSuccessMsg('');

    try {
      const result = await importStudentRegistry(file);
      setUploadSuccessMsg(`🎉 Ingested ${result.imported_count} student profiles successfully!`);
      await loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Excel ingestion failed');
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleDownloadSample = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open('http://localhost:8000/sample-student-registry', '_blank');
    }
  };

  const handleGeneratePass = async () => {
    if (!selectedUser) return;
    setIsLoading(true);
    setErrorMsg('');
    setGeneratedPass(null);

    try {
      if (passType === 'PERMANENT') {
        const result = await generatePermanentQR(selectedUser.hall_ticket_number);
        setGeneratedPass(result);
      } else {
        const now = new Date();
        let validFromDate = new Date();
        let validTillDate = new Date();

        if (durationPreset === 'ACTIVE_NOW') {
          validFromDate.setHours(validFromDate.getHours() - 1);
          validTillDate.setHours(validTillDate.getHours() + 4);
        } else if (durationPreset === 'EXPIRED') {
          validFromDate.setDate(validFromDate.getDate() - 3);
          validTillDate.setHours(validTillDate.getHours() - 2);
        } else if (durationPreset === 'FUTURE') {
          validFromDate.setDate(validFromDate.getDate() + 2);
          validTillDate.setDate(validTillDate.getDate() + 3);
        }

        const result = await generateEventQR(
          selectedUser.hall_ticket_number,
          selectedEventId || 'EVT-TECH-2026',
          validFromDate.toISOString(),
          validTillDate.toISOString()
        );
        setGeneratedPass(result);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Pass generation failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🪪 ADMIN PASS ISSUER & EXCEL INGESTION</Text>
        <Text style={styles.headerSubtitle}>
          Dual-Key Relational Registry Management & QR Issuance
        </Text>
      </View>

      {/* Excel Data Ingestion Engine Card */}
      <View style={styles.sectionCard}>
        <View style={styles.excelHeaderRow}>
          <Text style={styles.sectionLabel}>📊 EXCEL DATA INGESTION ENGINE</Text>
          <TouchableOpacity style={styles.sampleDownloadBtn} onPress={handleDownloadSample}>
            <Text style={styles.sampleDownloadText}>📥 Sample .xlsx</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.excelSubtext}>
          Upload student registry spreadsheet (.xlsx/.csv) containing [hall_ticket_number, adm_no, student_name, course, status].
        </Text>

        {Platform.OS === 'web' && (
          <View style={styles.uploadBox}>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <TouchableOpacity
              style={styles.uploadBtn}
              activeOpacity={0.8}
              onPress={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.uploadBtnText}>📂 CHOOSE EXCEL SPREADSHEET TO INGEST</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {uploadSuccessMsg ? (
          <Text style={styles.successText}>{uploadSuccessMsg}</Text>
        ) : null}
      </View>

      {/* User Directory Selector */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>1. SELECT STUDENT PROFILE ({users.length} REGISTERED)</Text>
        
        {isLoading && users.length === 0 ? (
          <ActivityIndicator color={colors.primaryLight} style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.userScroll}
          >
            {users.map((user) => {
              const isSelected = selectedUser?.hall_ticket_number === user.hall_ticket_number;
              return (
                <TouchableOpacity
                  key={user.hall_ticket_number}
                  style={[
                    styles.userCard,
                    isSelected && styles.userCardSelected,
                    user.status === 'SUSPENDED' && styles.userCardSuspended,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setSelectedUser(user);
                    setGeneratedPass(null);
                  }}
                >
                  <View style={styles.userCardTop}>
                    <Text style={styles.userAvatar}>
                      {user.course?.includes('Faculty') ? '👨‍🏫' : '🧑‍🎓'}
                    </Text>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor:
                            user.status === 'ACTIVE' ? colors.active : colors.inactive,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.userNameText} numberOfLines={1}>{user.student_name}</Text>
                  <Text style={styles.userAdmText}>Adm: {user.adm_no}</Text>
                  <Text style={styles.userHtnText}>HTN: {user.hall_ticket_number}</Text>
                  <Text style={styles.userCourseText} numberOfLines={1}>{user.course}</Text>
                  {user.status === 'SUSPENDED' && (
                    <Text style={styles.suspendedTag}>SUSPENDED</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Pass Type & Parameters */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>2. CONFIGURE ACCESS PASS</Text>

        <View style={styles.passTypeToggle}>
          <TouchableOpacity
            style={[
              styles.typeTab,
              passType === 'PERMANENT' && styles.typeTabActive,
            ]}
            onPress={() => {
              setPassType('PERMANENT');
              setGeneratedPass(null);
            }}
          >
            <Text
              style={[
                styles.typeTabText,
                passType === 'PERMANENT' && styles.typeTabTextActive,
              ]}
            >
              ♾️ PERMANENT QR
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.typeTab,
              passType === 'EVENT' && styles.typeTabActive,
            ]}
            onPress={() => {
              setPassType('EVENT');
              setGeneratedPass(null);
            }}
          >
            <Text
              style={[
                styles.typeTabText,
                passType === 'EVENT' && styles.typeTabTextActive,
              ]}
            >
              🎟️ TEMPORARY EVENT PASS
            </Text>
          </TouchableOpacity>
        </View>

        {passType === 'EVENT' && (
          <View style={styles.eventConfigBlock}>
            <Text style={styles.subFieldLabel}>Select Campus Event:</Text>
            <View style={styles.eventList}>
              {events.map((evt) => (
                <TouchableOpacity
                  key={evt.id}
                  style={[
                    styles.eventOption,
                    selectedEventId === evt.id && styles.eventOptionSelected,
                  ]}
                  onPress={() => setSelectedEventId(evt.id)}
                >
                  <Text
                    style={[
                      styles.eventOptionText,
                      selectedEventId === evt.id && styles.eventOptionTextSelected,
                    ]}
                  >
                    {evt.name}
                  </Text>
                  <Text style={styles.eventOptionLocation}>{evt.location}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.subFieldLabel, { marginTop: 12 }]}>
              Time Boundary Window:
            </Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  durationPreset === 'ACTIVE_NOW' && styles.presetBtnActive,
                ]}
                onPress={() => setDurationPreset('ACTIVE_NOW')}
              >
                <Text style={styles.presetBtnText}>✅ Active (+4 hrs)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  durationPreset === 'EXPIRED' && styles.presetBtnActive,
                ]}
                onPress={() => setDurationPreset('EXPIRED')}
              >
                <Text style={styles.presetBtnText}>⌛ Expired Window</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.presetBtn,
                  durationPreset === 'FUTURE' && styles.presetBtnActive,
                ]}
                onPress={() => setDurationPreset('FUTURE')}
              >
                <Text style={styles.presetBtnText}>📅 Future Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Generate Button */}
        <TouchableOpacity
          style={styles.generateButton}
          activeOpacity={0.8}
          onPress={handleGeneratePass}
          disabled={isLoading || !selectedUser}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.generateButtonText}>
              ⚡ GENERATE CRYPTOGRAPHIC QR TOKEN
            </Text>
          )}
        </TouchableOpacity>

        {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
      </View>

      {/* Rendered Scannable Pass Result */}
      {generatedPass && (
        <View style={styles.passResultCard}>
          <View style={styles.passBadgeHeader}>
            <Text style={styles.passBadgeTitle}>
              {generatedPass.pass_type === 'PERMANENT'
                ? 'OFFICIAL PERMANENT CAMPUS TOKEN'
                : 'OFFICIAL TEMPORARY EVENT PASS'}
            </Text>
            <Text style={styles.passBadgeId}>
              HTN: {generatedPass.hall_ticket_number} • ADM: {generatedPass.details?.adm_no}
            </Text>
          </View>

          {/* Scannable High-Density QR Code */}
          <View style={styles.qrContainer}>
            <View style={styles.qrWhiteFrame}>
              <QRCodeRenderer
                value={generatedPass.token}
                size={180}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            </View>
            <Text style={styles.qrScanInstruction}>
              High-Density Verifiable Cryptographic Token
            </Text>
          </View>

          {/* User Details in Pass */}
          <View style={styles.passMetadata}>
            <Text style={styles.metaRow}>
              <Text style={styles.metaLabel}>Student: </Text>
              <Text style={styles.metaVal}>{generatedPass.student_name}</Text>
            </Text>
            <Text style={styles.metaRow}>
              <Text style={styles.metaLabel}>Course: </Text>
              <Text style={styles.metaVal}>{generatedPass.course}</Text>
            </Text>
            {generatedPass.details?.event_id && (
              <Text style={styles.metaRow}>
                <Text style={styles.metaLabel}>Event: </Text>
                <Text style={styles.metaVal}>{generatedPass.details.event_id}</Text>
              </Text>
            )}
            {generatedPass.details?.valid_till && (
              <Text style={styles.metaRow}>
                <Text style={styles.metaLabel}>Valid Till: </Text>
                <Text style={styles.metaVal}>
                  {new Date(generatedPass.details.valid_till).toLocaleString()}
                </Text>
              </Text>
            )}
          </View>

          {/* Direct Simulation Test Button */}
          <TouchableOpacity
            style={styles.testGateButton}
            activeOpacity={0.8}
            onPress={() => onTestScanAtGate(generatedPass.token)}
          >
            <Text style={styles.testGateButtonText}>
              🚀 DIRECT TEST AT GATE (VIEW OVERLAY)
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  excelHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryLight,
    letterSpacing: 0.5,
  },
  sampleDownloadBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  sampleDownloadText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  excelSubtext: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 10,
  },
  uploadBox: {
    marginTop: 4,
  },
  uploadBtn: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderWidth: 1,
    borderColor: colors.primaryLight,
    borderStyle: 'dashed',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  uploadBtnText: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '800',
  },
  successText: {
    color: colors.emerald.light,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  userScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  userCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: colors.border,
  },
  userCardSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: colors.surfaceLight,
  },
  userCardSuspended: {
    opacity: 0.6,
    borderColor: colors.inactive,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userAvatar: {
    fontSize: 20,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  userNameText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  userAdmText: {
    fontSize: 10,
    color: colors.roleStudent,
    fontWeight: '700',
    marginTop: 2,
  },
  userHtnText: {
    fontSize: 9,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  userCourseText: {
    fontSize: 9,
    color: colors.textSecondary,
    marginTop: 2,
  },
  suspendedTag: {
    marginTop: 4,
    fontSize: 8,
    fontWeight: '800',
    color: colors.inactive,
  },
  passTypeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  typeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  typeTabActive: {
    backgroundColor: colors.primary,
  },
  typeTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  typeTabTextActive: {
    color: '#FFFFFF',
  },
  eventConfigBlock: {
    marginBottom: 12,
  },
  subFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  eventList: {
    gap: 6,
  },
  eventOption: {
    backgroundColor: colors.surface,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventOptionSelected: {
    borderColor: colors.primaryLight,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  eventOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  eventOptionTextSelected: {
    color: colors.primaryLight,
  },
  eventOptionLocation: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 2,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetBtnActive: {
    borderColor: colors.warning,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  presetBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  generateButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  errorText: {
    color: colors.crimson.light,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  passResultCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: colors.emerald.base,
    alignItems: 'center',
  },
  passBadgeHeader: {
    alignItems: 'center',
    marginBottom: 10,
  },
  passBadgeTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.emerald.light,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  passBadgeId: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  qrWhiteFrame: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  qrScanInstruction: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 6,
    fontWeight: '600',
  },
  passMetadata: {
    width: '100%',
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 10,
    marginVertical: 10,
    gap: 4,
  },
  metaRow: {
    fontSize: 11,
  },
  metaLabel: {
    fontWeight: '700',
    color: colors.textSecondary,
  },
  metaVal: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  testGateButton: {
    width: '100%',
    backgroundColor: colors.emerald.base,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  testGateButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
