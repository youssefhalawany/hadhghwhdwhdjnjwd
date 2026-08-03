"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Calendar, Clock, Plus, Trash2, Save, Download, RefreshCw, 
  AlertCircle, CheckCircle2, Users, Check, X, ArrowRightLeft, 
  Send, Inbox, CalendarCheck, Coffee, Sun, Moon, Sunrise, 
  Printer, ChevronLeft, ChevronRight, Filter, Search, Globe, Eye,
  Sliders, UserCheck, ShieldCheck, Sparkles
} from "lucide-react";
import { useBranch, BranchId } from "@/context/BranchContext";
import { db, dbService } from "@/lib/firebase";
import { collection, addDoc, updateDoc, setDoc, getDoc, doc, onSnapshot, query, getDocs } from "firebase/firestore";
import { normalizeBranchId, getDbStoreId, getBranchDisplayName, generateSchedule } from "@/lib/schedule-generator";

interface ShiftAssignment {
  employeeId: string;
  employeeName: string;
  position?: string;
  shiftTime: string; // "Morning" | "Noon" | "Night" | "Off" | "Off (Approved Leave)" | "Custom"
  isBorrowed?: boolean;
  borrowedFrom?: string;
  notes?: string;
}

interface DailySchedule {
  date: string;
  shifts: ShiftAssignment[];
}

interface MonthlySchedule {
  id?: string;
  month: string;
  storeId: string;
  branchName?: string;
  assignments: DailySchedule[];
  isPublished: boolean;
  updatedAt?: string;
  publishedAt?: string;
  rules?: any;
}

interface EmployeeItem {
  id: string;
  name: string;
  position?: string;
  storeId?: string;
  branchId?: string;
  shiftTime?: string;
  status?: string;
}

const SHIFT_OPTIONS = [
  { id: "Morning", label: "Morning (08:00 - 16:00)", short: "Morning", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30", icon: Sunrise },
  { id: "Noon", label: "Noon (16:00 - 00:00)", short: "Noon", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30", icon: Sun },
  { id: "Night", label: "Night (00:00 - 08:00)", short: "Night", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30", icon: Moon },
  { id: "Off", label: "Day Off", short: "Off", color: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30", icon: Coffee },
  { id: "Off (Approved Leave)", label: "Approved Leave", short: "Leave", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30", icon: CalendarCheck },
];

export default function AdminSchedulePage() {
  const { currentBranch, setBranch } = useBranch();
  
  // Date & Branch states
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [activeBranchId, setActiveBranchId] = useState<string>(
    currentBranch === "ola" ? "ola-el-koronfol" : "eL-alamein-4"
  );

  // View state
  const [viewMode, setViewMode] = useState<"matrix" | "daily" | "analytics" | "leaves">("matrix");
  const [searchFilter, setSearchFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState<string>("ALL");

  // Data states
  const [schedule, setSchedule] = useState<MonthlySchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Branch employees and leaves
  const [branchEmployees, setBranchEmployees] = useState<EmployeeItem[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeItem[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [borrowRequests, setBorrowRequests] = useState<any[]>([]);

  // Modals & Popovers
  const [activeShiftCell, setActiveShiftCell] = useState<{ date: string; empId: string; empName: string } | null>(null);
  const [bulkEmpModal, setBulkEmpModal] = useState<EmployeeItem | null>(null);
  const [showBorrowModal, setShowBorrowModal] = useState<number | null>(null);
  const [borrowSelectedEmp, setBorrowSelectedEmp] = useState<EmployeeItem | null>(null);
  const [borrowDates, setBorrowDates] = useState<string[]>([]);
  const [borrowType, setBorrowType] = useState<"days" | "forever">("days");
  const [borrowShiftTime, setBorrowShiftTime] = useState<string>("Morning");

  // Synchronize branch from Context
  useEffect(() => {
    if (currentBranch === "ola") {
      setActiveBranchId("ola-el-koronfol");
    } else if (currentBranch === "alamein4" || currentBranch === "all") {
      setActiveBranchId("eL-alamein-4");
    }
  }, [currentBranch]);

  // Load Active Branch Employees
  const fetchEmployees = async () => {
    try {
      const [empSnap, cashierSnap] = await Promise.all([
        getDocs(collection(db, "employees")),
        getDocs(collection(db, "cashiers")),
      ]);

      const map = new Map<string, EmployeeItem>();
      const allList: EmployeeItem[] = [];

      empSnap.forEach((d) => {
        const data = d.data();
        const item: EmployeeItem = {
          id: d.id,
          name: data.name || "Unnamed",
          position: data.position || "Staff",
          storeId: data.storeId || "eL-alamein-4",
          branchId: data.branchId || data.storeId,
          shiftTime: data.shiftTime || "Morning",
          status: data.status || "active",
        };
        allList.push(item);
        if (item.status === "active") {
          map.set(item.name.trim().toLowerCase(), item);
        }
      });

      cashierSnap.forEach((d) => {
        const data = d.data();
        const item: EmployeeItem = {
          id: d.id,
          name: data.name || "Unnamed",
          position: data.role || "Cashier",
          storeId: data.storeId || "eL-alamein-4",
          branchId: data.branchId || data.storeId,
          shiftTime: data.shiftType && data.shiftType !== "All" ? data.shiftType : "Morning",
          status: data.isActive !== false ? "active" : "suspended",
        };
        allList.push(item);
        const key = item.name.trim().toLowerCase();
        if (item.status === "active" && !map.has(key)) {
          map.set(key, item);
        }
      });

      setAllEmployees(allList);

      const targetNorm = normalizeBranchId(activeBranchId);
      const filtered = Array.from(map.values()).filter((emp) => {
        const empNorm = normalizeBranchId(emp.storeId || emp.branchId);
        return empNorm === targetNorm;
      }).sort((a, b) => a.name.localeCompare(b.name));

      setBranchEmployees(filtered);
    } catch (e) {
      console.error("Error loading employees", e);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [activeBranchId]);

  // Load Schedule directly from Firestore with fallback to API
  const loadSchedule = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const targetDbStoreId = getDbStoreId(activeBranchId);
      const primaryDocId = `${targetDbStoreId}_${selectedMonth}`;
      
      // 1. Check primary doc in Firestore
      const primarySnap = await getDoc(doc(db, "schedules", primaryDocId));
      if (primarySnap.exists()) {
        setSchedule({ id: primarySnap.id, ...primarySnap.data() } as MonthlySchedule);
        setLoading(false);
        return;
      }

      // 2. Check alias doc in Firestore if storeId differs
      if (activeBranchId !== targetDbStoreId) {
        const aliasSnap = await getDoc(doc(db, "schedules", `${activeBranchId}_${selectedMonth}`));
        if (aliasSnap.exists()) {
          setSchedule({ id: aliasSnap.id, ...aliasSnap.data() } as MonthlySchedule);
          setLoading(false);
          return;
        }
      }

      // 3. Fallback to API endpoint
      const res = await fetch(`/api/schedule?storeId=${activeBranchId}&month=${selectedMonth}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.schedule) {
          setSchedule(data.schedule);
        } else {
          setSchedule(null);
        }
      } else {
        setSchedule(null);
      }
    } catch (err: any) {
      console.warn("Schedule not found or error loading schedule", err);
      setSchedule(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, [activeBranchId, selectedMonth]);

  // Load Leave & Borrow Requests
  useEffect(() => {
    const unsubLeaves = onSnapshot(collection(db, "leave_requests"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setLeaveRequests(list);
    });

    const unsubBorrow = onSnapshot(collection(db, "borrow_requests"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setBorrowRequests(list);
    });

    return () => {
      unsubLeaves();
      unsubBorrow();
    };
  }, []);

  // Deep-strip undefined values so Firestore never sees them
  const sanitizeForFirestore = (obj: any): any => {
    if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
    if (obj !== null && typeof obj === "object") {
      const out: any = {};
      for (const [k, v] of Object.entries(obj)) {
        if (v !== undefined) out[k] = sanitizeForFirestore(v);
      }
      return out;
    }
    return obj;
  };

  // Generate / Initialize Schedule for Branch
  const handleGenerate = async (preserveEdits = false) => {
    setGenerating(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const targetDbStoreId = getDbStoreId(activeBranchId);
      const docId = `${targetDbStoreId}_${selectedMonth}`;

      // Run generator directly with current active branch employees
      const generated = generateSchedule(
        selectedMonth,
        branchEmployees,
        leaveRequests,
        schedule?.rules || {},
        preserveEdits && schedule?.assignments ? schedule.assignments : undefined
      );

      const scheduleData: MonthlySchedule = {
        ...generated,
        storeId: targetDbStoreId,
        branchName: getBranchDisplayName(targetDbStoreId),
        updatedAt: new Date().toISOString(),
      };

      // Save directly to Firestore (sanitize strips undefined fields)
      await setDoc(doc(db, "schedules", docId), sanitizeForFirestore(scheduleData), { merge: true });

      // Save alias doc if branchId differs
      if (activeBranchId !== targetDbStoreId) {
        await setDoc(doc(db, "schedules", `${activeBranchId}_${selectedMonth}`), sanitizeForFirestore(scheduleData), { merge: true }).catch(() => {});
      }

      setSchedule(scheduleData);
      setSuccessMsg(
        preserveEdits
          ? "Schedule updated with active staff roster (existing shifts preserved)!"
          : `Schedule roster initialized for ${getBranchDisplayName(activeBranchId)} with ${branchEmployees.length} active employees!`
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error generating schedule", err);
      setErrorMsg(err.message || "Failed to initialize schedule.");
    } finally {
      setGenerating(false);
    }
  };

  // Save Schedule Changes
  const handleSave = async (publishState?: boolean) => {
    if (!schedule) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const targetDbStoreId = getDbStoreId(activeBranchId);
      const docId = `${targetDbStoreId}_${selectedMonth}`;
      const isPub = publishState !== undefined ? publishState : schedule.isPublished;
      const now = new Date().toISOString();

      const scheduleData: MonthlySchedule = {
        ...schedule,
        storeId: targetDbStoreId,
        branchName: getBranchDisplayName(targetDbStoreId),
        month: selectedMonth,
        isPublished: isPub,
        updatedAt: now,
        publishedAt: isPub ? (schedule.publishedAt || now) : schedule.publishedAt,
      };

      // Save directly to Firestore — sanitize strips undefined fields
      await setDoc(doc(db, "schedules", docId), sanitizeForFirestore(scheduleData), { merge: true });

      if (activeBranchId !== targetDbStoreId) {
        await setDoc(doc(db, "schedules", `${activeBranchId}_${selectedMonth}`), sanitizeForFirestore(scheduleData), { merge: true }).catch(() => {});
      }

      setSchedule(scheduleData);
      setSuccessMsg(
        isPub
          ? "Schedule published! Cashiers can now view their shifts."
          : "Schedule changes saved successfully!"
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Error saving schedule", err);
      setErrorMsg(err.message || "Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  // Publish / Unpublish
  const togglePublish = async () => {
    if (!schedule) return;
    const nextPub = !schedule.isPublished;
    setPublishing(true);
    await handleSave(nextPub);
    setPublishing(false);
  };

  // Update a single shift in state
  const updateShift = (dateStr: string, employeeId: string, shiftTime: string, notes?: string) => {
    if (!schedule) return;
    const targetEmp = scheduledEmployees.find((e) => e.id === employeeId) || branchEmployees.find((e) => e.id === employeeId);
    const targetNormName = targetEmp ? targetEmp.name.trim().toLowerCase() : "";

    const newAssignments = schedule.assignments.map((day) => {
      if (day.date !== dateStr) return day;
      const existingShiftIdx = day.shifts.findIndex(
        (s) => s.employeeId === employeeId || (targetNormName && s.employeeName && s.employeeName.trim().toLowerCase() === targetNormName)
      );

      if (existingShiftIdx !== -1) {
        const newShifts = [...day.shifts];
        newShifts[existingShiftIdx] = {
          ...newShifts[existingShiftIdx],
          shiftTime,
          notes: notes !== undefined ? notes : newShifts[existingShiftIdx].notes,
        };
        return { ...day, shifts: newShifts };
      } else {
        const emp = targetEmp || allEmployees.find((e) => e.id === employeeId);
        return {
          ...day,
          shifts: [
            ...day.shifts,
            {
              employeeId,
              employeeName: emp?.name || "Staff",
              position: emp?.position || "Staff",
              shiftTime,
              notes,
            },
          ],
        };
      }
    });

    setSchedule({ ...schedule, assignments: newAssignments });
  };

  // Bulk set shifts for an employee across the month
  const applyBulkEmployeeShift = (employeeId: string, employeeName: string, shiftTime: string, onlyWeekdays = false) => {
    if (!schedule) return;
    const targetNormName = employeeName.trim().toLowerCase();
    const empInfo = branchEmployees.find((e) => e.id === employeeId || e.name.trim().toLowerCase() === targetNormName) || allEmployees.find((e) => e.id === employeeId || e.name.trim().toLowerCase() === targetNormName);
    const empPos = empInfo?.position || "Staff";
    const canonicalName = empInfo?.name || employeeName;

    const newAssignments = schedule.assignments.map((day) => {
      const dateObj = new Date(day.date);
      const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6; // Fri / Sat
      if (onlyWeekdays && isWeekend) return day;

      const existingIdx = day.shifts.findIndex(
        (s) => s.employeeId === employeeId || (s.employeeName && s.employeeName.trim().toLowerCase() === targetNormName)
      );

      let newShifts = [...day.shifts];
      if (existingIdx !== -1) {
        if (!newShifts[existingIdx].shiftTime.includes("Approved Leave")) {
          newShifts[existingIdx] = {
            ...newShifts[existingIdx],
            shiftTime,
          };
        }
      } else {
        newShifts.push({
          employeeId,
          employeeName: canonicalName,
          position: empPos,
          shiftTime,
        });
      }

      return { ...day, shifts: newShifts };
    });

    setSchedule({ ...schedule, assignments: newAssignments });
    setBulkEmpModal(null);
    setSuccessMsg("Bulk shift applied! Remember to click Save.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Apply pattern (e.g. 6 days work / 1 day off)
  const applyPatternToEmployee = (employeeId: string, employeeName: string, workShift: string, offDayOfWeek: number) => {
    if (!schedule) return;
    const targetNormName = employeeName.trim().toLowerCase();
    const empInfo = branchEmployees.find((e) => e.id === employeeId || e.name.trim().toLowerCase() === targetNormName) || allEmployees.find((e) => e.id === employeeId || e.name.trim().toLowerCase() === targetNormName);
    const empPos = empInfo?.position || "Staff";
    const canonicalName = empInfo?.name || employeeName;

    const newAssignments = schedule.assignments.map((day) => {
      const dateObj = new Date(day.date);
      const isOff = dateObj.getDay() === offDayOfWeek;
      const targetShift = isOff ? "Off" : workShift;

      const existingIdx = day.shifts.findIndex(
        (s) => s.employeeId === employeeId || (s.employeeName && s.employeeName.trim().toLowerCase() === targetNormName)
      );

      let newShifts = [...day.shifts];
      if (existingIdx !== -1) {
        if (!newShifts[existingIdx].shiftTime.includes("Approved Leave")) {
          newShifts[existingIdx] = {
            ...newShifts[existingIdx],
            shiftTime: targetShift,
          };
        }
      } else {
        newShifts.push({
          employeeId,
          employeeName: canonicalName,
          position: empPos,
          shiftTime: targetShift,
        });
      }

      return { ...day, shifts: newShifts };
    });

    setSchedule({ ...schedule, assignments: newAssignments });
    setBulkEmpModal(null);
    setSuccessMsg("Shift pattern applied! Remember to click Save.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Month navigation
  const shiftMonth = (delta: number) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const newM = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newM);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!schedule || !schedule.assignments.length) return;
    const headers = ["Employee", "Position", ...schedule.assignments.map((d) => d.date), "Morning Count", "Noon Count", "Night Count", "Off Count"];
    
    // Get unique employees across schedule
    const empMap = new Map<string, { name: string; position: string }>();
    schedule.assignments.forEach((day) => {
      day.shifts.forEach((s) => {
        if (!empMap.has(s.employeeId)) {
          empMap.set(s.employeeId, { name: s.employeeName, position: s.position || "Staff" });
        }
      });
    });

    const rows: string[][] = [];
    filteredScheduledEmployees.forEach((emp) => {
      const normName = emp.name.trim().toLowerCase();
      let mCount = 0, nCount = 0, ntCount = 0, offCount = 0;
      const dayShifts = schedule.assignments.map((day) => {
        const s = day.shifts.find(
          (x) => x.employeeId === emp.id || (x.employeeName && x.employeeName.trim().toLowerCase() === normName)
        );
        const shift = s ? s.shiftTime : "Off";
        if (shift.includes("Morning")) mCount++;
        else if (shift.includes("Noon")) nCount++;
        else if (shift.includes("Night")) ntCount++;
        else offCount++;
        return `"${shift}"`;
      });
      rows.push([`"${emp.name}"`, `"${emp.position}"`, ...dayShifts, `${mCount}`, `${nCount}`, `${ntCount}`, `${offCount}`]);
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Schedule_${activeBranchId}_${selectedMonth}.csv`;
    a.click();
  };

  // Derived unique employee list in current schedule
  // Deduplicates by BOTH id AND name — employees may appear in both
  // the `employees` and `cashiers` Firestore collections with different
  // document IDs but the same display name. Using a name-keyed secondary
  // map ensures we never show the same person twice in the roster grid.
  const scheduledEmployees = useMemo(() => {
    if (!schedule) return branchEmployees;

    // Primary map: id → entry (built from saved schedule shifts)
    const byId = new Map<string, { id: string; name: string; position: string }>();
    // Secondary dedup map: normalised name → id already in byId
    const byName = new Map<string, string>();

    const addEntry = (id: string, name: string, position: string) => {
      const normName = name.trim().toLowerCase();
      if (byId.has(id)) return; // already added by this id
      if (byName.has(normName)) {
        // Another entry with same name exists — prefer the branchEmployee version
        // (from the `employees` collection) over cashier collection duplicates.
        const existingId = byName.get(normName)!;
        const existing = byId.get(existingId)!;
        // Keep the one whose id matches a branchEmployee (more authoritative)
        const existingIsBranch = branchEmployees.some((b) => b.id === existingId);
        const newIsBranch = branchEmployees.some((b) => b.id === id);
        if (newIsBranch && !existingIsBranch) {
          byId.delete(existingId);
          byName.set(normName, id);
          byId.set(id, { id, name, position });
        }
        return;
      }
      byId.set(id, { id, name, position });
      byName.set(normName, id);
    };

    // First, seed from branchEmployees so they take priority
    branchEmployees.forEach((b) => addEntry(b.id, b.name, b.position || "Staff"));

    // Then fill in any extra people that exist in saved schedule but not in current branchEmployees
    schedule.assignments.forEach((day) => {
      day.shifts.forEach((s) => {
        addEntry(s.employeeId, s.employeeName, s.position || "Staff");
      });
    });

    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [schedule, branchEmployees]);

  // Filtered employees for matrix view
  const filteredScheduledEmployees = useMemo(() => {
    return scheduledEmployees.filter((emp) => {
      if (searchFilter && !emp.name.toLowerCase().includes(searchFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [scheduledEmployees, searchFilter]);

  // Daily totals calculation
  const dailyTotals = useMemo(() => {
    if (!schedule) return {};
    const map: Record<string, { morning: number; noon: number; night: number; off: number; total: number }> = {};
    schedule.assignments.forEach((day) => {
      let m = 0, n = 0, nt = 0, o = 0;
      day.shifts.forEach((s) => {
        if (s.shiftTime.includes("Morning")) m++;
        else if (s.shiftTime.includes("Noon")) n++;
        else if (s.shiftTime.includes("Night")) nt++;
        else o++;
      });
      map[day.date] = { morning: m, noon: n, night: nt, off: o, total: day.shifts.length };
    });
    return map;
  }, [schedule]);

  // Employee Monthly Stats calculation
  const employeeStats = useMemo(() => {
    if (!schedule) return {};
    const map: Record<string, { morning: number; noon: number; night: number; off: number; leave: number; totalDays: number; workedDays: number; hours: number }> = {};
    
    scheduledEmployees.forEach((emp) => {
      map[emp.id] = { morning: 0, noon: 0, night: 0, off: 0, leave: 0, totalDays: 0, workedDays: 0, hours: 0 };
    });

    schedule.assignments.forEach((day) => {
      day.shifts.forEach((s) => {
        const matchingEmp = scheduledEmployees.find(
          (e) => e.id === s.employeeId || (s.employeeName && e.name.trim().toLowerCase() === s.employeeName.trim().toLowerCase())
        );
        const empKey = matchingEmp ? matchingEmp.id : s.employeeId;
        if (!map[empKey]) {
          map[empKey] = { morning: 0, noon: 0, night: 0, off: 0, leave: 0, totalDays: 0, workedDays: 0, hours: 0 };
        }
        map[empKey].totalDays++;
        if (s.shiftTime.includes("Morning")) {
          map[empKey].morning++;
          map[empKey].workedDays++;
          map[empKey].hours += 8;
        } else if (s.shiftTime.includes("Noon")) {
          map[empKey].noon++;
          map[empKey].workedDays++;
          map[empKey].hours += 8;
        } else if (s.shiftTime.includes("Night")) {
          map[empKey].night++;
          map[empKey].workedDays++;
          map[empKey].hours += 8;
        } else if (s.shiftTime.includes("Approved Leave")) {
          map[empKey].leave++;
        } else {
          map[empKey].off++;
        }
      });
    });
    return map;
  }, [schedule, scheduledEmployees]);

  const targetBranchNorm = normalizeBranchId(activeBranchId);
  const pendingLeavesForBranch = leaveRequests.filter(
    (r) => r.status === "pending" && (targetBranchNorm === "all" || normalizeBranchId(r.storeId) === targetBranchNorm)
  );

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 print:bg-white print:text-black print:pb-0">
      
      {/* Top Header */}
      <div className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-4 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl border border-red-500/20">
                <CalendarCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-black tracking-tight flex items-center gap-2">
                  Staff Shift Roster
                  {schedule?.isPublished ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <Globe className="w-3 h-3" /> Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      <Eye className="w-3 h-3" /> Draft
                    </span>
                  )}
                </h1>
                <p className="text-xs text-muted-foreground">
                  Manual branch schedule manager • {getBranchDisplayName(activeBranchId)} ({branchEmployees.length} active staff)
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Branch Switcher */}
            <div className="flex bg-muted/60 p-1 rounded-xl border border-border">
              <button
                onClick={() => {
                  setActiveBranchId("eL-alamein-4");
                  setBranch("alamein4");
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  normalizeBranchId(activeBranchId) === "alamein4"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                El Alamein 4
              </button>
              <button
                onClick={() => {
                  setActiveBranchId("ola-el-koronfol");
                  setBranch("ola");
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  normalizeBranchId(activeBranchId) === "ola"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Ola El Koronfol
              </button>
            </div>

            {/* Month Picker */}
            <div className="flex items-center bg-card border border-border rounded-xl px-2 py-1 shadow-sm">
              <button
                onClick={() => shiftMonth(-1)}
                className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent border-0 text-xs font-bold text-foreground px-2 py-1 outline-none cursor-pointer"
              />
              <button
                onClick={() => shiftMonth(1)}
                className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Print */}
            <button
              onClick={() => window.print()}
              className="p-2 bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border rounded-xl shadow-sm transition-colors"
              title="Print Schedule A4"
            >
              <Printer className="w-4 h-4" />
            </button>

            {/* Export CSV */}
            <button
              onClick={exportToCSV}
              disabled={!schedule}
              className="p-2 bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border rounded-xl shadow-sm transition-colors disabled:opacity-40"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Save Button */}
            <button
              onClick={() => handleSave()}
              disabled={saving || !schedule}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Changes
            </button>

            {/* Publish Toggle Button */}
            <button
              onClick={togglePublish}
              disabled={publishing || !schedule}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 ${
                schedule?.isPublished
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                  : "bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white shadow-red-500/20"
              }`}
            >
              {publishing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : schedule?.isPublished ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {schedule?.isPublished ? "Published (Live)" : "Publish to Staff"}
            </button>
          </div>
        </div>

        {/* Notifications Bar */}
        {successMsg && (
          <div className="max-w-7xl mx-auto mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="max-w-7xl mx-auto mt-3 p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">

        {/* Quick Summary / Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
          
          {/* View Mode Tabs */}
          <div className="flex items-center bg-card border border-border p-1 rounded-2xl shadow-sm">
            <button
              onClick={() => setViewMode("matrix")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === "matrix"
                  ? "bg-red-600 text-white shadow-md shadow-red-500/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="w-4 h-4" />
              Month Matrix Grid
            </button>
            <button
              onClick={() => setViewMode("daily")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === "daily"
                  ? "bg-red-600 text-white shadow-md shadow-red-500/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="w-4 h-4" />
              Daily Rosters
            </button>
            <button
              onClick={() => setViewMode("analytics")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                viewMode === "analytics"
                  ? "bg-red-600 text-white shadow-md shadow-red-500/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="w-4 h-4" />
              Staff Hours & Analytics
            </button>
            <button
              onClick={() => setViewMode("leaves")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
                viewMode === "leaves"
                  ? "bg-red-600 text-white shadow-md shadow-red-500/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              Leaves & Transfers
              {pendingLeavesForBranch.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-black bg-amber-500 text-slate-950 rounded-full">
                  {pendingLeavesForBranch.length}
                </span>
              )}
            </button>
          </div>

          {/* Quick Generate / Refresh Tools */}
          <div className="flex items-center gap-2">
            {!schedule ? (
              <button
                onClick={() => handleGenerate(false)}
                disabled={generating}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-lg shadow-red-500/20 transition-all disabled:opacity-50"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate {getBranchDisplayName(activeBranchId)} Roster
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-2 bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border rounded-xl text-xs font-semibold shadow-sm transition-all"
                  title="Sync any new active employees without overwriting current shifts"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? "animate-spin" : ""}`} />
                  Sync Active Staff
                </button>
                <button
                  onClick={() => {
                    if (confirm("Reset this month to default shifts? Custom manual edits will be re-initialized.")) {
                      handleGenerate(false);
                    }
                  }}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-3 py-2 bg-card hover:bg-red-500/10 text-muted-foreground hover:text-red-500 border border-border rounded-xl text-xs font-semibold shadow-sm transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset Month
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Printable Header */}
        <div className="hidden print:block mb-6 border-b pb-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black text-black">Circle K - Monthly Staff Schedule</h1>
              <p className="text-sm text-gray-600 font-semibold">
                Branch: {getBranchDisplayName(activeBranchId)} • Month: {selectedMonth}
              </p>
            </div>
            <div className="text-right text-xs text-gray-500">
              Printed on {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center p-16 bg-card border border-border rounded-3xl shadow-sm space-y-4">
            <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
            <p className="text-sm font-semibold text-muted-foreground">Loading branch schedule...</p>
          </div>
        )}

        {/* Empty / Uninitialized State */}
        {!loading && !schedule && (
          <div className="flex flex-col items-center justify-center p-12 lg:p-20 bg-card border border-border rounded-3xl text-center space-y-6 shadow-sm">
            <div className="w-16 h-16 bg-red-500/10 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center border border-red-500/20 shadow-inner">
              <Calendar className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-xl font-black">No Schedule Created for {selectedMonth}</h2>
              <p className="text-xs text-muted-foreground">
                Initialize the roster for <strong>{getBranchDisplayName(activeBranchId)}</strong>. All{" "}
                <strong>{branchEmployees.length} active employees</strong> will be populated across the month, and approved leaves will be applied automatically so you can schedule shifts manually.
              </p>
            </div>
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-red-500/25 transition-all"
            >
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate {selectedMonth} Roster ({branchEmployees.length} Staff)
            </button>
          </div>
        )}

        {/* VIEW 1: MATRIX VIEW (Staff vs Month Days) */}
        {!loading && schedule && viewMode === "matrix" && (
          <div className="space-y-4">
            
            {/* Filter & Legend Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3 rounded-2xl shadow-sm print:hidden">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search staff name..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-xl outline-none focus:border-red-500 transition-colors"
                  />
                </div>
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter("")}
                    className="p-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Shift Legend */}
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                <span className="text-muted-foreground mr-1">Shifts:</span>
                {SHIFT_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <span
                      key={opt.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border ${opt.color}`}
                    >
                      <Icon className="w-3 h-3" />
                      {opt.short}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Matrix Table Container */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  
                  {/* Table Header */}
                  <thead>
                    <tr className="bg-muted/60 border-b border-border text-[11px] font-black uppercase text-muted-foreground">
                      <th className="p-3 sticky left-0 z-20 bg-muted/95 backdrop-blur-sm min-w-[180px] max-w-[220px] border-r border-border">
                        Employee ({filteredScheduledEmployees.length})
                      </th>
                      {schedule.assignments.map((day) => {
                        const dateObj = new Date(day.date);
                        const dayNum = dateObj.getDate();
                        const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
                        const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6; // Fri / Sat
                        return (
                          <th
                            key={day.date}
                            className={`p-2 text-center min-w-[58px] border-r border-border/60 ${
                              isWeekend ? "bg-red-500/5 dark:bg-red-500/10 font-black text-red-600 dark:text-red-400" : ""
                            }`}
                          >
                            <div className="text-[10px] opacity-80">{dayName}</div>
                            <div className="text-xs font-black">{dayNum}</div>
                          </th>
                        );
                      })}
                      <th className="p-3 text-center min-w-[120px] bg-muted/95 border-l border-border">
                        Monthly Summary
                      </th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-border">
                    {filteredScheduledEmployees.map((emp) => {
                      const stats = employeeStats[emp.id] || { morning: 0, noon: 0, night: 0, off: 0, leave: 0, hours: 0, workedDays: 0 };
                      return (
                        <tr key={emp.id} className="hover:bg-muted/30 transition-colors group">
                          
                          {/* Staff Column (Sticky Left) */}
                          <td className="p-3 sticky left-0 z-10 bg-card group-hover:bg-muted/60 backdrop-blur-sm border-r border-border">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-foreground truncate">{emp.name}</p>
                                <p className="text-[10px] text-muted-foreground">{emp.position}</p>
                              </div>
                              <button
                                onClick={() => setBulkEmpModal(branchEmployees.find((b) => b.id === emp.id) || (emp as any))}
                                className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg opacity-0 group-hover:opacity-100 transition-all print:hidden"
                                title="Quick Bulk Scheduling"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Day Shift Cells */}
                          {schedule.assignments.map((day) => {
                            const shift = day.shifts.find(
                              (s) => s.employeeId === emp.id || (s.employeeName && s.employeeName.trim().toLowerCase() === emp.name.trim().toLowerCase())
                            );
                            const shiftTime = shift ? shift.shiftTime : "Off";
                            const isLeave = shiftTime.includes("Approved Leave");

                            // Color map
                            let pillStyle = "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
                            let icon = <Coffee className="w-2.5 h-2.5" />;
                            let label = "Off";

                            if (shiftTime.includes("Morning")) {
                              pillStyle = "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40 hover:bg-blue-500/30";
                              icon = <Sunrise className="w-2.5 h-2.5" />;
                              label = "M";
                            } else if (shiftTime.includes("Noon")) {
                              pillStyle = "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/30";
                              icon = <Sun className="w-2.5 h-2.5" />;
                              label = "N";
                            } else if (shiftTime.includes("Night")) {
                              pillStyle = "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40 hover:bg-purple-500/30";
                              icon = <Moon className="w-2.5 h-2.5" />;
                              label = "Nt";
                            } else if (isLeave) {
                              pillStyle = "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40";
                              icon = <CalendarCheck className="w-2.5 h-2.5" />;
                              label = "LV";
                            }

                            return (
                              <td
                                key={day.date}
                                className="p-1 text-center border-r border-border/40 relative cursor-pointer select-none"
                                onClick={() => {
                                  if (isLeave) {
                                    alert(`${emp.name} has approved leave on ${day.date}.`);
                                    return;
                                  }
                                  setActiveShiftCell({
                                    date: day.date,
                                    empId: emp.id,
                                    empName: emp.name,
                                  });
                                }}
                              >
                                <div
                                  className={`mx-auto w-full max-w-[50px] py-1.5 px-1 rounded-lg border text-[11px] font-black flex items-center justify-center gap-1 transition-all ${pillStyle}`}
                                  title={`${emp.name}: ${shiftTime} (${day.date})`}
                                >
                                  {icon}
                                  <span>{label}</span>
                                </div>
                              </td>
                            );
                          })}

                          {/* Employee Stats Column */}
                          <td className="p-2 text-center bg-muted/30 border-l border-border">
                            <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold">
                              <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400" title="Morning Shifts">
                                {stats.morning}M
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400" title="Noon Shifts">
                                {stats.noon}N
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400" title="Night Shifts">
                                {stats.night}Nt
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400" title="Days Off">
                                {stats.off}Off
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 font-semibold">
                              {stats.workedDays} days ({stats.hours} hrs)
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  {/* Daily Headcount Summary Footer */}
                  <tfoot>
                    <tr className="bg-muted/80 font-black border-t-2 border-border text-[10px]">
                      <td className="p-3 sticky left-0 z-20 bg-muted/95 backdrop-blur-sm border-r border-border uppercase">
                        Daily Headcount
                      </td>
                      {schedule.assignments.map((day) => {
                        const counts = dailyTotals[day.date] || { morning: 0, noon: 0, night: 0, off: 0 };
                        return (
                          <td key={day.date} className="p-1.5 text-center border-r border-border/40">
                            <div className="space-y-0.5 text-[9px]">
                              <div className="text-blue-600 dark:text-blue-400 font-black" title="Morning staff count">
                                {counts.morning}M
                              </div>
                              <div className="text-amber-600 dark:text-amber-400 font-black" title="Noon staff count">
                                {counts.noon}N
                              </div>
                              <div className="text-purple-600 dark:text-purple-400 font-black" title="Night staff count">
                                {counts.night}Nt
                              </div>
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-2 text-center text-muted-foreground border-l border-border">
                        Total Roster
                      </td>
                    </tr>
                  </tfoot>

                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: DAILY ROSTER VIEW */}
        {!loading && schedule && viewMode === "daily" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {schedule.assignments.map((day) => {
                const dateObj = new Date(day.date);
                const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
                const counts = dailyTotals[day.date] || { morning: 0, noon: 0, night: 0, off: 0 };

                return (
                  <div key={day.date} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
                    <div className="flex justify-between items-start border-b border-border pb-2.5">
                      <div>
                        <h3 className="font-bold text-sm text-foreground">{dayName}</h3>
                        <p className="text-[11px] text-muted-foreground">{day.shifts.length} assigned staff</p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-black">
                        <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
                          {counts.morning} M
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                          {counts.noon} N
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400">
                          {counts.night} Nt
                        </span>
                      </div>
                    </div>

                    {/* Staff List */}
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                      {day.shifts.map((s) => (
                        <div
                          key={s.employeeId}
                          className="flex items-center justify-between p-2 rounded-xl bg-background border border-border/80 text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold truncate">{s.employeeName}</p>
                            <p className="text-[10px] text-muted-foreground">{s.position || "Staff"}</p>
                          </div>
                          <select
                            value={s.shiftTime}
                            onChange={(e) => updateShift(day.date, s.employeeId, e.target.value)}
                            disabled={s.shiftTime.includes("Approved Leave")}
                            className="text-xs font-bold bg-card border border-border rounded-lg px-2 py-1 outline-none focus:border-red-500 cursor-pointer"
                          >
                            <option value="Morning">🌅 Morning</option>
                            <option value="Noon">☀️ Noon</option>
                            <option value="Night">🌙 Night</option>
                            <option value="Off">🏖️ Off</option>
                            {s.shiftTime.includes("Approved Leave") && (
                              <option value="Off (Approved Leave)">🌴 Leave</option>
                            )}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: STAFF ANALYTICS & HOURS */}
        {!loading && schedule && viewMode === "analytics" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-black mb-1">Staff Workload & Hours Analysis</h2>
              <p className="text-xs text-muted-foreground mb-6">
                Monthly distribution of shifts, working hours, and days off for {getBranchDisplayName(activeBranchId)}.
              </p>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-[11px] font-black uppercase text-muted-foreground bg-muted/40">
                      <th className="p-3">Employee</th>
                      <th className="p-3">Role</th>
                      <th className="p-3 text-center">Morning (08-16)</th>
                      <th className="p-3 text-center">Noon (16-00)</th>
                      <th className="p-3 text-center">Night (00-08)</th>
                      <th className="p-3 text-center">Days Off</th>
                      <th className="p-3 text-center">Approved Leaves</th>
                      <th className="p-3 text-center">Total Shifts</th>
                      <th className="p-3 text-center">Estimated Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {scheduledEmployees.map((emp) => {
                      const stats = employeeStats[emp.id] || { morning: 0, noon: 0, night: 0, off: 0, leave: 0, hours: 0, workedDays: 0 };
                      return (
                        <tr key={emp.id} className="hover:bg-muted/30">
                          <td className="p-3 font-bold">{emp.name}</td>
                          <td className="p-3 text-muted-foreground">{emp.position}</td>
                          <td className="p-3 text-center font-semibold text-blue-600 dark:text-blue-400">{stats.morning}</td>
                          <td className="p-3 text-center font-semibold text-amber-600 dark:text-amber-400">{stats.noon}</td>
                          <td className="p-3 text-center font-semibold text-purple-600 dark:text-purple-400">{stats.night}</td>
                          <td className="p-3 text-center font-semibold text-slate-500">{stats.off}</td>
                          <td className="p-3 text-center font-semibold text-emerald-600">{stats.leave}</td>
                          <td className="p-3 text-center font-black">{stats.workedDays}</td>
                          <td className="p-3 text-center font-black text-red-600 dark:text-red-400">
                            {stats.hours} hrs
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: LEAVES & TRANSFERS */}
        {!loading && viewMode === "leaves" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Leave Requests */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Staff Time-Off Requests</h3>
                    <p className="text-[11px] text-muted-foreground">Approve or reject leave requests from cashiers</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {leaveRequests.filter((r) => targetBranchNorm === "all" || normalizeBranchId(r.storeId) === targetBranchNorm).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs font-semibold">
                    No leave requests found for this branch.
                  </div>
                ) : (
                  leaveRequests
                    .filter((r) => targetBranchNorm === "all" || normalizeBranchId(r.storeId) === targetBranchNorm)
                    .map((req) => (
                      <div key={req.id} className="p-3.5 rounded-xl bg-background border border-border space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-xs">{req.employeeName}</p>
                            <p className="text-[11px] text-muted-foreground">{req.date} • {req.type || "Time Off"}</p>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              req.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-600"
                                : req.status === "rejected"
                                ? "bg-red-500/15 text-red-600"
                                : "bg-amber-500/15 text-amber-600"
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>

                        {req.status === "pending" && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={async () => {
                                try {
                                  await fetch("/api/schedule/leave-requests", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ requestId: req.id, status: "approved" }),
                                  });
                                  // Auto-update schedule cell if loaded
                                  if (schedule) {
                                    updateShift(req.date, req.employeeId, "Off (Approved Leave)");
                                  }
                                  alert("Leave request approved and assigned as Off on schedule!");
                                } catch (e) {
                                  alert("Failed to update status");
                                }
                              }}
                              className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  await fetch("/api/schedule/leave-requests", {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ requestId: req.id, status: "rejected" }),
                                  });
                                } catch (e) {
                                  alert("Failed to reject");
                                }
                              }}
                              className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Cross-Branch Staff Requests */}
            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 text-blue-600 rounded-xl">
                    <ArrowRightLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Cross-Branch Staff Borrowing</h3>
                    <p className="text-[11px] text-muted-foreground">Borrow or transfer employees across branches</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBorrowModal(0)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  + Request Staff
                </button>
              </div>

              <div className="space-y-3">
                {borrowRequests.filter((r) => normalizeBranchId(r.targetStoreId) === targetBranchNorm || normalizeBranchId(r.sourceStoreId) === targetBranchNorm).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs font-semibold">
                    No active borrow or transfer requests.
                  </div>
                ) : (
                  borrowRequests
                    .filter((r) => normalizeBranchId(r.targetStoreId) === targetBranchNorm || normalizeBranchId(r.sourceStoreId) === targetBranchNorm)
                    .map((req) => (
                      <div key={req.id} className="p-3.5 rounded-xl bg-background border border-border space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-xs">{req.employeeName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              From: {getBranchDisplayName(req.sourceStoreId)} → To: {getBranchDisplayName(req.targetStoreId)}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              req.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-600"
                                : req.status === "rejected"
                                ? "bg-red-500/15 text-red-600"
                                : "bg-amber-500/15 text-amber-600"
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        {req.dates && req.dates.length > 0 && (
                          <p className="text-[11px] text-muted-foreground">Dates: {req.dates.join(", ")}</p>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* QUICK SHIFT SELECTOR POPOVER / MODAL */}
      {activeShiftCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-sm rounded-3xl shadow-2xl border border-border p-5 space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-sm text-foreground">{activeShiftCell.empName}</h3>
                <p className="text-xs text-muted-foreground">Change shift for {activeShiftCell.date}</p>
              </div>
              <button
                onClick={() => setActiveShiftCell(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {SHIFT_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      updateShift(activeShiftCell.date, activeShiftCell.empId, opt.id);
                      setActiveShiftCell(null);
                    }}
                    className={`flex items-center gap-3 p-3 rounded-2xl border text-xs font-bold transition-all text-left ${opt.color} hover:scale-[1.02]`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* BULK EMPLOYEE SCHEDULING MODAL */}
      {bulkEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border p-6 space-y-5 animate-in zoom-in-95">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-base text-foreground">Quick Schedule: {bulkEmpModal.name}</h3>
                <p className="text-xs text-muted-foreground">Bulk assign shifts across {selectedMonth}</p>
              </div>
              <button
                onClick={() => setBulkEmpModal(null)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase text-muted-foreground mb-2">1. Fill All Days of Month</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => applyBulkEmployeeShift(bulkEmpModal.id, bulkEmpModal.name, "Morning")}
                    className="p-2.5 bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold hover:bg-blue-500/25"
                  >
                    🌅 All Morning
                  </button>
                  <button
                    onClick={() => applyBulkEmployeeShift(bulkEmpModal.id, bulkEmpModal.name, "Noon")}
                    className="p-2.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold hover:bg-amber-500/25"
                  >
                    ☀️ All Noon
                  </button>
                  <button
                    onClick={() => applyBulkEmployeeShift(bulkEmpModal.id, bulkEmpModal.name, "Night")}
                    className="p-2.5 bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold hover:bg-purple-500/25"
                  >
                    🌙 All Night
                  </button>
                  <button
                    onClick={() => applyBulkEmployeeShift(bulkEmpModal.id, bulkEmpModal.name, "Off")}
                    className="p-2.5 bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30 rounded-xl text-xs font-bold hover:bg-slate-500/25"
                  >
                    🏖️ All Off
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs font-black uppercase text-muted-foreground mb-2">2. Standard Weekly Pattern (6 Work / 1 Off)</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => applyPatternToEmployee(bulkEmpModal.id, bulkEmpModal.name, "Morning", 5)} // Off on Friday
                    className="p-2.5 bg-card border border-border rounded-xl text-xs font-bold hover:bg-muted text-left"
                  >
                    Morning (Friday Off)
                  </button>
                  <button
                    onClick={() => applyPatternToEmployee(bulkEmpModal.id, bulkEmpModal.name, "Morning", 0)} // Off on Sunday
                    className="p-2.5 bg-card border border-border rounded-xl text-xs font-bold hover:bg-muted text-left"
                  >
                    Morning (Sunday Off)
                  </button>
                  <button
                    onClick={() => applyPatternToEmployee(bulkEmpModal.id, bulkEmpModal.name, "Night", 5)} // Off on Friday
                    className="p-2.5 bg-card border border-border rounded-xl text-xs font-bold hover:bg-muted text-left"
                  >
                    Night (Friday Off)
                  </button>
                  <button
                    onClick={() => applyPatternToEmployee(bulkEmpModal.id, bulkEmpModal.name, "Night", 1)} // Off on Monday
                    className="p-2.5 bg-card border border-border rounded-xl text-xs font-bold hover:bg-muted text-left"
                  >
                    Night (Monday Off)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CROSS-BRANCH BORROW MODAL */}
      {showBorrowModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-md rounded-3xl shadow-2xl border border-border p-6 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-black text-base">Request Staff Borrowing / Transfer</h3>
                <p className="text-xs text-muted-foreground">Request an employee from another branch</p>
              </div>
              <button onClick={() => setShowBorrowModal(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Request Type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setBorrowType("days")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                      borrowType === "days" ? "bg-blue-500/20 text-blue-600 border-blue-500/40" : "bg-card border-border"
                    }`}
                  >
                    Temporary Borrow
                  </button>
                  <button
                    onClick={() => setBorrowType("forever")}
                    className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                      borrowType === "forever" ? "bg-purple-500/20 text-purple-600 border-purple-500/40" : "bg-card border-border"
                    }`}
                  >
                    Permanent Transfer
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Select Employee</label>
                <select
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold focus:border-red-500 outline-none"
                  onChange={(e) => {
                    const emp = allEmployees.find((x) => x.id === e.target.value);
                    setBorrowSelectedEmp(emp || null);
                  }}
                  value={borrowSelectedEmp?.id || ""}
                >
                  <option value="">-- Choose an employee --</option>
                  {allEmployees
                    .filter((emp) => normalizeBranchId(emp.branchId || emp.storeId) !== targetBranchNorm)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({getBranchDisplayName(emp.branchId || emp.storeId)})
                      </option>
                    ))}
                </select>
              </div>

              {borrowType === "days" && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">Shift Time</label>
                  <select
                    value={borrowShiftTime}
                    onChange={(e) => setBorrowShiftTime(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold focus:border-red-500 outline-none"
                  >
                    <option value="Morning">🌅 Morning</option>
                    <option value="Noon">☀️ Noon</option>
                    <option value="Night">🌙 Night</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowBorrowModal(null)}
                className="flex-1 py-2 bg-muted text-foreground rounded-xl text-xs font-bold hover:bg-muted/80"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!borrowSelectedEmp) return;
                  try {
                    await addDoc(collection(db, "borrow_requests"), {
                      type: borrowType,
                      employeeId: borrowSelectedEmp.id,
                      employeeName: borrowSelectedEmp.name,
                      sourceStoreId: borrowSelectedEmp.branchId || borrowSelectedEmp.storeId || "Unknown",
                      targetStoreId: activeBranchId,
                      shiftTime: borrowShiftTime,
                      status: "pending",
                      createdAt: new Date().toISOString(),
                    });
                    alert("Borrow request sent successfully to the branch manager!");
                    setShowBorrowModal(null);
                  } catch (e) {
                    alert("Failed to submit borrow request");
                  }
                }}
                disabled={!borrowSelectedEmp}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
