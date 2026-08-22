import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { colors } from '../theme/colors';
import {
  fetchAllUsers,
  importStudentRegistry,
  getSampleExcelUrl,
  downloadSampleExcel,
  registerManualUser,
  deleteUser,
  updateUserStatus,
} from '../services/api';
import TemporaryEventPassGenerator from './TemporaryEventPassGenerator';

export default function DatabaseManagementView({ onTestScanAtGate }) {
  const [activeSubTab, setActiveSubTab] = useState('DIRECTORY'); // Default to directory view
  const [usersList, setUsersList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingHtn, setDeletingHtn] = useState(null);
  const [updatingHtn, setUpdatingHtn] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Excel Ingestion State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const fileInputRef = useRef(null);

  // Manual Form State
  const [formData, setFormData] = useState({
    student_name: '',
    role: 'STUDENT',
    adm_no: '',
    hall_ticket_number: '',
    course: 'BCA',
    duration: '2024 - 2027',
    phone_number: '+91',
    email: '',
    status: 'ACTIVE',
  });
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);
  const [manualFeedback, setManualFeedback] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAllUsers();
      setUsersList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadFeedback(null);

    const data = new FormData();
    data.append('file', file);

    try {
      const res = await importStudentRegistry(data);
      if (res.status === 'SUCCESS') {
        setUploadFeedback({
          type: 'SUCCESS',
          msg: `✓ ${res.message}`,
        });
        loadUsers();
      } else {
        setUploadFeedback({
          type: 'ERROR',
          msg: `✕ ${res.message || 'Import failed'}`,
        });
      }
    } catch (err) {
      setUploadFeedback({
        type: 'ERROR',
        msg: `✕ Network Error: ${err.message}`,
      });
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleManualSubmit = async () => {
    if (!formData.student_name.trim() || !formData.adm_no.trim() || !formData.hall_ticket_number.trim()) {
      setManualFeedback({
        type: 'ERROR',
        msg: 'Please fill in Name, Admission No, and Hall Ticket No.',
      });
      return;
    }

    setIsSubmittingManual(true);
    setManualFeedback(null);

    try {
      const res = await registerManualUser(formData);
      setManualFeedback({
        type: 'SUCCESS',
        msg: `✓ ${res.message}`,
      });
      // Reset form
      setFormData({
        student_name: '',
        role: 'STUDENT',
        adm_no: '',
        hall_ticket_number: '',
        course: 'BCA',
        duration: '2024 - 2027',
        phone_number: '+91',
        email: '',
        status: 'ACTIVE',
      });
      loadUsers();
    } catch (err) {
      setManualFeedback({
        type: 'ERROR',
        msg: `✕ Error: ${err.message}`,
      });
    } finally {
      setIsSubmittingManual(false);
    }
  };

  const handleStatusChange = async (user, newStatus) => {
    if (user.status === newStatus) return;

    setUpdatingHtn(user.hall_ticket_number);
    setActionFeedback(null);

    try {
      const res = await updateUserStatus(user.hall_ticket_number, newStatus);
      setActionFeedback({
        type: 'SUCCESS',
        msg: `✓ Updated status of ${user.student_name} to ${newStatus}`,
      });
      await loadUsers();
    } catch (err) {
      setActionFeedback({
        type: 'ERROR',
        msg: `✕ Failed to update status: ${err.message}`,
      });
    } finally {
      setUpdatingHtn(null);
    }
  };

  const handleDeleteUser = async (user) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm(`Are you sure you want to delete ${user.student_name} (${user.hall_ticket_number}) from the database?`)
      : true;

    if (!confirmDelete) return;

    setDeletingHtn(user.hall_ticket_number);
    setActionFeedback(null);

    try {
      const res = await deleteUser(user.hall_ticket_number);
      setActionFeedback({
        type: 'SUCCESS',
        msg: `✓ ${res.message || `Deleted ${user.student_name}`}`,
      });
      await loadUsers();
    } catch (err) {
      setActionFeedback({
        type: 'ERROR',
        msg: `✕ Error deleting: ${err.message}`,
      });
    } finally {
      setDeletingHtn(null);
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      (u.student_name && u.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.adm_no && u.adm_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.hall_ticket_number && u.hall_ticket_number.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.course && u.course.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🗄️ SECTION 2: DATABASE MANAGEMENT</Text>
          <Text style={styles.subtitle}>
            Manage Student & Lecturer Profiles • Total: {usersList.length} Active Records
          </Text>
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={loadUsers} disabled={isLoading}>
          <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Action Feedback Banner */}
      {actionFeedback && (
        <View
          style={[
            styles.feedbackBox,
            actionFeedback.type === 'SUCCESS' ? styles.feedbackSuccess : styles.feedbackError,
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              actionFeedback.type === 'SUCCESS' ? styles.feedbackTextSuccess : styles.feedbackTextError,
            ]}
          >
            {actionFeedback.msg}
          </Text>
        </View>
      )}

      {/* Sub-Navigation Tabs */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'DIRECTORY' && styles.subTabActive]}
          onPress={() => setActiveSubTab('DIRECTORY')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'DIRECTORY' && styles.subTabTextActive]}>
            👥 1. DIRECTORY ({usersList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'EXCEL' && styles.subTabActive]}
          onPress={() => setActiveSubTab('EXCEL')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'EXCEL' && styles.subTabTextActive]}>
            📊 2. EXCEL INGESTER
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, activeSubTab === 'MANUAL' && styles.subTabActive]}
          onPress={() => setActiveSubTab('MANUAL')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'MANUAL' && styles.subTabTextActive]}>
            ✍️ 3. MANUAL REGISTER
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, styles.subTabEvent, activeSubTab === 'EVENT' && styles.subTabEventActive]}
          onPress={() => setActiveSubTab('EVENT')}
        >
          <Text style={[styles.subTabText, activeSubTab === 'EVENT' && styles.subTabTextEventActive]}>
            🎟️ 4. EVENT PASS
          </Text>
        </TouchableOpacity>
      </View>

      {/* SUB-COMPONENT 1: LIVE DIRECTORY WITH 1-TAP STATUS TOGGLE & DELETE */}
      {activeSubTab === 'DIRECTORY' && (
        <View style={styles.tabContent}>
          <TextInput
            style={styles.searchBar}
            placeholder="🔍 Search student to update status or remove by Name, Adm No, Hall Ticket No..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <ScrollView style={styles.dirList} contentContainerStyle={styles.dirListContent}>
            {filteredUsers.length === 0 ? (
              <View style={styles.emptyDir}>
                <Text style={styles.emptyDirIcon}>📭</Text>
                <Text style={styles.emptyDirTitle}>No Profiles Found</Text>
                <Text style={styles.emptyDirSub}>
                  Upload an Excel spreadsheet in Tab 2 or register manually in Tab 3.
                </Text>
              </View>
            ) : (
              filteredUsers.map((u) => {
                const isLecturer = u.role === 'LECTURER' || u.role === 'FACULTY';
                const isActive = u.status === 'ACTIVE';
                const isSuspended = u.status === 'SUSPENDED';
                const isInactive = u.status === 'INACTIVE';
                const isDeleting = deletingHtn === u.hall_ticket_number;
                const isUpdating = updatingHtn === u.hall_ticket_number;

                return (
                  <View key={u.hall_ticket_number} style={styles.userCard}>
                    <View style={styles.userCardHeader}>
                      <View style={styles.userCardTitleRow}>
                        <Text style={styles.userNameText}>{u.student_name}</Text>
                        <View
                          style={[
                            styles.roleBadge,
                            {
                              backgroundColor: isLecturer
                                ? 'rgba(168, 85, 247, 0.2)'
                                : 'rgba(59, 130, 246, 0.2)',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleBadgeText,
                              { color: isLecturer ? '#C084FC' : colors.primaryLight },
                            ]}
                          >
                            {u.role || 'STUDENT'}
                          </Text>
                        </View>
                      </View>

                      {/* DELETE / REMOVE BUTTON */}
                      <TouchableOpacity
                        style={styles.deleteBtn}
                        activeOpacity={0.7}
                        onPress={() => handleDeleteUser(u)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color={colors.crimson.light} />
                        ) : (
                          <Text style={styles.deleteBtnText}>🗑️ Remove</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={styles.userCardDetails}>
                      <Text style={styles.keyText}>
                        HTN: <Text style={styles.keyVal}>{u.hall_ticket_number}</Text> • ADM:{' '}
                        <Text style={styles.keyVal}>{u.adm_no}</Text>
                      </Text>
                      <Text style={styles.courseText}>
                        {u.course} ({u.duration})
                      </Text>
                      <Text style={styles.contactText}>
                        📞 {u.phone_number} • ✉️ {u.email}
                      </Text>
                    </View>

                    {/* 1-TAP STATUS SWITCHER CONTROLS */}
                    <View style={styles.statusSwitcherRow}>
                      <Text style={styles.statusSwitcherLabel}>STATUS CONTROL:</Text>
                      <View style={styles.statusBtnGroup}>
                        <TouchableOpacity
                          style={[
                            styles.statusToggleBtn,
                            isActive && styles.statusToggleBtnActive,
                          ]}
                          onPress={() => handleStatusChange(u, 'ACTIVE')}
                          disabled={isUpdating}
                        >
                          <Text
                            style={[
                              styles.statusToggleBtnText,
                              isActive && styles.statusToggleBtnTextActive,
                            ]}
                          >
                            🟢 ACTIVE
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.statusToggleBtn,
                            isSuspended && styles.statusToggleBtnSuspended,
                          ]}
                          onPress={() => handleStatusChange(u, 'SUSPENDED')}
                          disabled={isUpdating}
                        >
                          <Text
                            style={[
                              styles.statusToggleBtnText,
                              isSuspended && styles.statusToggleBtnTextSuspended,
                            ]}
                          >
                            🔴 SUSPENDED
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.statusToggleBtn,
                            isInactive && styles.statusToggleBtnInactive,
                          ]}
                          onPress={() => handleStatusChange(u, 'INACTIVE')}
                          disabled={isUpdating}
                        >
                          <Text
                            style={[
                              styles.statusToggleBtnText,
                              isInactive && styles.statusToggleBtnTextInactive,
                            ]}
                          >
                            🟡 INACTIVE
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* SUB-COMPONENT 2: EXCEL INGESTER */}
      {activeSubTab === 'EXCEL' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>EXCEL SPREADSHEET BULK INGESTER</Text>
            <Text style={styles.cardSub}>
              Upload .xlsx or .csv files with columns: [hall_ticket_number, adm_no, student_name, course, duration, phone_number, email, status, role]
            </Text>

            {/* Hidden HTML File Input */}
            {Platform.OS === 'web' && (
              <input
                type="file"
                ref={fileInputRef}
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            )}

            <View style={styles.dropZone}>
              <Text style={styles.dropZoneIcon}>📁</Text>
              <Text style={styles.dropZoneTitle}>Select Registry Spreadsheet</Text>
              <Text style={styles.dropZoneSub}>Supports Microsoft Excel (.xlsx, .xls) and CSV</Text>

              <TouchableOpacity
                style={styles.uploadBtn}
                activeOpacity={0.85}
                onPress={() => {
                  if (Platform.OS === 'web' && fileInputRef.current) {
                    fileInputRef.current.click();
                  }
                }}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.uploadBtnText}>📤 CHOOSE EXCEL FILE & INGEST</Text>
                )}
              </TouchableOpacity>
            </View>

            {uploadFeedback && (
              <View
                style={[
                  styles.feedbackBox,
                  uploadFeedback.type === 'SUCCESS' ? styles.feedbackSuccess : styles.feedbackError,
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    uploadFeedback.type === 'SUCCESS' ? styles.feedbackTextSuccess : styles.feedbackTextError,
                  ]}
                >
                  {uploadFeedback.msg}
                </Text>
              </View>
            )}

            <View style={styles.templateBox}>
              <Text style={styles.templateText}>Need a pre-formatted spreadsheet template?</Text>
              <TouchableOpacity
                style={styles.downloadTemplateBtn}
                onPress={() => {
                  downloadSampleExcel();
                }}
              >
                <Text style={styles.downloadTemplateBtnText}>📥 Download Sample Template (.xlsx)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* SUB-COMPONENT 3: MANUAL FORM REGISTRATOR */}
      {activeSubTab === 'MANUAL' && (
        <ScrollView style={styles.tabContent} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>MANUAL PROFILE REGISTRATOR</Text>
            <Text style={styles.cardSub}>
              Directly insert an individual Student or Lecturer record into the local SQLite database.
            </Text>

            {manualFeedback && (
              <View
                style={[
                  styles.feedbackBox,
                  manualFeedback.type === 'SUCCESS' ? styles.feedbackSuccess : styles.feedbackError,
                ]}
              >
                <Text
                  style={[
                    styles.feedbackText,
                    manualFeedback.type === 'SUCCESS' ? styles.feedbackTextSuccess : styles.feedbackTextError,
                  ]}
                >
                  {manualFeedback.msg}
                </Text>
              </View>
            )}

            {/* Role Switcher */}
            <View style={styles.formRow}>
              <Text style={styles.inputLabel}>PROFILE ROLE:</Text>
              <View style={styles.rolePicker}>
                <TouchableOpacity
                  style={[styles.roleOption, formData.role === 'STUDENT' && styles.roleOptionActive]}
                  onPress={() => setFormData({ ...formData, role: 'STUDENT' })}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      formData.role === 'STUDENT' && styles.roleOptionTextActive,
                    ]}
                  >
                    🧑‍🎓 STUDENT
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleOption, formData.role === 'LECTURER' && styles.roleOptionActive]}
                  onPress={() => setFormData({ ...formData, role: 'LECTURER' })}
                >
                  <Text
                    style={[
                      styles.roleOptionText,
                      formData.role === 'LECTURER' && styles.roleOptionTextActive,
                    ]}
                  >
                    👩‍🏫 LECTURER / FACULTY
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Full Name */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>FULL NAME *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Ketavath Rakesh Naik"
                placeholderTextColor={colors.textMuted}
                value={formData.student_name}
                onChangeText={(t) => setFormData({ ...formData, student_name: t })}
              />
            </View>

            {/* Dual Keys: Admission No & Hall Ticket No */}
            <View style={styles.formGrid}>
              <View style={styles.formGridItem}>
                <Text style={styles.inputLabel}>ADMISSION NO (CARD ID) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 25-5-117"
                  placeholderTextColor={colors.textMuted}
                  value={formData.adm_no}
                  onChangeText={(t) => setFormData({ ...formData, adm_no: t })}
                />
              </View>

              <View style={styles.formGridItem}>
                <Text style={styles.inputLabel}>HALL TICKET NUMBER (SYSTEM KEY) *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 086256008"
                  placeholderTextColor={colors.textMuted}
                  value={formData.hall_ticket_number}
                  onChangeText={(t) => setFormData({ ...formData, hall_ticket_number: t })}
                />
              </View>
            </View>

            {/* Course & Duration */}
            <View style={styles.formGrid}>
              <View style={styles.formGridItem}>
                <Text style={styles.inputLabel}>COURSE / DEPARTMENT</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. BCA or Computer Science"
                  placeholderTextColor={colors.textMuted}
                  value={formData.course}
                  onChangeText={(t) => setFormData({ ...formData, course: t })}
                />
              </View>

              <View style={styles.formGridItem}>
                <Text style={styles.inputLabel}>DURATION / BATCH</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. 2024 - 2027"
                  placeholderTextColor={colors.textMuted}
                  value={formData.duration}
                  onChangeText={(t) => setFormData({ ...formData, duration: t })}
                />
              </View>
            </View>

            {/* Phone & Email */}
            <View style={styles.formGrid}>
              <View style={styles.formGridItem}>
                <Text style={styles.inputLabel}>PHONE (FOR SMS ALERTS)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="+919876543210"
                  placeholderTextColor={colors.textMuted}
                  value={formData.phone_number}
                  onChangeText={(t) => setFormData({ ...formData, phone_number: t })}
                />
              </View>

              <View style={styles.formGridItem}>
                <Text style={styles.inputLabel}>EMAIL (FOR EMAIL ALERTS)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="student@campus.edu"
                  placeholderTextColor={colors.textMuted}
                  value={formData.email}
                  onChangeText={(t) => setFormData({ ...formData, email: t })}
                />
              </View>
            </View>

            {/* Status Picker */}
            <View style={styles.formRow}>
              <Text style={styles.inputLabel}>STATUS:</Text>
              <View style={styles.rolePicker}>
                {['ACTIVE', 'INACTIVE', 'SUSPENDED'].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.statusOption, formData.status === st && styles.statusOptionActive]}
                    onPress={() => setFormData({ ...formData, status: st })}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        formData.status === st && styles.statusOptionTextActive,
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.saveUserBtn}
              activeOpacity={0.85}
              onPress={handleManualSubmit}
              disabled={isSubmittingManual}
            >
              {isSubmittingManual ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveUserBtnText}>💾 SAVE TO SQLITE DATABASE</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* SUB-COMPONENT 4: TEMPORARY EVENT PASS GENERATOR */}
      {activeSubTab === 'EVENT' && (
        <View style={styles.tabContent}>
          <TemporaryEventPassGenerator onTestScanAtGate={onTestScanAtGate} />
        </View>
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
    fontWeight: '800',
  },
  subTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.cardBg,
    borderRadius: 10,
    padding: 4,
    gap: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  subTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  subTabActive: {
    backgroundColor: colors.primary,
  },
  subTabEvent: {
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  subTabEventActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  subTabText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  subTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  subTabTextEventActive: {
    color: '#FBBF24',
    fontWeight: '900',
  },
  tabContent: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primaryLight,
    letterSpacing: 0.5,
  },
  cardSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 3,
    marginBottom: 14,
  },
  dropZone: {
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  dropZoneIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  dropZoneTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dropZoneSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  uploadBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: colors.primaryLight,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  feedbackBox: {
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  feedbackSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: colors.emerald.light,
  },
  feedbackError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: colors.crimson.light,
  },
  feedbackText: {
    fontSize: 11,
    fontWeight: '700',
  },
  feedbackTextSuccess: {
    color: colors.emerald.light,
  },
  feedbackTextError: {
    color: colors.crimson.light,
  },
  templateBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  templateText: {
    fontSize: 10,
    color: colors.textSecondary,
    flex: 1,
  },
  downloadTemplateBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  downloadTemplateBtnText: {
    color: colors.primaryLight,
    fontSize: 10,
    fontWeight: '800',
  },
  formGroup: {
    marginBottom: 10,
  },
  formGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  formGridItem: {
    flex: 1,
  },
  formRow: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 11,
  },
  rolePicker: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryLight,
  },
  roleOptionText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  roleOptionTextActive: {
    color: '#FFFFFF',
  },
  statusOption: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusOptionActive: {
    backgroundColor: colors.primary,
  },
  statusOptionText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  statusOptionTextActive: {
    color: '#FFFFFF',
  },
  saveUserBtn: {
    backgroundColor: colors.emerald.base,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: colors.emerald.light,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  saveUserBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  searchBar: {
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 11,
    marginBottom: 10,
  },
  dirList: {
    flex: 1,
  },
  dirListContent: {
    gap: 8,
    paddingBottom: 20,
  },
  emptyDir: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyDirIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  emptyDirTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyDirSub: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 3,
    maxWidth: 240,
  },
  userCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  userCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  userNameText: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: colors.crimson.light,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: colors.crimson.light,
    fontSize: 10,
    fontWeight: '900',
  },
  userCardDetails: {
    gap: 2,
    marginBottom: 8,
  },
  keyText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  keyVal: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  courseText: {
    fontSize: 10,
    color: colors.textMuted,
  },
  contactText: {
    fontSize: 9,
    color: colors.textSecondary,
  },
  statusSwitcherRow: {
    backgroundColor: '#0F172A',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusSwitcherLabel: {
    fontSize: 8,
    fontWeight: '800',
    color: colors.textMuted,
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  statusBtnGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  statusToggleBtn: {
    flex: 1,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusToggleBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: colors.emerald.light,
  },
  statusToggleBtnSuspended: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: colors.crimson.light,
  },
  statusToggleBtnInactive: {
    backgroundColor: 'rgba(234, 179, 8, 0.25)',
    borderColor: colors.warning,
  },
  statusToggleBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  statusToggleBtnTextActive: {
    color: colors.emerald.light,
    fontWeight: '900',
  },
  statusToggleBtnTextSuspended: {
    color: colors.crimson.light,
    fontWeight: '900',
  },
  statusToggleBtnTextInactive: {
    color: colors.warning,
    fontWeight: '900',
  },
});
