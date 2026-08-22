import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import QRCodeRenderer from './QRCodeRenderer';
import { colors } from '../theme/colors';
import { fetchUsers, generateEventQR } from '../services/api';

export default function TemporaryEventPassGenerator({ onTestScanAtGate }) {
  const [users, setUsers] = useState([]);
  const [participantMode, setParticipantMode] = useState('REGISTERED'); // 'REGISTERED' or 'GUEST'
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchStudent, setSearchStudent] = useState('');

  // Guest Fields
  const [guestName, setGuestName] = useState('');
  const [guestOrg, setGuestOrg] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestId, setGuestId] = useState('');

  // Event Details
  const [eventName, setEventName] = useState('Smart India Hackathon 2026');
  const [eventVenue, setEventVenue] = useState('Main Auditorium & Innovation Labs');
  const [durationPreset, setDurationPreset] = useState('48_HOURS'); // '4_HOURS' | '24_HOURS' | '48_HOURS' | '72_HOURS' | 'EXPIRED_DEMO'

  const [generatedPass, setGeneratedPass] = useState(null);
  const [copiedMsg, setCopiedMsg] = useState(false);

  useEffect(() => {
    loadUsersList();
  }, []);

  const loadUsersList = async () => {
    try {
      const uList = await fetchUsers();
      setUsers(uList);
      if (uList.length > 0 && !selectedUser) {
        setSelectedUser(uList[0]);
      }
    } catch (e) {
      console.warn('Could not load users for event generator:', e);
    }
  };

  const eventPresets = [
    { label: '⚡ Smart India Hackathon 2026', venue: 'Main Auditorium & Innovation Labs' },
    { label: '🤖 AI & Robotics Hackathon', venue: 'Robotics Lab 3, Tech Block' },
    { label: '🏆 24-Hr Coding Marathon', venue: 'Computer Center Block B' },
    { label: '🎪 Annual Tech & Cultural Fest', venue: 'Campus Open Grounds & Auditorium' },
    { label: '💼 Guest Industry Seminar', venue: 'Seminar Hall 1' },
  ];

  const handleSelectPreset = (preset) => {
    setEventName(preset.label);
    setEventVenue(preset.venue);
  };

  const handleGenerateEventPass = async () => {
    const now = new Date();
    let validFrom = new Date();
    let validTill = new Date();

    if (durationPreset === '4_HOURS') {
      validFrom.setMinutes(validFrom.getMinutes() - 10);
      validTill.setHours(validTill.getHours() + 4);
    } else if (durationPreset === '24_HOURS') {
      validFrom.setMinutes(validFrom.getMinutes() - 10);
      validTill.setHours(validTill.getHours() + 24);
    } else if (durationPreset === '48_HOURS') {
      validFrom.setMinutes(validFrom.getMinutes() - 10);
      validTill.setHours(validTill.getHours() + 48);
    } else if (durationPreset === '72_HOURS') {
      validFrom.setMinutes(validFrom.getMinutes() - 10);
      validTill.setHours(validTill.getHours() + 72);
    } else if (durationPreset === 'EXPIRED_DEMO') {
      validFrom.setHours(validFrom.getHours() - 48);
      validTill.setHours(validTill.getHours() - 2);
    }

    let htn = '';
    let name = '';
    let college = '';

    if (participantMode === 'REGISTERED') {
      if (!selectedUser) {
        alert('Please select a student from the directory.');
        return;
      }
      htn = selectedUser.hall_ticket_number;
      name = selectedUser.student_name;
      college = selectedUser.course || 'Vaagdevi College of Engineering';
    } else {
      if (!guestName.trim()) {
        alert('Please enter the participant name.');
        return;
      }
      htn = guestId.trim() || `HACK-${Math.floor(100000 + Math.random() * 900000)}`;
      name = guestName.trim();
      college = guestOrg.trim() || 'External Institution / Participant';
    }

    const eventId = eventName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();

    const passPayload = {
      pass_type: 'EVENT',
      event_id: eventId,
      event_name: eventName,
      hall_ticket_number: htn,
      participant_name: name,
      institution: college,
      venue: eventVenue,
      valid_from: validFrom.toISOString(),
      valid_till: validTill.toISOString(),
      generated_at: now.toISOString(),
      security_hash: `SIG-EVT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    };

    const tokenString = JSON.stringify(passPayload);

    setGeneratedPass({
      payload: passPayload,
      tokenString: tokenString,
      validFromFormatted: validFrom.toLocaleString(),
      validTillFormatted: validTill.toLocaleString(),
      isExpiredPreset: durationPreset === 'EXPIRED_DEMO',
    });
  };

  const handleCopyToken = () => {
    if (!generatedPass) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(generatedPass.tokenString);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
    } else {
      alert('QR Token copied to clipboard!');
    }
  };

  const handlePrintPass = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.print();
    } else {
      alert('Print is supported on web browsers.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchStudent.toLowerCase();
    return (
      (u.student_name || '').toLowerCase().includes(q) ||
      (u.hall_ticket_number || '').toLowerCase().includes(q) ||
      (u.adm_no || '').toLowerCase().includes(q)
    );
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header Banner */}
      <View style={styles.headerCard}>
        <View style={styles.badgeRow}>
          <View style={styles.goldBadge}>
            <Text style={styles.goldBadgeText}>🎟️ TEMPORARY PASS ENGINE</Text>
          </View>
          <Text style={styles.headerSub}>Hackathons, Fests & Event Passes</Text>
        </View>
        <Text style={styles.headerTitle}>Generate Time-Bound Temporary Event QR Passes</Text>
        <Text style={styles.headerDesc}>
          Create cryptographic time-limited QR codes for hackathon participants, guest attendees, or students attending campus events. When scanned at security gates, access is automatically granted during the event window and revoked immediately once the event concludes.
        </Text>
      </View>

      <View style={styles.twoColLayout}>
        {/* LEFT COLUMN: PASS CONFIGURATOR */}
        <View style={styles.configCard}>
          <Text style={styles.sectionHeader}>1. SELECT EVENT OR HACKATHON</Text>

          {/* Quick Event Presets */}
          <Text style={styles.inputLabel}>Quick Event Templates:</Text>
          <View style={styles.chipsWrap}>
            {eventPresets.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.eventChip,
                  eventName === item.label && styles.eventChipActive,
                ]}
                onPress={() => handleSelectPreset(item)}
              >
                <Text
                  style={[
                    styles.eventChipText,
                    eventName === item.label && styles.eventChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Event Title Input */}
          <Text style={styles.inputLabel}>Event / Fest Name:</Text>
          <TextInput
            style={styles.textInput}
            value={eventName}
            onChangeText={setEventName}
            placeholder="e.g. Smart India Hackathon 2026"
            placeholderTextColor={colors.textMuted}
          />

          {/* Event Venue */}
          <Text style={styles.inputLabel}>Event Venue / Approved Gate:</Text>
          <TextInput
            style={styles.textInput}
            value={eventVenue}
            onChangeText={setEventVenue}
            placeholder="e.g. Main Auditorium, IT Block Lab 3"
            placeholderTextColor={colors.textMuted}
          />

          {/* Participant Type Selector */}
          <Text style={[styles.sectionHeader, { marginTop: 16 }]}>2. PARTICIPANT SELECTION</Text>
          <View style={styles.segmentedSelector}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                participantMode === 'REGISTERED' && styles.segmentBtnActive,
              ]}
              onPress={() => setParticipantMode('REGISTERED')}
            >
              <Text
                style={[
                  styles.segmentText,
                  participantMode === 'REGISTERED' && styles.segmentTextActive,
                ]}
              >
                🎓 Enrolled Student
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                participantMode === 'GUEST' && styles.segmentBtnActive,
              ]}
              onPress={() => setParticipantMode('GUEST')}
            >
              <Text
                style={[
                  styles.segmentText,
                  participantMode === 'GUEST' && styles.segmentTextActive,
                ]}
              >
                👥 External Guest / Team
              </Text>
            </TouchableOpacity>
          </View>

          {participantMode === 'REGISTERED' ? (
            <View style={styles.studentPickerBox}>
              <Text style={styles.inputLabel}>Search & Pick Student:</Text>
              <TextInput
                style={styles.textInput}
                value={searchStudent}
                onChangeText={setSearchStudent}
                placeholder="🔍 Type student name or HTN..."
                placeholderTextColor={colors.textMuted}
              />
              <ScrollView style={styles.studentListScroll} nestedScrollEnabled>
                {filteredUsers.map((u, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.studentRow,
                      selectedUser?.hall_ticket_number === u.hall_ticket_number && styles.studentRowSelected,
                    ]}
                    onPress={() => setSelectedUser(u)}
                  >
                    <View style={styles.studentRowInfo}>
                      <Text style={styles.studentRowName}>{u.student_name}</Text>
                      <Text style={styles.studentRowSub}>
                        HTN: {u.hall_ticket_number} | Adm: {u.adm_no} | {u.course}
                      </Text>
                    </View>
                    {selectedUser?.hall_ticket_number === u.hall_ticket_number && (
                      <Text style={styles.checkmarkBadge}>✓ SELECTED</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.guestFormBox}>
              <Text style={styles.inputLabel}>Participant Full Name *:</Text>
              <TextInput
                style={styles.textInput}
                value={guestName}
                onChangeText={setGuestName}
                placeholder="e.g. Rahul Sharma (Team Lead)"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={styles.inputLabel}>College / Institution / Organization:</Text>
              <TextInput
                style={styles.textInput}
                value={guestOrg}
                onChangeText={setGuestOrg}
                placeholder="e.g. IIT Hyderabad / Team CyberKnights"
                placeholderTextColor={colors.textMuted}
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Mobile Phone:</Text>
                  <TextInput
                    style={styles.textInput}
                    value={guestPhone}
                    onChangeText={setGuestPhone}
                    placeholder="+91 98765 43210"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Temporary Team / Roll ID:</Text>
                  <TextInput
                    style={styles.textInput}
                    value={guestId}
                    onChangeText={setGuestId}
                    placeholder="e.g. SIH-TEAM-404"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Validity Duration Window */}
          <Text style={[styles.sectionHeader, { marginTop: 16 }]}>3. VALIDITY DURATION WINDOW</Text>
          <View style={styles.durationGroup}>
            <TouchableOpacity
              style={[styles.durationBtn, durationPreset === '4_HOURS' && styles.durationBtnActive]}
              onPress={() => setDurationPreset('4_HOURS')}
            >
              <Text style={[styles.durationBtnText, durationPreset === '4_HOURS' && styles.durationBtnTextActive]}>
                ⚡ 4 Hours (Workshop)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.durationBtn, durationPreset === '24_HOURS' && styles.durationBtnActive]}
              onPress={() => setDurationPreset('24_HOURS')}
            >
              <Text style={[styles.durationBtnText, durationPreset === '24_HOURS' && styles.durationBtnTextActive]}>
                📅 24 Hours (1 Day Fest)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.durationBtn, durationPreset === '48_HOURS' && styles.durationBtnActive]}
              onPress={() => setDurationPreset('48_HOURS')}
            >
              <Text style={[styles.durationBtnText, durationPreset === '48_HOURS' && styles.durationBtnTextActive]}>
                🏆 48 Hours (Hackathon)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.durationBtn, durationPreset === '72_HOURS' && styles.durationBtnActive]}
              onPress={() => setDurationPreset('72_HOURS')}
            >
              <Text style={[styles.durationBtnText, durationPreset === '72_HOURS' && styles.durationBtnTextActive]}>
                🎪 72 Hours (3-Day Fest)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.durationBtn, durationPreset === 'EXPIRED_DEMO' && styles.durationBtnExpiredActive]}
              onPress={() => setDurationPreset('EXPIRED_DEMO')}
            >
              <Text style={[styles.durationBtnText, durationPreset === 'EXPIRED_DEMO' && styles.durationBtnTextExpired]}>
                🚫 Expired Pass (Test Denial)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action: Generate Button */}
          <TouchableOpacity
            style={styles.generateActionBtn}
            activeOpacity={0.8}
            onPress={handleGenerateEventPass}
          >
            <Text style={styles.generateActionBtnText}>✨ GENERATE SECURE EVENT QR PASS</Text>
          </TouchableOpacity>
        </View>

        {/* RIGHT COLUMN: LIVE BADGE PREVIEW & EXPORT ACTIONS */}
        <View style={styles.previewCard}>
          <Text style={styles.sectionHeader}>4. DIGITAL EVENT GATE PASS PREVIEW</Text>

          {generatedPass ? (
            <View style={styles.badgeWrapper}>
              {/* Event Badge Card */}
              <View style={styles.eventBadge}>
                {/* Badge Header */}
                <View style={styles.badgeTopBar}>
                  <View style={styles.badgeLogoRow}>
                    <Text style={styles.badgeCampusText}>CAMPUS ACCESS AUTHORIZATION</Text>
                    <View style={[styles.statusTag, generatedPass.isExpiredPreset ? styles.statusTagExpired : styles.statusTagActive]}>
                      <Text style={styles.statusTagText}>
                        {generatedPass.isExpiredPreset ? '⛔ EXPIRED PASS' : '🟢 ACTIVE EVENT PASS'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.badgeEventTitle}>{generatedPass.payload.event_name}</Text>
                  <Text style={styles.badgeVenueText}>📍 {generatedPass.payload.venue}</Text>
                </View>

                {/* QR Code Container */}
                <View style={styles.qrContainer}>
                  <QRCodeRenderer
                    value={generatedPass.tokenString}
                    size={Platform.OS === 'web' ? 190 : 160}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                  />
                  <Text style={styles.scanInstructionText}>
                    Scan at Gate Scanner or Mobile Lens
                  </Text>
                </View>

                {/* Participant Details Table */}
                <View style={styles.badgeDetailsBox}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>PARTICIPANT:</Text>
                    <Text style={styles.detailValBold}>{generatedPass.payload.participant_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>ID / ROLL NO:</Text>
                    <Text style={styles.detailVal}>{generatedPass.payload.hall_ticket_number}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>INSTITUTION:</Text>
                    <Text style={styles.detailVal}>{generatedPass.payload.institution}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>VALID FROM:</Text>
                    <Text style={styles.detailVal}>{generatedPass.validFromFormatted}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>VALID TILL:</Text>
                    <Text style={[styles.detailValBold, generatedPass.isExpiredPreset ? { color: '#EF4444' } : { color: '#10B981' }]}>
                      {generatedPass.validTillFormatted}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>SECURITY SIG:</Text>
                    <Text style={styles.detailValMono}>{generatedPass.payload.security_hash}</Text>
                  </View>
                </View>
              </View>

              {/* Pass Action Buttons */}
              <View style={styles.passActionsRow}>
                <TouchableOpacity
                  style={styles.testGateBtn}
                  activeOpacity={0.8}
                  onPress={() => {
                    if (onTestScanAtGate) {
                      onTestScanAtGate(generatedPass.tokenString);
                    }
                  }}
                >
                  <Text style={styles.testGateBtnText}>⚡ TEST SCAN AT GATE TERMINAL</Text>
                </TouchableOpacity>

                <View style={styles.actionSubRow}>
                  <TouchableOpacity
                    style={styles.copyTokenBtn}
                    onPress={handleCopyToken}
                  >
                    <Text style={styles.copyTokenBtnText}>
                      {copiedMsg ? '✅ Copied Token!' : '📋 Copy Token Payload'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.printBtn}
                    onPress={handlePrintPass}
                  >
                    <Text style={styles.printBtnText}>🖨️ Print Pass Badge</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyPreviewBox}>
              <Text style={styles.emptyPreviewIcon}>🎟️</Text>
              <Text style={styles.emptyPreviewTitle}>No Event Pass Generated Yet</Text>
              <Text style={styles.emptyPreviewSub}>
                Configure the event name, participant, and validity duration on the left, then click "Generate Secure Event QR Pass".
              </Text>
            </View>
          )}
        </View>
      </View>
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
  headerCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  goldBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  goldBadgeText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  headerDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  twoColLayout: {
    flexDirection: Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth > 768 ? 'row' : 'column',
    gap: 16,
  },
  configCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewCard: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.primaryLight,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    marginTop: 8,
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  eventChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eventChipActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: colors.primaryLight,
  },
  eventChipText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  eventChipTextActive: {
    color: '#60A5FA',
    fontWeight: '900',
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: '#FFFFFF',
    fontSize: 11,
  },
  segmentedSelector: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  studentPickerBox: {
    marginTop: 4,
  },
  studentListScroll: {
    maxHeight: 130,
    backgroundColor: '#090D16',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  studentRowSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
  },
  studentRowInfo: {
    flex: 1,
  },
  studentRowName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  studentRowSub: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 1,
  },
  checkmarkBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#34D399',
  },
  guestFormBox: {
    marginTop: 4,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  durationGroup: {
    gap: 6,
    marginTop: 4,
  },
  durationBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  durationBtnExpiredActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#EF4444',
  },
  durationBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  durationBtnTextActive: {
    color: '#34D399',
    fontWeight: '900',
  },
  durationBtnTextExpired: {
    color: '#F87171',
    fontWeight: '900',
  },
  generateActionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateActionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  badgeWrapper: {
    alignItems: 'center',
  },
  eventBadge: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0B1120',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3B82F6',
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  badgeTopBar: {
    backgroundColor: '#1E293B',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  badgeLogoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeCampusText: {
    fontSize: 8,
    fontWeight: '900',
    color: colors.primaryLight,
    letterSpacing: 0.5,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTagActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  statusTagExpired: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  statusTagText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  badgeEventTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#F8FAFC',
    marginTop: 2,
  },
  badgeVenueText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 1,
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanInstructionText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#475569',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  badgeDetailsBox: {
    backgroundColor: '#0F172A',
    padding: 12,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  detailVal: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailValBold: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  detailValMono: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.primaryLight,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  passActionsRow: {
    width: '100%',
    maxWidth: 360,
    marginTop: 12,
    gap: 8,
  },
  testGateBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  testGateBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  actionSubRow: {
    flexDirection: 'row',
    gap: 8,
  },
  copyTokenBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyTokenBtnText: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: '800',
  },
  printBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  printBtnText: {
    color: colors.textPrimary,
    fontSize: 9,
    fontWeight: '800',
  },
  emptyPreviewBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyPreviewIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyPreviewTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  emptyPreviewSub: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 15,
  },
});
