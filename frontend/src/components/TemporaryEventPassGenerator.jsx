import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import QRCodeRenderer from './QRCodeRenderer';
import { colors } from '../theme/colors';
import { fetchUsers } from '../services/api';
import { parseExcelClientSide } from '../services/offlineEngine';

export default function TemporaryEventPassGenerator({ onTestScanAtGate }) {
  // Mode: 'BATCH' or 'SINGLE'
  const [generatorMode, setGeneratorMode] = useState('BATCH');

  // Single Student State
  const [users, setUsers] = useState([]);
  const [participantMode, setParticipantMode] = useState('REGISTERED');
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchStudent, setSearchStudent] = useState('');

  // Guest Fields
  const [guestName, setGuestName] = useState('');
  const [guestOrg, setGuestOrg] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestId, setGuestId] = useState('');

  // Event & Direction Settings
  const [eventName, setEventName] = useState('Class Campus Gate Permission');
  const [eventVenue, setEventVenue] = useState('Main Gate & Campus');
  const [gateDirection, setGateDirection] = useState('GATE_IN'); // 'GATE_IN' | 'GATE_OUT' | 'BOTH'
  const [isSingleUse, setIsSingleUse] = useState(true); // One-Time Scan Policy
  const [durationPreset, setDurationPreset] = useState('4_HOURS'); // '2_HOURS' | '4_HOURS' | '24_HOURS' | '48_HOURS' | '72_HOURS'

  // Single Pass Result
  const [generatedSinglePass, setGeneratedSinglePass] = useState(null);
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Batch Class Mode State
  const [batchSource, setBatchSource] = useState('FILE'); // 'FILE' or 'DIRECTORY'
  const [batchStudentsList, setBatchStudentsList] = useState([]);
  const [batchCourseFilter, setBatchCourseFilter] = useState('ALL');
  const [isParsingBatch, setIsParsingBatch] = useState(false);
  const [generatedBatchPasses, setGeneratedBatchPasses] = useState([]);
  const [masterClassPass, setMasterClassPass] = useState(null);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState('');
  const [batchSearch, setBatchSearch] = useState('');

  // Download States
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [statusProgressMsg, setStatusProgressMsg] = useState('');

  const fileInputRef = useRef(null);

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

  const calculateValidityDates = () => {
    const now = new Date();
    let validFrom = new Date();
    let validTill = new Date();

    if (durationPreset === '2_HOURS') {
      validFrom.setMinutes(validFrom.getMinutes() - 10);
      validTill.setHours(validTill.getHours() + 2);
    } else if (durationPreset === '4_HOURS') {
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
    }

    return { now, validFrom, validTill };
  };

  // --- SINGLE PASS GENERATOR ---
  const handleGenerateSinglePass = () => {
    const { now, validFrom, validTill } = calculateValidityDates();
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
      htn = guestId.trim() || `GUEST-${Math.floor(100000 + Math.random() * 900000)}`;
      name = guestName.trim();
      college = guestOrg.trim() || 'External Institution / Participant';
    }

    const uniqueTokenId = `PASS-${gateDirection}-${htn}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const passPayload = {
      token_id: uniqueTokenId,
      pass_type: 'TEMPORARY',
      gate_direction: gateDirection,
      is_single_use: isSingleUse,
      event_id: eventName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase(),
      event_name: eventName,
      hall_ticket_number: htn,
      participant_name: name,
      institution: college,
      venue: eventVenue,
      valid_from: validFrom.toISOString(),
      valid_till: validTill.toISOString(),
      generated_at: now.toISOString(),
      security_hash: `SIG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    };

    const tokenString = JSON.stringify(passPayload);

    setGeneratedSinglePass({
      payload: passPayload,
      tokenString: tokenString,
      validFromFormatted: validFrom.toLocaleString(),
      validTillFormatted: validTill.toLocaleString(),
    });
  };

  // --- BATCH FILE UPLOAD HANDLER ---
  const handleBatchFileUpload = async (event) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    setIsParsingBatch(true);
    setBatchSuccessMsg('');

    try {
      const parsedStudents = await parseExcelClientSide(file);
      if (!parsedStudents || parsedStudents.length === 0) {
        alert('No valid student rows found in uploaded file. Please check column headers (Roll No, Name, Adm No).');
        return;
      }
      setBatchStudentsList(parsedStudents);
      setBatchSuccessMsg(`📂 Loaded ${parsedStudents.length} student profiles from ${file.name}!`);
    } catch (err) {
      alert(`Failed to parse class spreadsheet: ${err.message || err}`);
    } finally {
      setIsParsingBatch(false);
      if (event.target) event.target.value = '';
    }
  };

  // --- BATCH PASS GENERATION (INDIVIDUAL + HUGE MASTER CLASS QR) ---
  const handleGenerateBatchPasses = () => {
    let sourceList = [];
    if (batchSource === 'FILE') {
      sourceList = batchStudentsList;
      if (sourceList.length === 0) {
        alert('Please upload a class Excel/CSV file first.');
        return;
      }
    } else {
      sourceList = batchCourseFilter === 'ALL'
        ? users
        : users.filter((u) => (u.course || '').toUpperCase().includes(batchCourseFilter.toUpperCase()));
      if (sourceList.length === 0) {
        alert('No students found in the selected course.');
        return;
      }
    }

    const { now, validFrom, validTill } = calculateValidityDates();
    const eventId = eventName.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase();
    const className = batchSource === 'FILE' ? (eventName || 'Uploaded Class') : `${batchCourseFilter} Department`;

    // 1. Generate Individual Passes for Each Student
    const generated = sourceList.map((st, idx) => {
      const htn = st.hall_ticket_number || `HTN-${idx + 1000}`;
      const name = st.student_name || 'Student';
      const college = st.course || 'Vaagdevi College of Engineering';
      const uniqueTokenId = `PASS-${gateDirection}-${htn}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const passPayload = {
        token_id: uniqueTokenId,
        pass_type: 'TEMPORARY',
        gate_direction: gateDirection,
        is_single_use: isSingleUse,
        event_id: eventId,
        event_name: eventName,
        hall_ticket_number: htn,
        adm_no: st.adm_no || 'N/A',
        participant_name: name,
        institution: college,
        venue: eventVenue,
        valid_from: validFrom.toISOString(),
        valid_till: validTill.toISOString(),
        generated_at: now.toISOString(),
        security_hash: `SIG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      };

      return {
        student: st,
        payload: passPayload,
        tokenString: JSON.stringify(passPayload),
        validTillFormatted: validTill.toLocaleString(),
        validFromFormatted: validFrom.toLocaleString(),
      };
    });

    // 2. Generate Huge Master Class QR Pass (For Class Leader / Group Entry)
    const masterTokenId = `MASTER-${gateDirection}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const masterPayload = {
      token_id: masterTokenId,
      pass_type: 'BATCH_MASTER',
      gate_direction: gateDirection,
      is_single_use: isSingleUse,
      event_id: eventId,
      event_name: eventName,
      class_name: className,
      student_count: generated.length,
      participant_name: `CLASS MASTER: ${className}`,
      hall_ticket_number: masterTokenId,
      valid_from: validFrom.toISOString(),
      valid_till: validTill.toISOString(),
      generated_at: now.toISOString(),
      security_hash: `SIG-MASTER-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    };

    setMasterClassPass({
      payload: masterPayload,
      tokenString: JSON.stringify(masterPayload),
      validTillFormatted: validTill.toLocaleString(),
      validFromFormatted: validFrom.toLocaleString(),
      studentCount: generated.length,
      className: className,
    });

    setGeneratedBatchPasses(generated);
    setBatchSuccessMsg(`🎉 Generated ${generated.length} Individual QR Passes + 1 Huge Master Class QR Pass!`);
  };

  // --- 📄 DOWNLOAD WHOLE CLASS PASSES AS A MULTI-PAGE PDF DOCUMENT ---
  const handleDownloadClassPdf = async () => {
    if (generatedBatchPasses.length === 0) return;

    setIsGeneratingPdf(true);
    setStatusProgressMsg(`⏳ Generating multi-page PDF document for ${generatedBatchPasses.length} students...`);

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
      const pageHeight = doc.internal.pageSize.getHeight(); // 297mm

      // ----------------------------------------------------
      // PAGE 1: COVER PAGE & HUGE MASTER CLASS QR PASS
      // ----------------------------------------------------
      doc.setFillColor(11, 15, 25);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Top Header Box
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(12, 12, pageWidth - 24, 26, 3, 3, 'F');

      doc.setTextColor(96, 165, 250);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('CAMPUS SECURITY ACCESS CONTROL — OFFICIAL CLASS BATCH PASS', pageWidth / 2, 20, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text(eventName.toUpperCase(), pageWidth / 2, 30, { align: 'center' });

      // Master Info Card
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(12, 44, pageWidth - 24, 235, 4, 4, 'F');

      // Direction Badge
      const isGateIn = gateDirection === 'GATE_IN';
      doc.setFillColor(isGateIn ? 5 : 220, isGateIn ? 150 : 38, isGateIn ? 105 : 38);
      doc.roundedRect(pageWidth / 2 - 35, 50, 70, 9, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${gateDirection.replace('_', '-')} PASS (CLASS-WIDE)`, pageWidth / 2, 56, { align: 'center' });

      // Master QR Code (High Resolution with Quiet Zone Margin)
      if (masterClassPass) {
        const masterQrUrl = await QRCode.toDataURL(masterClassPass.tokenString, {
          width: 600,
          margin: 2,
          errorCorrectionLevel: 'M',
        });
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageWidth / 2 - 40, 64, 80, 80, 3, 3, 'F');
        doc.addImage(masterQrUrl, 'PNG', pageWidth / 2 - 38, 66, 76, 76);
      }

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.text(`MASTER CLASS PASS — ${generatedBatchPasses.length} STUDENTS APPROVED`, pageWidth / 2, 154, { align: 'center' });

      // Master Details Table
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      const startY = 166;
      const details = [
        ['CLASS / DEPARTMENT:', masterClassPass?.className || 'Class Roster'],
        ['TOTAL STUDENTS:', `${generatedBatchPasses.length} Students`],
        ['DIRECTION / TYPE:', `${gateDirection.replace('_', '-')} (${isGateIn ? 'Campus Ingress' : 'Campus Departure'})`],
        ['POLICY:', isSingleUse ? '🔥 SINGLE-USE SCAN (Burned after first gate scan)' : 'MULTI-USE PASS'],
        ['VALID TILL:', masterClassPass?.validTillFormatted || 'N/A'],
        ['MASTER TOKEN ID:', masterClassPass?.payload.token_id || 'N/A'],
      ];

      details.forEach((row, i) => {
        const y = startY + i * 8;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(148, 163, 184);
        doc.text(row[0], 25, y);
        doc.setTextColor(255, 255, 255);
        doc.text(row[1], 85, y);
      });

      doc.setFontSize(8);
      doc.setTextColor(245, 158, 11);
      doc.text('⚠️ Security Instruction: Scan master QR code above for entire class group clearance, or individual student QRs on following pages.', pageWidth / 2, 222, { align: 'center', maxWidth: 170 });

      // ----------------------------------------------------
      // PAGES 2+: INDIVIDUAL STUDENT ID BADGE CARDS (4 CARDS PER PAGE)
      // ----------------------------------------------------
      const cardsPerPage = 4;
      const totalPages = Math.ceil(generatedBatchPasses.length / cardsPerPage);

      for (let p = 0; p < totalPages; p++) {
        doc.addPage();
        doc.setFillColor(11, 15, 25);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Page Header
        doc.setFontSize(9);
        doc.setTextColor(96, 165, 250);
        doc.setFont('helvetica', 'bold');
        doc.text(`${eventName} — Student Passes (Page ${p + 1} of ${totalPages})`, pageWidth / 2, 12, { align: 'center' });

        const pageStudents = generatedBatchPasses.slice(p * cardsPerPage, (p + 1) * cardsPerPage);

        // 2x2 Grid Layout
        for (let idx = 0; idx < pageStudents.length; idx++) {
          const item = pageStudents[idx];
          const col = idx % 2;
          const row = Math.floor(idx / 2);

          const cardX = 12 + col * 94; // Card width 90mm, gap 4mm
          const cardY = 18 + row * 132; // Card height 128mm, gap 4mm
          const cardW = 90;
          const cardH = 128;

          // Card Background
          doc.setFillColor(15, 23, 42);
          doc.roundedRect(cardX, cardY, cardW, cardH, 3, 3, 'F');

          // Card Top Header
          doc.setFillColor(isGateIn ? 5 : 220, isGateIn ? 150 : 38, isGateIn ? 105 : 38);
          doc.roundedRect(cardX, cardY, cardW, 14, 3, 3, 'F');
          doc.rect(cardX, cardY + 10, cardW, 4, 'F');

          doc.setTextColor(255, 255, 255);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.text(`VAAGDEVI GATEWAY — ${gateDirection.replace('_', '-')}`, cardX + cardW / 2, cardY + 8, { align: 'center' });

          // Generate Crisp QR Data URL for Student with Quiet Zone
          const qrDataUrl = await QRCode.toDataURL(item.tokenString, {
            width: 400,
            margin: 2,
            errorCorrectionLevel: 'M',
          });

          // QR Box
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(cardX + cardW / 2 - 25, cardY + 18, 50, 50, 2, 2, 'F');
          doc.addImage(qrDataUrl, 'PNG', cardX + cardW / 2 - 24, cardY + 19, 48, 48);

          // Student Details
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text(item.payload.participant_name.toUpperCase(), cardX + cardW / 2, cardY + 75, { align: 'center', maxWidth: 84 });

          doc.setTextColor(96, 165, 250);
          doc.setFontSize(8);
          doc.text(`ROLL NO: ${item.payload.hall_ticket_number}`, cardX + cardW / 2, cardY + 82, { align: 'center' });

          doc.setTextColor(148, 163, 184);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.text(`Course: ${item.student.course || 'Vaagdevi Engineering'}`, cardX + cardW / 2, cardY + 88, { align: 'center' });

          doc.text(`Valid Till: ${item.validTillFormatted}`, cardX + cardW / 2, cardY + 94, { align: 'center' });

          // Single-Use Notice
          doc.setFillColor(30, 41, 59);
          doc.roundedRect(cardX + 6, cardY + 102, cardW - 12, 18, 2, 2, 'F');

          doc.setTextColor(245, 158, 11);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('🔥 SINGLE-USE SCAN POLICY', cardX + cardW / 2, cardY + 109, { align: 'center' });

          doc.setTextColor(148, 163, 184);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.text('Burns immediately upon gate entry/exit.', cardX + cardW / 2, cardY + 115, { align: 'center' });
        }
      }

      // Save PDF Document
      const filename = `${eventName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${gateDirection}_Class_QR_Passes.pdf`;
      doc.save(filename);

      setStatusProgressMsg(`✅ Successfully generated & downloaded full Class PDF (${generatedBatchPasses.length} students)!`);
      setTimeout(() => setStatusProgressMsg(''), 5000);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      alert(`Failed to generate PDF document: ${err.message || err}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // --- 📄 DOWNLOAD MASTER CLASS QR POSTER PDF ---
  const handleDownloadMasterPosterPdf = async () => {
    if (!masterClassPass) return;

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFillColor(11, 15, 25);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      doc.setFillColor(30, 41, 59);
      doc.roundedRect(12, 12, pageWidth - 24, 26, 3, 3, 'F');

      doc.setTextColor(96, 165, 250);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('CAMPUS SECURITY ACCESS CONTROL — MASTER CLASS POSTER', pageWidth / 2, 20, { align: 'center' });

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text(eventName.toUpperCase(), pageWidth / 2, 30, { align: 'center' });

      // Master Card Box
      doc.setFillColor(15, 23, 42);
      doc.roundedRect(12, 44, pageWidth - 24, 235, 4, 4, 'F');

      const isGateIn = gateDirection === 'GATE_IN';
      doc.setFillColor(isGateIn ? 5 : 220, isGateIn ? 150 : 38, isGateIn ? 105 : 38);
      doc.roundedRect(pageWidth / 2 - 40, 52, 80, 11, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${gateDirection.replace('_', '-')} MASTER PASS`, pageWidth / 2, 60, { align: 'center' });

      // Huge Master QR
      const masterQrUrl = await QRCode.toDataURL(masterClassPass.tokenString, {
        width: 800,
        margin: 2,
        errorCorrectionLevel: 'H',
      });

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(pageWidth / 2 - 55, 68, 110, 110, 3, 3, 'F');
      doc.addImage(masterQrUrl, 'PNG', pageWidth / 2 - 52, 71, 104, 104);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text(`CLASS: ${masterClassPass.className.toUpperCase()}`, pageWidth / 2, 192, { align: 'center' });

      doc.setTextColor(52, 211, 153);
      doc.setFontSize(12);
      doc.text(`✓ ${generatedBatchPasses.length} STUDENTS GROUP ACCESS GRANTED`, pageWidth / 2, 202, { align: 'center' });

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(9);
      doc.text(`Valid Till: ${masterClassPass.validTillFormatted}`, pageWidth / 2, 212, { align: 'center' });

      doc.setTextColor(245, 158, 11);
      doc.setFontSize(8);
      doc.text('🔥 ONE-TIME SCAN GROUP ENTRY • SCAN AT SECURITY GATE TERMINAL', pageWidth / 2, 224, { align: 'center' });

      doc.save(`MASTER_POSTER_${eventName.replace(/\s+/g, '_')}_${gateDirection}.pdf`);
    } catch (e) {
      alert('Failed to generate Master Poster PDF');
    }
  };

  // --- 📦 1-CLICK ZIP ARCHIVE OF HIGH-RES PNG IMAGES ---
  const handleDownloadAllQrZip = async () => {
    if (generatedBatchPasses.length === 0) return;
    setIsZipping(true);
    setStatusProgressMsg(`⏳ Generating ZIP package with ${generatedBatchPasses.length} QR Code PNG images...`);

    try {
      const zip = new JSZip();
      const folderName = `Class_QR_Passes_${eventName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${gateDirection}`;
      const folder = zip.folder(folderName);

      // Add Master QR image
      if (masterClassPass) {
        const masterQrDataUrl = await QRCode.toDataURL(masterClassPass.tokenString, { width: 600, margin: 2 });
        const masterBase64 = masterQrDataUrl.split(',')[1];
        folder.file(`00_MASTER_CLASS_QR_${gateDirection}.png`, masterBase64, { base64: true });
      }

      // Add individual student QR images
      for (let i = 0; i < generatedBatchPasses.length; i++) {
        const item = generatedBatchPasses[i];
        const htn = (item.payload.hall_ticket_number || `ST-${i}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const name = (item.payload.participant_name || 'Student').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
        const filename = `${htn}_${name}_${item.payload.gate_direction}.png`;

        const qrDataUrl = await QRCode.toDataURL(item.tokenString, {
          width: 500,
          margin: 2,
          errorCorrectionLevel: 'M',
        });
        const base64Data = qrDataUrl.split(',')[1];
        folder.file(filename, base64Data, { base64: true });
      }

      setStatusProgressMsg(`📦 Compressing ZIP file...`);
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `${folderName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      setStatusProgressMsg(`✅ Successfully downloaded ZIP package with all ${generatedBatchPasses.length} QR images!`);
      setTimeout(() => setStatusProgressMsg(''), 4000);
    } catch (err) {
      console.error(err);
      alert(`Could not create ZIP: ${err.message || err}`);
    } finally {
      setIsZipping(false);
    }
  };

  // --- 📥 DOWNLOAD INDIVIDUAL STUDENT PNG IMAGE (HIGH-RES WITH QUIET ZONE) ---
  const handleDownloadSingleStudentPng = async (item) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(item.tokenString, {
        width: 600,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      const htn = (item.payload.hall_ticket_number || 'STUDENT').replace(/[^a-zA-Z0-9_-]/g, '_');
      const name = (item.payload.participant_name || 'Student').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '');
      const link = document.createElement('a');
      link.href = qrDataUrl;
      link.download = `${htn}_${name}_${item.payload.gate_direction}_QR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Failed to download QR image.');
    }
  };

  // --- 📊 EXPORT TO CSV / EXCEL ---
  const handleExportBatchToCsv = () => {
    if (generatedBatchPasses.length === 0) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Token ID,Gate Direction,Single Use,Hall Ticket Number,Student Name,Adm No,Event Name,Valid Till,QR Token Payload\n';

    generatedBatchPasses.forEach((item) => {
      const p = item.payload;
      const row = [
        `"${p.token_id}"`,
        `"${p.gate_direction}"`,
        `"${p.is_single_use ? 'YES (1-Time)' : 'NO'}"`,
        `"${p.hall_ticket_number}"`,
        `"${p.participant_name}"`,
        `"${p.adm_no || ''}"`,
        `"${p.event_name}"`,
        `"${item.validTillFormatted}"`,
        `"${item.tokenString.replace(/"/g, '""')}"`,
      ].join(',');
      csvContent += row + '\n';
    });

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Class_QR_Passes_${eventName.replace(/\s+/g, '_')}_${gateDirection}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const filteredBatchPreview = generatedBatchPasses.filter((b) => {
    const q = batchSearch.toLowerCase();
    return (
      (b.payload.participant_name || '').toLowerCase().includes(q) ||
      (b.payload.hall_ticket_number || '').toLowerCase().includes(q) ||
      (b.payload.token_id || '').toLowerCase().includes(q)
    );
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Top Banner */}
      <View style={styles.headerCard}>
        <View style={styles.badgeRow}>
          <View style={styles.goldBadge}>
            <Text style={styles.goldBadgeText}>🎟️ TEMPORARY & BATCH QR ENGINE</Text>
          </View>
          <Text style={styles.headerSub}>Single Student & Class-Wide Generation</Text>
        </View>
        <Text style={styles.headerTitle}>Single-Use Temporary QR Pass Generator (GATE-IN / GATE-OUT)</Text>
        <Text style={styles.headerDesc}>
          Generate cryptographic one-time use passes for a single student or an entire class at once via spreadsheet upload. Download as a multi-page PDF badge sheet, ZIP archive, or Huge Master Class QR code.
        </Text>
      </View>

      {/* GENERATOR MODE SWITCHER */}
      <View style={styles.modeTabsBar}>
        <TouchableOpacity
          style={[styles.modeTab, generatorMode === 'BATCH' && styles.modeTabActive]}
          onPress={() => setGeneratorMode('BATCH')}
        >
          <Text style={[styles.modeTabText, generatorMode === 'BATCH' && styles.modeTabTextActive]}>
            👥 1. BATCH / CLASS-WIDE GENERATOR (Upload File)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeTab, generatorMode === 'SINGLE' && styles.modeTabActive]}
          onPress={() => setGeneratorMode('SINGLE')}
        >
          <Text style={[styles.modeTabText, generatorMode === 'SINGLE' && styles.modeTabTextActive]}>
            👤 2. SINGLE STUDENT PASS
          </Text>
        </TouchableOpacity>
      </View>

      {/* COMMON PASS PARAMETERS CARD */}
      <View style={styles.commonConfigCard}>
        <Text style={styles.sectionHeader}>⚙️ PASS PARAMETERS & POLICIES</Text>

        <View style={styles.twoColRow}>
          {/* Gate Direction (GATE IN vs GATE OUT) */}
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>1. PASS TYPE / GATE DIRECTION:</Text>
            <View style={styles.segmentedSelector}>
              <TouchableOpacity
                style={[styles.segmentBtn, gateDirection === 'GATE_IN' && styles.segmentBtnGreenActive]}
                onPress={() => setGateDirection('GATE_IN')}
              >
                <Text style={[styles.segmentText, gateDirection === 'GATE_IN' && styles.segmentTextBold]}>
                  🟢 GATE-IN (Entry)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, gateDirection === 'GATE_OUT' && styles.segmentBtnRedActive]}
                onPress={() => setGateDirection('GATE_OUT')}
              >
                <Text style={[styles.segmentText, gateDirection === 'GATE_OUT' && styles.segmentTextBold]}>
                  🔴 GATE-OUT (Exit)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, gateDirection === 'BOTH' && styles.segmentBtnBlueActive]}
                onPress={() => setGateDirection('BOTH')}
              >
                <Text style={[styles.segmentText, gateDirection === 'BOTH' && styles.segmentTextBold]}>
                  🎪 DUAL / EVENT
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Single-Use Policy (Burn on Scan) */}
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>2. ONE-TIME SCAN INVALIDATION POLICY:</Text>
            <View style={styles.segmentedSelector}>
              <TouchableOpacity
                style={[styles.segmentBtn, isSingleUse && styles.segmentBtnOrangeActive]}
                onPress={() => setIsSingleUse(true)}
              >
                <Text style={[styles.segmentText, isSingleUse && styles.segmentTextBold]}>
                  🔥 SINGLE-USE (Burn after 1st Scan)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, !isSingleUse && styles.segmentBtnActive]}
                onPress={() => setIsSingleUse(false)}
              >
                <Text style={[styles.segmentText, !isSingleUse && styles.segmentTextBold]}>
                  ♾️ MULTI-USE (Full Duration)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Event / Purpose Name & Validity */}
        <View style={styles.twoColRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Purpose / Event Title:</Text>
            <TextInput
              style={styles.textInput}
              value={eventName}
              onChangeText={setEventName}
              placeholder="e.g. Hackathon Entry, Lunch Permission, Class Outing"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Validity Duration Window:</Text>
            <View style={styles.chipsWrap}>
              {[
                { label: '⚡ 2 Hrs', val: '2_HOURS' },
                { label: '🕒 4 Hrs', val: '4_HOURS' },
                { label: '📅 24 Hrs', val: '24_HOURS' },
                { label: '🏆 48 Hrs', val: '48_HOURS' },
              ].map((d, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.durationChip, durationPreset === d.val && styles.durationChipActive]}
                  onPress={() => setDurationPreset(d.val)}
                >
                  <Text style={[styles.durationChipText, durationPreset === d.val && styles.durationChipTextActive]}>
                    {d.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* MODE 1: BATCH CLASS-WIDE PASS GENERATOR */}
      {/* ========================================================================= */}
      {generatorMode === 'BATCH' && (
        <View style={styles.batchSection}>
          <View style={styles.batchControlCard}>
            <Text style={styles.sectionHeader}>📁 STEP 2: SELECT CLASS SOURCE</Text>

            <View style={styles.segmentedSelector}>
              <TouchableOpacity
                style={[styles.segmentBtn, batchSource === 'FILE' && styles.segmentBtnActive]}
                onPress={() => setBatchSource('FILE')}
              >
                <Text style={[styles.segmentText, batchSource === 'FILE' && styles.segmentTextBold]}>
                  📊 Option A: Upload Class Spreadsheet (.xlsx / .csv)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, batchSource === 'DIRECTORY' && styles.segmentBtnActive]}
                onPress={() => setBatchSource('DIRECTORY')}
              >
                <Text style={[styles.segmentText, batchSource === 'DIRECTORY' && styles.segmentTextBold]}>
                  👥 Option B: Enrolled Class from Database ({users.length})
                </Text>
              </TouchableOpacity>
            </View>

            {batchSource === 'FILE' ? (
              <View style={styles.fileUploadBox}>
                <Text style={styles.uploadSub}>
                  Upload any class roster (.xlsx, .xls, .csv) with student names & roll numbers:
                </Text>
                <TouchableOpacity
                  style={styles.uploadBtn}
                  activeOpacity={0.8}
                  onPress={() => fileInputRef.current && fileInputRef.current.click()}
                  disabled={isParsingBatch}
                >
                  {isParsingBatch ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.uploadBtnText}>📂 CLICK TO CHOOSE CLASS SPREADSHEET</Text>
                  )}
                </TouchableOpacity>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  style={{ display: 'none' }}
                  onChange={handleBatchFileUpload}
                />

                {batchStudentsList.length > 0 && (
                  <View style={styles.fileLoadedBadge}>
                    <Text style={styles.fileLoadedText}>
                      ✅ Ready to Generate for {batchStudentsList.length} Students in Class File
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.dirSelectBox}>
                <Text style={styles.inputLabel}>Filter by Class / Department:</Text>
                <View style={styles.chipsWrap}>
                  {['ALL', 'BCA', 'CSE', 'ECE', 'MECHANICAL', 'CIVIL'].map((dept, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.eventChip, batchCourseFilter === dept && styles.eventChipActive]}
                      onPress={() => setBatchCourseFilter(dept)}
                    >
                      <Text style={[styles.eventChipText, batchCourseFilter === dept && styles.eventChipTextActive]}>
                        {dept}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* ACTION: GENERATE CLASS PASSES */}
            <TouchableOpacity
              style={styles.generateActionBtn}
              activeOpacity={0.85}
              onPress={handleGenerateBatchPasses}
            >
              <Text style={styles.generateActionBtnText}>
                🚀 GENERATE {gateDirection.replace('_', '-')} QR PASSES FOR ENTIRE CLASS
              </Text>
            </TouchableOpacity>

            {batchSuccessMsg ? (
              <View style={styles.batchSuccessBanner}>
                <Text style={styles.batchSuccessText}>{batchSuccessMsg}</Text>
              </View>
            ) : null}
          </View>

          {/* 🏷️ HUGE MASTER CLASS QR CODE PREVIEW CARD */}
          {masterClassPass && (
            <View style={styles.masterClassCard}>
              <View style={styles.masterBadgeHeader}>
                <View style={styles.masterTitleRow}>
                  <Text style={styles.masterBadgeLabel}>🏷️ MASTER CLASS QR PASS</Text>
                  <View style={[styles.dirBadge, masterClassPass.payload.gate_direction === 'GATE_IN' ? styles.dirBadgeGreen : styles.dirBadgeRed]}>
                    <Text style={styles.dirBadgeText}>{masterClassPass.payload.gate_direction.replace('_', '-')}</Text>
                  </View>
                </View>
                <Text style={styles.masterEventTitle}>{masterClassPass.className} — Group Clearance</Text>
                <Text style={styles.masterCountText}>✓ {masterClassPass.studentCount} Students Authorized Under This Code</Text>
              </View>

              <View style={styles.masterQrContainer}>
                <QRCodeRenderer
                  value={masterClassPass.tokenString}
                  size={Platform.OS === 'web' ? 240 : 180}
                  color="#000000"
                  backgroundColor="#FFFFFF"
                />
                <Text style={styles.masterScanHint}>
                  Security Guards: Scan once to grant group entry/exit for all {masterClassPass.studentCount} students
                </Text>
              </View>

              <View style={styles.masterActionsRow}>
                <TouchableOpacity
                  style={styles.masterPosterBtn}
                  onPress={handleDownloadMasterPosterPdf}
                >
                  <Text style={styles.masterPosterBtnText}>📄 Download Master Poster (PDF)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.masterTestBtn}
                  onPress={() => {
                    if (onTestScanAtGate) {
                      onTestScanAtGate(masterClassPass.tokenString);
                    }
                  }}
                >
                  <Text style={styles.masterTestBtnText}>⚡ Test Scan Master QR</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* BATCH RESULTS GRID */}
          {generatedBatchPasses.length > 0 && (
            <View style={styles.batchResultsCard}>
              <View style={styles.batchResultsHeader}>
                <View>
                  <Text style={styles.resultsTitle}>
                    🎟️ CLASS QR PASSES GALLERY ({generatedBatchPasses.length} Students)
                  </Text>
                  <Text style={styles.resultsSub}>
                    Pass Type: <Text style={{ color: gateDirection === 'GATE_IN' ? '#34D399' : '#F87171', fontWeight: '900' }}>{gateDirection.replace('_', '-')}</Text> • Policy: <Text style={{ color: '#FBBF24', fontWeight: '900' }}>{isSingleUse ? '🔥 1-TIME SCAN ONLY' : 'MULTI-SCAN'}</Text>
                  </Text>
                </View>

                {/* 4 DOWNLOAD BUTTONS ROW */}
                <View style={styles.batchActionsRow}>
                  {/* 1. PDF DOWNLOAD BUTTON */}
                  <TouchableOpacity
                    style={styles.pdfDownloadBtn}
                    onPress={handleDownloadClassPdf}
                    disabled={isGeneratingPdf}
                  >
                    {isGeneratingPdf ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.pdfDownloadBtnText}>📄 Download Whole Class (PDF)</Text>
                    )}
                  </TouchableOpacity>

                  {/* 2. ZIP DOWNLOAD BUTTON */}
                  <TouchableOpacity
                    style={styles.zipDownloadBtn}
                    onPress={handleDownloadAllQrZip}
                    disabled={isZipping}
                  >
                    {isZipping ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.zipDownloadBtnText}>📦 Download All QRs (ZIP)</Text>
                    )}
                  </TouchableOpacity>

                  {/* 3. CSV EXCEL EXPORT */}
                  <TouchableOpacity
                    style={styles.exportCsvBtn}
                    onPress={handleExportBatchToCsv}
                  >
                    <Text style={styles.exportCsvBtnText}>📊 Export CSV / Excel</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Status Progress Banner */}
              {statusProgressMsg ? (
                <View style={styles.zipBanner}>
                  <Text style={styles.zipBannerText}>{statusProgressMsg}</Text>
                </View>
              ) : null}

              {/* Search Filter in Batch */}
              <TextInput
                style={styles.searchBar}
                value={batchSearch}
                onChangeText={setBatchSearch}
                placeholder="🔍 Search student in batch by name, HTN, or token ID..."
                placeholderTextColor={colors.textMuted}
              />

              {/* Multi-Student QR Cards Grid */}
              <View style={styles.batchGrid}>
                {filteredBatchPreview.map((item, idx) => (
                  <View key={idx} style={styles.studentBadgeCard}>
                    {/* Badge Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={[styles.dirBadge, item.payload.gate_direction === 'GATE_IN' ? styles.dirBadgeGreen : styles.dirBadgeRed]}>
                        <Text style={styles.dirBadgeText}>{item.payload.gate_direction.replace('_', '-')}</Text>
                      </View>
                      <View style={styles.singleUseTag}>
                        <Text style={styles.singleUseTagText}>🔥 1-TIME USE</Text>
                      </View>
                    </View>

                    {/* QR Code */}
                    <View style={styles.batchQrContainer}>
                      <QRCodeRenderer
                        value={item.tokenString}
                        size={Platform.OS === 'web' ? 140 : 120}
                        color="#000000"
                        backgroundColor="#FFFFFF"
                      />
                    </View>

                    {/* Student Info */}
                    <Text style={styles.badgeStudentName} numberOfLines={1}>
                      {item.payload.participant_name}
                    </Text>
                    <Text style={styles.badgeStudentHtn}>
                      HTN: {item.payload.hall_ticket_number}
                    </Text>
                    <Text style={styles.badgeStudentCourse} numberOfLines={1}>
                      {item.student.course || item.payload.event_name}
                    </Text>

                    <Text style={styles.badgeValidTill}>
                      Valid: {item.validTillFormatted}
                    </Text>

                    {/* Card Action Buttons: Download PNG & Test Scan */}
                    <View style={styles.cardBtnRow}>
                      <TouchableOpacity
                        style={styles.cardDownloadBtn}
                        onPress={() => handleDownloadSingleStudentPng(item)}
                      >
                        <Text style={styles.cardDownloadBtnText}>📥 PNG</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.cardTestBtn}
                        onPress={() => {
                          if (onTestScanAtGate) {
                            onTestScanAtGate(item.tokenString);
                          }
                        }}
                      >
                        <Text style={styles.cardTestBtnText}>⚡ Gate Test</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: SINGLE STUDENT PASS GENERATOR */}
      {/* ========================================================================= */}
      {generatorMode === 'SINGLE' && (
        <View style={styles.twoColLayout}>
          {/* Left Column: Student Picker */}
          <View style={styles.configCard}>
            <Text style={styles.sectionHeader}>👤 SELECT STUDENT OR GUEST</Text>

            <View style={styles.segmentedSelector}>
              <TouchableOpacity
                style={[styles.segmentBtn, participantMode === 'REGISTERED' && styles.segmentBtnActive]}
                onPress={() => setParticipantMode('REGISTERED')}
              >
                <Text style={[styles.segmentText, participantMode === 'REGISTERED' && styles.segmentTextBold]}>
                  🎓 Enrolled Student
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.segmentBtn, participantMode === 'GUEST' && styles.segmentBtnActive]}
                onPress={() => setParticipantMode('GUEST')}
              >
                <Text style={[styles.segmentText, participantMode === 'GUEST' && styles.segmentTextBold]}>
                  👥 Guest / Participant
                </Text>
              </TouchableOpacity>
            </View>

            {participantMode === 'REGISTERED' ? (
              <View style={styles.studentPickerBox}>
                <TextInput
                  style={styles.textInput}
                  value={searchStudent}
                  onChangeText={setSearchStudent}
                  placeholder="🔍 Search student by name or HTN..."
                  placeholderTextColor={colors.textMuted}
                />
                <ScrollView style={styles.studentListScroll} nestedScrollEnabled>
                  {users
                    .filter((u) => {
                      const q = searchStudent.toLowerCase();
                      return (
                        (u.student_name || '').toLowerCase().includes(q) ||
                        (u.hall_ticket_number || '').toLowerCase().includes(q) ||
                        (u.adm_no || '').toLowerCase().includes(q)
                      );
                    })
                    .map((u, idx) => (
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
                  placeholder="e.g. Rajesh Verma"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.inputLabel}>Organization / College:</Text>
                <TextInput
                  style={styles.textInput}
                  value={guestOrg}
                  onChangeText={setGuestOrg}
                  placeholder="e.g. External College / Team Lead"
                  placeholderTextColor={colors.textMuted}
                />

                <Text style={styles.inputLabel}>Temporary ID / Roll No:</Text>
                <TextInput
                  style={styles.textInput}
                  value={guestId}
                  onChangeText={setGuestId}
                  placeholder="e.g. TEMP-ROLL-01"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            )}

            <TouchableOpacity
              style={styles.generateActionBtn}
              activeOpacity={0.8}
              onPress={handleGenerateSinglePass}
            >
              <Text style={styles.generateActionBtnText}>
                ✨ GENERATE SINGLE {gateDirection.replace('_', '-')} QR PASS
              </Text>
            </TouchableOpacity>
          </View>

          {/* Right Column: Single Pass Live Preview */}
          <View style={styles.previewCard}>
            <Text style={styles.sectionHeader}>🎟️ DIGITAL GATE PASS PREVIEW</Text>

            {generatedSinglePass ? (
              <View style={styles.badgeWrapper}>
                <View style={styles.eventBadge}>
                  <View style={styles.badgeTopBar}>
                    <View style={styles.badgeLogoRow}>
                      <Text style={styles.badgeCampusText}>CAMPUS GATEWAY ACCESS</Text>
                      <View style={[styles.statusTag, generatedSinglePass.payload.gate_direction === 'GATE_IN' ? styles.statusTagGreen : styles.statusTagRed]}>
                        <Text style={styles.statusTagText}>
                          {generatedSinglePass.payload.gate_direction.replace('_', '-')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.badgeEventTitle}>{generatedSinglePass.payload.event_name}</Text>
                    <Text style={styles.badgeTokenId}>Token: {generatedSinglePass.payload.token_id}</Text>
                  </View>

                  <View style={styles.qrContainer}>
                    <QRCodeRenderer
                      value={generatedSinglePass.tokenString}
                      size={Platform.OS === 'web' ? 180 : 150}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                    />
                    <Text style={styles.scanInstructionText}>
                      {generatedSinglePass.payload.is_single_use ? '🔥 ONE-TIME SCAN PASS • BURNS ON SCAN' : 'VALID FOR EVENT DURATION'}
                    </Text>
                  </View>

                  <View style={styles.badgeDetailsBox}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>STUDENT / GUEST:</Text>
                      <Text style={styles.detailValBold}>{generatedSinglePass.payload.participant_name}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>ROLL / ID NO:</Text>
                      <Text style={styles.detailVal}>{generatedSinglePass.payload.hall_ticket_number}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>DIRECTION:</Text>
                      <Text style={[styles.detailValBold, { color: generatedSinglePass.payload.gate_direction === 'GATE_IN' ? '#34D399' : '#F87171' }]}>
                        {generatedSinglePass.payload.gate_direction.replace('_', '-')} PASS
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>VALID TILL:</Text>
                      <Text style={styles.detailValBold}>{generatedSinglePass.validTillFormatted}</Text>
                    </View>
                  </View>
                </View>

                {/* Single Pass Actions */}
                <View style={styles.passActionsRow}>
                  <TouchableOpacity
                    style={styles.testGateBtn}
                    onPress={() => {
                      if (onTestScanAtGate) {
                        onTestScanAtGate(generatedSinglePass.tokenString);
                      }
                    }}
                  >
                    <Text style={styles.testGateBtnText}>⚡ TEST SCAN AT GATE TERMINAL</Text>
                  </TouchableOpacity>

                  <View style={styles.actionSubRow}>
                    <TouchableOpacity
                      style={styles.copyTokenBtn}
                      onPress={() => {
                        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
                          navigator.clipboard.writeText(generatedSinglePass.tokenString);
                          setCopiedMsg(true);
                          setTimeout(() => setCopiedMsg(false), 2000);
                        }
                      }}
                    >
                      <Text style={styles.copyTokenBtnText}>
                        {copiedMsg ? '✅ Copied Token!' : '📋 Copy Token'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.printBtn}
                      onPress={() => {
                        if (Platform.OS === 'web' && typeof window !== 'undefined') {
                          window.print();
                        }
                      }}
                    >
                      <Text style={styles.printBtnText}>🖨️ Print Pass</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.emptyPreviewBox}>
                <Text style={styles.emptyPreviewIcon}>🎟️</Text>
                <Text style={styles.emptyPreviewTitle}>No Single Pass Generated</Text>
                <Text style={styles.emptyPreviewSub}>
                  Select a student, configure direction (GATE-IN/GATE-OUT), and tap Generate.
                </Text>
              </View>
            )}
          </View>
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
    paddingBottom: 60,
  },
  headerCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
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
    fontSize: 15,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  headerDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 16,
  },
  modeTabsBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 4,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 8,
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
    fontWeight: '900',
  },
  commonConfigCard: {
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
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
    marginBottom: 4,
  },
  twoColRow: {
    flexDirection: Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth > 768 ? 'row' : 'column',
    gap: 12,
    marginTop: 8,
  },
  segmentedSelector: {
    flexDirection: 'row',
    backgroundColor: '#090D16',
    borderRadius: 8,
    padding: 3,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
  },
  segmentBtnGreenActive: {
    backgroundColor: '#059669',
  },
  segmentBtnRedActive: {
    backgroundColor: '#DC2626',
  },
  segmentBtnBlueActive: {
    backgroundColor: '#2563EB',
  },
  segmentBtnOrangeActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  segmentText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  segmentTextBold: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  textInput: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: '#FFFFFF',
    fontSize: 11,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  durationChip: {
    backgroundColor: '#090D16',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  durationChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  durationChipTextActive: {
    color: '#34D399',
    fontWeight: '900',
  },
  eventChip: {
    backgroundColor: '#090D16',
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
  batchSection: {
    gap: 14,
  },
  batchControlCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fileUploadBox: {
    marginTop: 12,
    alignItems: 'center',
    padding: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primaryLight,
    borderRadius: 10,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  uploadSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 10,
    textAlign: 'center',
  },
  uploadBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  fileLoadedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10B981',
    marginTop: 10,
  },
  fileLoadedText: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '900',
  },
  dirSelectBox: {
    marginTop: 12,
  },
  generateActionBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 14,
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
  batchSuccessBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  batchSuccessText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  masterClassCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
    padding: 16,
    alignItems: 'center',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  masterBadgeHeader: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  masterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  masterBadgeLabel: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  masterEventTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },
  masterCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    marginTop: 2,
  },
  masterQrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 10,
  },
  masterScanHint: {
    color: '#475569',
    fontSize: 8,
    fontWeight: '800',
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 240,
  },
  masterActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    maxWidth: 420,
    marginTop: 10,
  },
  masterPosterBtn: {
    flex: 1,
    backgroundColor: '#D97706',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  masterPosterBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  masterTestBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  masterTestBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  batchResultsCard: {
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  batchResultsHeader: {
    flexDirection: Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth > 768 ? 'row' : 'column',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  resultsTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  resultsSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  batchActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pdfDownloadBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pdfDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  zipDownloadBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zipDownloadBtnText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  zipBanner: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  zipBannerText: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  exportCsvBtn: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  exportCsvBtnText: {
    color: '#60A5FA',
    fontSize: 9,
    fontWeight: '800',
  },
  searchBar: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: '#FFFFFF',
    fontSize: 11,
    marginBottom: 12,
  },
  batchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  studentBadgeCard: {
    width: Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth > 768 ? 220 : '100%',
    backgroundColor: '#0B1120',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 6,
  },
  dirBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dirBadgeGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  dirBadgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  dirBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  singleUseTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  singleUseTagText: {
    color: '#F59E0B',
    fontSize: 7,
    fontWeight: '900',
  },
  batchQrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 8,
    borderRadius: 8,
    marginVertical: 6,
  },
  badgeStudentName: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  badgeStudentHtn: {
    fontSize: 9,
    color: colors.primaryLight,
    fontWeight: '800',
    marginTop: 1,
  },
  badgeStudentCourse: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 1,
  },
  badgeValidTill: {
    fontSize: 8,
    color: '#94A3B8',
    marginTop: 2,
  },
  cardBtnRow: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
    marginTop: 8,
  },
  cardDownloadBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  cardDownloadBtnText: {
    color: '#93C5FD',
    fontSize: 8,
    fontWeight: '900',
  },
  cardTestBtn: {
    flex: 1.2,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: 'center',
  },
  cardTestBtnText: {
    color: '#34D399',
    fontSize: 8,
    fontWeight: '900',
  },
  twoColLayout: {
    flexDirection: Platform.OS === 'web' && typeof window !== 'undefined' && window.innerWidth > 768 ? 'row' : 'column',
    gap: 14,
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
  studentPickerBox: {
    marginTop: 8,
  },
  studentListScroll: {
    maxHeight: 140,
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
  },
  checkmarkBadge: {
    fontSize: 9,
    fontWeight: '900',
    color: '#34D399',
  },
  guestFormBox: {
    marginTop: 8,
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
  statusTagGreen: {
    backgroundColor: '#059669',
  },
  statusTagRed: {
    backgroundColor: '#DC2626',
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
    marginTop: 4,
  },
  badgeTokenId: {
    fontSize: 8,
    color: colors.textMuted,
    marginTop: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    alignItems: 'center',
  },
  scanInstructionText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#F59E0B',
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
