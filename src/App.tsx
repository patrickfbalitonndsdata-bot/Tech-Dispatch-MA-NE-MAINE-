import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { CsvUploadZone } from "./components/CsvUploadZone";
import { ColumnMappingModal } from "./components/ColumnMappingModal";
import { OutlookEmailPreview } from "./components/OutlookEmailPreview";
import { DispatchHistoryModal } from "./components/DispatchHistoryModal";
import { SettingsBrandingModal } from "./components/SettingsBrandingModal";
import { AdditionalNotesModal } from "./components/AdditionalNotesModal";
import { AttachmentManagerModal } from "./components/AttachmentManagerModal";
import { SavedEmailHistoryModal } from "./components/SavedEmailHistoryModal";
import { SavedHistoryTab } from "./components/SavedHistoryTab";
import { parseCsvData, extractProjectNumber, formatTechnicianFullName } from "./utils/csvParser";
import { SAMPLE_DATASETS, SampleDataset } from "./utils/sampleData";
import {
  ColumnMapping,
  ParseResult,
  TechnicianRoster,
  TemplateBranding,
  DispatchLogRecord,
  WorkOrder,
  EmailAttachment,
  SavedEmailRecord,
} from "./types";
import {
  DEFAULT_BRANDING,
  DEFAULT_PRESET_NOTES,
  getWeekDateRange,
  getWorkWeekOptions,
  filterOrdersForScheduleOverlap,
} from "./utils/outlookTemplateGenerator";
import { DEFAULT_TECHNICIAN_ROSTER, resolveTechnicianAirtableUrl } from "./utils/technicianRosterData";
import {
  getSavedEmails,
  loadSavedEmailsFromDb,
  createSavedEmailRecord,
  saveEmailRecord,
  saveAllRostersToHistory,
  updateSavedEmailTag,
  deleteSavedEmail,
  clearAllSavedEmails,
  computeNextVersionInfo,
  getWorkWeekKey,
  findHistoryAttachmentsForTech,
} from "./utils/savedEmailStorage";
import {
  safeSetLocalStorage,
  sanitizeBrandingForLocalStorage,
  cleanBloatedLocalStorage,
  storeAttachmentsInDb,
  getAllAttachmentsFromDb,
} from "./utils/storageDb";
import { Mail, Sparkles, StickyNote, Sliders, RefreshCw, Paperclip, Bookmark, History, Trash2, Check, Filter, CalendarDays, FileX, ClipboardList } from "lucide-react";

export default function App() {
  // 1. CSV Data & Parsing State (Default to empty on initial visit / refresh)
  const [csvContent, setCsvContent] = useState<string>("");
  const [currentFileName, setCurrentFileName] = useState<string>("");
  const [customMapping, setCustomMapping] = useState<Partial<ColumnMapping>>({});

  // 2. Parsed Result
  const parseResult: ParseResult = useMemo(() => {
    return parseCsvData(csvContent, customMapping);
  }, [csvContent, customMapping]);

  // Extract unique project numbers for scoped note targeting
  const availableProjects = useMemo(() => {
    const set = new Set<string>();
    parseResult.orders.forEach((o) => {
      const proj = o.projectNumber || (o.locationId ? extractProjectNumber(o.locationId) : extractProjectNumber(o.orderNumber));
      if (proj && proj.trim()) set.add(proj.trim());
    });
    return Array.from(set).sort();
  }, [parseResult.orders]);

  // 3. Date Selection ("all" for full week or specific date)
  const [selectedDate, setSelectedDate] = useState<string>("all");

  useEffect(() => {
    if (parseResult.detectedDates.length > 0) {
      if (selectedDate !== "all" && !parseResult.detectedDates.includes(selectedDate)) {
        setSelectedDate("all");
      }
    }
  }, [parseResult.detectedDates, selectedDate]);

  // 4. Template Branding Settings
  const [branding, setBranding] = useState<TemplateBranding>(() => {
    const saved = localStorage.getItem("techdispatch_branding");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.additionalNotes)) {
          let updatedNotes: any[] = [];
          for (const n of parsed.additionalNotes) {
            if (n.id === "preset_tmc_atr_install" || n.autoTriggerType === "tmc_atr_install") {
              const tmcPreset = DEFAULT_PRESET_NOTES.find((d) => d.id === "preset_tmc_install");
              const algPreset = DEFAULT_PRESET_NOTES.find((d) => d.id === "preset_alg_atr_install");
              if (tmcPreset && !parsed.additionalNotes.some((b: any) => b.id === tmcPreset.id)) {
                updatedNotes.push({ ...tmcPreset, enabled: n.enabled ?? true });
              }
              if (algPreset && !parsed.additionalNotes.some((b: any) => b.id === algPreset.id)) {
                updatedNotes.push({ ...algPreset, enabled: n.enabled ?? true });
              }
            } else {
              updatedNotes.push(n);
            }
          }
          for (const d of DEFAULT_PRESET_NOTES) {
            if (!updatedNotes.some((u) => u.id === d.id)) {
              updatedNotes.push(d);
            }
          }
          parsed.additionalNotes = updatedNotes;
        }

        // Ensure default technician roster Airtable links are present
        if (!parsed.technicianAirtableLinks || !Array.isArray(parsed.technicianAirtableLinks) || parsed.technicianAirtableLinks.length === 0) {
          parsed.technicianAirtableLinks = DEFAULT_TECHNICIAN_ROSTER;
        }

        return {
          ...DEFAULT_BRANDING,
          ...parsed,
          useAnytimeTeardowns: true,
        };
      } catch (e) {
        return DEFAULT_BRANDING;
      }
    }
    return DEFAULT_BRANDING;
  });

  const handleSaveBranding = (newBranding: TemplateBranding) => {
    setBranding(newBranding);

    // 1. Asynchronously persist full attachments into IndexedDB (unlimited quota)
    if (newBranding.attachments && newBranding.attachments.length > 0) {
      storeAttachmentsInDb(newBranding.attachments).catch((err) => {
        console.warn("[StorageDb] Could not store attachments in DB:", err);
      });
    }

    // 2. Sanitize branding to strip base64 payloads before writing to localStorage
    const sanitized = sanitizeBrandingForLocalStorage(newBranding);
    safeSetLocalStorage("techdispatch_branding", JSON.stringify(sanitized));
  };

  // 5. Work Week Options (Current vs. Incoming vs. detected weeks)
  const workWeekOptions = useMemo(() => {
    return getWorkWeekOptions(parseResult.orders, branding);
  }, [parseResult.orders, branding]);

  const activeWorkWeek = useMemo(() => {
    const currentSel = branding.selectedWorkWeek || "current";
    return workWeekOptions.find((w) => w.id === currentSel) || workWeekOptions[0];
  }, [workWeekOptions, branding.selectedWorkWeek]);

  // Overall schedule overlap statistics across all orders
  const overlapStats = useMemo(() => {
    if (!branding.enableScheduleOverlap || parseResult.orders.length === 0 || !activeWorkWeek) {
      return { activeCount: parseResult.orders.length, excludedCount: 0 };
    }
    const weekInfo = getWeekDateRange(activeWorkWeek.sundayStr, branding);
    const { activeOrders, excludedOrders } = filterOrdersForScheduleOverlap(
      parseResult.orders,
      weekInfo,
      branding
    );
    return {
      activeCount: activeOrders.length,
      excludedCount: excludedOrders.length,
    };
  }, [branding, parseResult.orders, activeWorkWeek]);

  // 6. Group Work Orders by Technician (automatically read from Technicians column)
  const technicianRosters: TechnicianRoster[] = useMemo(() => {
    if (parseResult.orders.length === 0) return [];

    const dateOrders =
      selectedDate === "all" || !selectedDate
        ? parseResult.orders
        : parseResult.orders.filter((o) => o.date === selectedDate);

    const techMap = new Map<string, WorkOrder[]>();

    dateOrders.forEach((order) => {
      const techName = formatTechnicianFullName(order.technicianName || "Unassigned Technician");
      const existing = techMap.get(techName) || [];
      existing.push(order);
      techMap.set(techName, existing);
    });

    const rosters: TechnicianRoster[] = [];
    techMap.forEach((orders, techName) => {
      const email = orders[0]?.technicianEmail || `${techName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@ndsdata.com`;
      const urgentCount = orders.filter((o) => o.priority === "Urgent").length;
      const highCount = orders.filter((o) => o.priority === "High").length;
      const normalCount = orders.filter((o) => o.priority === "Normal" || o.priority === "Low").length;
      const totalEstimatedMinutes = orders.reduce((sum, o) => sum + (o.estimatedDurationMin || 60), 0);
      const airtableUrl = resolveTechnicianAirtableUrl(techName, branding);

      rosters.push({
        technicianName: techName,
        technicianEmail: email,
        airtableUrl,
        date: selectedDate === "all" ? (activeWorkWeek ? activeWorkWeek.sundayStr : (parseResult.detectedDates[0] || new Date().toISOString().split("T")[0])) : selectedDate,
        orders,
        totalEstimatedMinutes,
        urgentCount,
        highCount,
        normalCount,
      });
    });

    return rosters.sort((a, b) => b.urgentCount - a.urgentCount || a.technicianName.localeCompare(b.technicianName));
  }, [parseResult.orders, selectedDate, parseResult.detectedDates, branding, activeWorkWeek]);

  // 6. Saved Email History (Stored in localStorage per technician + work week)
  const [savedEmails, setSavedEmails] = useState<SavedEmailRecord[]>(() => getSavedEmails());
  const [savedHistoryModalOpen, setSavedHistoryModalOpen] = useState(false);
  const [batchSaveFeedback, setBatchSaveFeedback] = useState(false);

  const handleSaveTechnicianEmail = useCallback(
    (roster: TechnicianRoster, customTag?: string) => {
      const record = createSavedEmailRecord(roster, branding, customTag, savedEmails);
      const updated = saveEmailRecord(record);
      setSavedEmails(updated);
    },
    [branding, savedEmails]
  );

  const handleSaveAllToHistory = useCallback(() => {
    if (technicianRosters.length === 0) return;
    const { updatedList } = saveAllRostersToHistory(technicianRosters, branding);
    setSavedEmails(updatedList);
    setBatchSaveFeedback(true);
    setTimeout(() => setBatchSaveFeedback(false), 3000);
  }, [technicianRosters, branding]);

  const handleUpdateSavedTag = useCallback((id: string, newTag: string) => {
    const updated = updateSavedEmailTag(id, newTag);
    setSavedEmails(updated);
  }, []);

  const handleDeleteSavedEmail = useCallback((id: string) => {
    const updated = deleteSavedEmail(id);
    setSavedEmails(updated);
  }, []);

  const handleClearAllSaved = useCallback(() => {
    const updated = clearAllSavedEmails();
    setSavedEmails(updated);
  }, []);

  // Hydrate full saved emails and full attachments from IndexedDB on startup,
  // and proactively purge any bloated legacy keys from localStorage to prevent QuotaExceededError
  useEffect(() => {
    cleanBloatedLocalStorage();

    // Hydrate complete saved emails from IndexedDB
    loadSavedEmailsFromDb().then((records) => {
      if (records && records.length > 0) {
        setSavedEmails(records);
      }
    });

    // Hydrate complete attachment files (base64/dataUrl) into branding state
    getAllAttachmentsFromDb().then((dbAtts) => {
      if (dbAtts && dbAtts.length > 0) {
        setBranding((prev) => {
          const existing = prev.attachments || [];
          const merged = [...existing];
          dbAtts.forEach((dbAtt) => {
            const idx = merged.findIndex((a) => a.id === dbAtt.id);
            if (idx >= 0) {
              if (!merged[idx].dataBase64 && dbAtt.dataBase64) {
                merged[idx] = {
                  ...merged[idx],
                  dataBase64: dbAtt.dataBase64,
                  dataUrl: dbAtt.dataUrl,
                };
              }
            } else {
              merged.push(dbAtt);
            }
          });
          return { ...prev, attachments: merged };
        });
      }
    });
  }, []);

  // Active top-level Tab: "generator" (Main Schedule Generator) or "history" (Saved Email History View)
  const [activeTab, setActiveTab] = useState<"generator" | "history">("generator");

  // Auto-prefill attachments from saved email history for technicians on matching work week
  useEffect(() => {
    if (technicianRosters.length === 0) return;

    setBranding((prevBranding) => {
      const existingAtts = prevBranding.attachments || [];
      let updatedAtts = [...existingAtts];
      let hasChanges = false;

      technicianRosters.forEach((roster) => {
        const { key: workWeekKey } = getWorkWeekKey(roster.date, prevBranding);
        const techName = roster.technicianName.trim().toLowerCase();

        // Check if this technician already has attachments in current session
        const alreadyHasTechAtts = updatedAtts.some(
          (a) =>
            a.technicianScope &&
            a.technicianScope !== "all" &&
            a.technicianScope.trim().toLowerCase() === techName
        );

        // If nothing set for this technician, look up history on the same work week
        if (!alreadyHasTechAtts) {
          const historyAtts = findHistoryAttachmentsForTech(
            roster.technicianName,
            workWeekKey,
            savedEmails
          );

          if (historyAtts && historyAtts.length > 0) {
            historyAtts.forEach((att) => {
              const isDuplicate = updatedAtts.some((a) => a.id === att.id);
              if (!isDuplicate) {
                updatedAtts.push({
                  ...att,
                  technicianScope: roster.technicianName,
                });
                hasChanges = true;
              }
            });
          }
        }
      });

      if (hasChanges) {
        return {
          ...prevBranding,
          attachments: updatedAtts,
        };
      }
      return prevBranding;
    });
  }, [technicianRosters, savedEmails]);

  // 7. Clear Functionality (Clears uploaded CSV and generated email previews)
  const handleClear = () => {
    setCsvContent("");
    setCurrentFileName("");
    setCustomMapping({});
    setSelectedDate("all");
    setBranding((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((a) => a.technicianScope === "all"),
    }));
  };

  // 8. Dispatch Logs State
  const [dispatchLogs, setDispatchLogs] = useState<DispatchLogRecord[]>(() => {
    const saved = localStorage.getItem("techdispatch_logs");
    return saved ? JSON.parse(saved) : [];
  });

  const handleRecordDispatch = useCallback((roster: TechnicianRoster, method: any, status: any) => {
    const weekInfo = getWeekDateRange(roster.date, branding);
    const newLog: DispatchLogRecord = {
      id: "log-" + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      technicianName: roster.technicianName,
      technicianEmail: roster.technicianEmail,
      date: roster.date,
      jobCount: roster.orders.length,
      status: status,
      method: method,
      previewSubject: `${roster.technicianName} | ${weekInfo.formattedRange}`,
      notes: `Export via ${method}`,
    };

    setDispatchLogs((prev) => {
      const updated = [newLog, ...prev.slice(0, 49)];
      safeSetLocalStorage("techdispatch_logs", JSON.stringify(updated));
      return updated;
    });

    fetch("/api/dispatch/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logs: [newLog] }),
    }).catch((e) => console.error(e));
  }, [branding]);

  const handleClearLogs = () => {
    setDispatchLogs([]);
    localStorage.removeItem("techdispatch_logs");
    fetch("/api/dispatch/logs", { method: "DELETE" }).catch((e) => console.error(e));
  };

  // 9. Modal States
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);

  // File Upload Handler
  const handleFileUpload = (content: string, fileName: string) => {
    setCsvContent(content);
    setCurrentFileName(fileName);
    setCustomMapping({});
    setBranding((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((a) => a.technicianScope === "all"),
    }));
    setActiveTab("generator");
  };

  const handleLoadSample = (sample: SampleDataset) => {
    setCsvContent(sample.csvContent);
    setCurrentFileName(`${sample.name.replace(/[^a-zA-Z0-9]/g, "_")}.csv`);
    setCustomMapping({});
    setBranding((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((a) => a.technicianScope === "all"),
    }));
    setActiveTab("generator");
  };

  const activeNotesCount = (branding.additionalNotes || []).filter((p) => p.enabled).length;
  const attachmentsCount = (branding.attachments || []).length;

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1A1A1A] font-sans flex flex-col antialiased selection:bg-zinc-900 selection:text-white">
      {/* Top Main Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLoadSample={(sample) => {
          handleLoadSample(sample);
          setActiveTab("generator");
        }}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenSavedHistory={() => setActiveTab("history")}
        savedEmailsCount={savedEmails.length}
        activeDatasetName={currentFileName}
        totalOrdersCount={parseResult.orders.length}
        techniciansCount={technicianRosters.length}
      />

      {/* Main App Container */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 flex-1">
        {activeTab === "history" ? (
          <SavedHistoryTab
            savedEmails={savedEmails}
            onUpdateTag={handleUpdateSavedTag}
            onDeleteEmail={handleDeleteSavedEmail}
            onClearAll={handleClearAllSaved}
            onSwitchToGenerator={() => setActiveTab("generator")}
          />
        ) : (
          <>
            {/* CSV Dropzone Card */}
            <CsvUploadZone
              onFileUpload={handleFileUpload}
              onLoadSample={handleLoadSample}
              parseResult={parseResult}
              currentFileName={currentFileName}
              onOpenMappingModal={() => setMappingModalOpen(true)}
              onClear={handleClear}
            />

        {/* Technician Outlook Email Template Views */}
        {technicianRosters.length > 0 ? (
          <div className="space-y-6">
            {/* Quick Dispatch Controls Bar */}
            <div className="bg-white border border-zinc-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Technician Schedules ({technicianRosters.length})
                </span>
                <button
                  onClick={handleClear}
                  className="inline-flex items-center space-x-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-md border border-transparent hover:border-red-200 transition cursor-pointer"
                  title="Clear current generated emails and CSV file"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Save All to History Button */}
                <button
                  onClick={handleSaveAllToHistory}
                  className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition shadow-xs cursor-pointer ${
                    batchSaveFeedback
                      ? "bg-emerald-600 text-white border-emerald-700"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-950 border-amber-300 hover:border-amber-400"
                  }`}
                  title="Save all generated technician emails to local history with auto-version tags"
                >
                  {batchSaveFeedback ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-white" />
                      <span>Saved All {technicianRosters.length} Emails!</span>
                    </>
                  ) : (
                    <>
                      <Bookmark className="w-3.5 h-3.5 text-amber-700" />
                      <span>Save All ({technicianRosters.length}) to History</span>
                    </>
                  )}
                </button>

                {/* No Schedule Notes Toggle */}
                <div className="flex items-center space-x-2 bg-rose-50/70 border border-rose-300/80 px-3 py-1.5 rounded-lg">
                  <FileX className="w-3.5 h-3.5 text-rose-700" />
                  <span className="text-xs font-medium text-zinc-800">No Schedule Notes:</span>
                  <button
                    onClick={() =>
                      handleSaveBranding({
                        ...branding,
                        disableScheduleNotes: !branding.disableScheduleNotes,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden cursor-pointer ${
                      branding.disableScheduleNotes ? "bg-rose-600" : "bg-zinc-300"
                    }`}
                    title="Do not add notes from the <Schedule Notes> column to the locations in the email"
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        branding.disableScheduleNotes ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-xs font-bold text-zinc-900">
                    {branding.disableScheduleNotes ? "ON (Omit)" : "Off"}
                  </span>
                </div>

                {/* Schedule Overlap Toggle & Work Week Dropdown Picker */}
                <div className="flex flex-wrap items-center gap-2.5 bg-emerald-50/80 border border-emerald-300/90 px-3 py-1.5 rounded-lg shadow-xs">
                  <div className="flex items-center space-x-2">
                    <Filter className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-xs font-semibold text-zinc-800">Schedule Overlap:</span>
                    <button
                      onClick={() =>
                        handleSaveBranding({
                          ...branding,
                          enableScheduleOverlap: !branding.enableScheduleOverlap,
                        })
                      }
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden cursor-pointer ${
                        branding.enableScheduleOverlap ? "bg-emerald-600" : "bg-zinc-300"
                      }`}
                      title="Disregard and exclude schedules with dates outside the selected work week"
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          branding.enableScheduleOverlap ? "translate-x-4" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-xs font-bold text-zinc-900">
                      {branding.enableScheduleOverlap ? "Active" : "Off"}
                    </span>
                  </div>

                  {/* Work Week Dropdown Picker */}
                  <div className="flex items-center space-x-1.5 pl-2 border-l border-emerald-300">
                    <CalendarDays className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="text-xs font-semibold text-emerald-950">Work Week:</span>
                    <select
                      value={branding.selectedWorkWeek || "current"}
                      onChange={(e) => {
                        const nextWeek = e.target.value;
                        handleSaveBranding({
                          ...branding,
                          selectedWorkWeek: nextWeek,
                        });
                      }}
                      className="text-xs font-semibold bg-white border border-emerald-300 rounded-md px-2.5 py-1 text-emerald-950 shadow-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                      title="Select which work week to generate schedule for"
                    >
                      {workWeekOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.fullLabel}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Excluded overlap counter badge */}
                  {branding.enableScheduleOverlap && overlapStats.excludedCount > 0 && (
                    <span
                      className="text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full border border-emerald-300"
                      title={`${overlapStats.excludedCount} job(s) from outside the selected work week are excluded from dispatch emails`}
                    >
                      {overlapStats.excludedCount} excluded
                    </span>
                  )}
                </div>

                {/* Sun - Sun (8-Day View) Toggle */}
                <div className="flex items-center space-x-2 bg-indigo-50/70 border border-indigo-300/80 px-3 py-1.5 rounded-lg">
                  <CalendarDays className="w-3.5 h-3.5 text-indigo-700" />
                  <span className="text-xs font-medium text-zinc-800">Sun - Sun:</span>
                  <button
                    onClick={() =>
                      handleSaveBranding({
                        ...branding,
                        enableSunSunView: !branding.enableSunSunView,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden cursor-pointer ${
                      branding.enableSunSunView ? "bg-indigo-600" : "bg-zinc-300"
                    }`}
                    title="Add dated Sunday at the top and another dated Sunday at the bottom"
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        branding.enableSunSunView ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-xs font-bold text-zinc-900">
                    {branding.enableSunSunView ? "8-Day (Dated)" : "Off"}
                  </span>
                </div>

                {/* Conduct Study Toggle */}
                <div className="flex items-center space-x-2 bg-purple-500/10 border border-purple-300/80 px-3 py-1.5 rounded-lg">
                  <ClipboardList className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs font-medium text-zinc-800">Conduct Study:</span>
                  <button
                    onClick={() =>
                      handleSaveBranding({
                        ...branding,
                        enableConductStudy: !branding.enableConductStudy,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden cursor-pointer ${
                      branding.enableConductStudy ? "bg-purple-600" : "bg-zinc-300"
                    }`}
                    title="Toggle Conduct Study formatting (both Install and Teardown lines formatted as Conduct <Study>, e.g. Conduct Parking Inventory: 26-410095 New Britain, CT PKG with Preset Note #9 auto-injected)"
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        branding.enableConductStudy ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-xs font-bold text-zinc-900">
                    {branding.enableConductStudy
                      ? (branding.conductStudyProjects && branding.conductStudyProjects.length > 0
                          ? `ON (${branding.conductStudyProjects.length} Proj)`
                          : "ON (All)")
                      : "OFF"}
                  </span>
                </div>

                {/* Email Update Toggle */}
                <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-300/80 px-3 py-1.5 rounded-lg">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-medium text-zinc-800">Email Update:</span>
                  <button
                    onClick={() =>
                      handleSaveBranding({
                        ...branding,
                        enableEmailUpdate: !branding.enableEmailUpdate,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-hidden cursor-pointer ${
                      branding.enableEmailUpdate ? "bg-amber-500" : "bg-zinc-300"
                    }`}
                    title="Toggle Email Update banner and subject suffix"
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        branding.enableEmailUpdate ? "translate-x-4" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span className="text-xs font-bold text-zinc-900">
                    {branding.enableEmailUpdate
                      ? `ON (v${branding.emailUpdateVersion || "2"})`
                      : "OFF"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {technicianRosters.map((roster) => {
                const { key: workWeekKey } = getWorkWeekKey(roster.date, branding);
                const versionInfo = computeNextVersionInfo(roster.technicianName, workWeekKey, savedEmails);
                const techWeekSaved = savedEmails.filter(
                  (r) =>
                    r.technicianName.trim().toLowerCase() === roster.technicianName.trim().toLowerCase() &&
                    r.workWeekKey === workWeekKey
                );

                return (
                  <OutlookEmailPreview
                    key={roster.technicianName}
                    roster={roster}
                    branding={branding}
                    currentStyle="exact_nds_template"
                    availableProjects={availableProjects}
                    nextVersionTag={versionInfo.versionTag}
                    savedVersionsCount={techWeekSaved.length}
                    onRecordDispatch={(method, status) => handleRecordDispatch(roster, method, status)}
                    onSaveToHistory={(customTag) => handleSaveTechnicianEmail(roster, customTag)}
                    onToggleAdditionalNotes={(val) =>
                      setBranding((prev) => ({
                        ...prev,
                        enableAdditionalNotes: val,
                      }))
                    }
                    onOpenNotesModal={() => setNotesModalOpen(true)}
                    onToggleNoScheduleNotes={(val) =>
                      setBranding((prev) => ({
                        ...prev,
                        disableScheduleNotes: val,
                      }))
                    }
                    onToggleCustomId={(val) =>
                      setBranding((prev) => ({
                        ...prev,
                        enableCustomId: val,
                      }))
                    }
                    onUpdateCustomIdProjects={(projs) =>
                      setBranding((prev) => ({
                        ...prev,
                        customIdProjects: projs,
                      }))
                    }
                    onToggleConductStudy={(val) =>
                      setBranding((prev) => ({
                        ...prev,
                        enableConductStudy: val,
                      }))
                    }
                    onUpdateConductStudyProjects={(projs) =>
                      setBranding((prev) => ({
                        ...prev,
                        conductStudyProjects: projs,
                      }))
                    }
                    onToggleEmailUpdate={(val) =>
                      setBranding((prev) => ({
                        ...prev,
                        enableEmailUpdate: val,
                      }))
                    }
                    onUpdateEmailUpdateConfig={(cfg) =>
                      setBranding((prev) => ({
                        ...prev,
                        emailUpdateType: cfg.type !== undefined ? cfg.type : prev.emailUpdateType,
                        emailUpdateVersion: cfg.version !== undefined ? cfg.version : prev.emailUpdateVersion,
                        emailUpdateNotes: cfg.notes !== undefined ? cfg.notes : prev.emailUpdateNotes,
                      }))
                    }
                    onOpenAttachmentModal={() => setAttachmentModalOpen(true)}
                    onUpdateAttachments={(atts) => handleSaveBranding({ ...branding, attachments: atts })}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-16 text-center bg-white rounded-2xl border border-zinc-200 shadow-xs space-y-4 max-w-2xl mx-auto my-8">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-500 mx-auto">
              <Mail className="w-7 h-7 text-zinc-400" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-zinc-900 text-base">Outlook Email Template Viewer</h3>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">
                Upload a schedule CSV file above or load a sample dataset to automatically generate formatted Outlook email templates for your assigned technicians.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => handleLoadSample(SAMPLE_DATASETS[0])}
                className="inline-flex items-center space-x-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg transition shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Load Sample Schedule CSV</span>
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </main>

      {/* Modals */}
      <SavedEmailHistoryModal
        isOpen={savedHistoryModalOpen}
        onClose={() => setSavedHistoryModalOpen(false)}
        savedEmails={savedEmails}
        onUpdateTag={handleUpdateSavedTag}
        onDeleteEmail={handleDeleteSavedEmail}
        onClearAll={handleClearAllSaved}
      />

      <ColumnMappingModal
        isOpen={mappingModalOpen}
        onClose={() => setMappingModalOpen(false)}
        headers={parseResult.headers}
        currentMapping={parseResult.mapping}
        sampleRows={parseResult.rawRows}
        onSaveMapping={(newMap) => setCustomMapping(newMap)}
      />

      <DispatchHistoryModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        logs={dispatchLogs}
        onClearLogs={handleClearLogs}
      />

      <SettingsBrandingModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        branding={branding}
        availableProjects={availableProjects}
        onSaveBranding={handleSaveBranding}
      />

      <AdditionalNotesModal
        isOpen={notesModalOpen}
        onClose={() => setNotesModalOpen(false)}
        branding={branding}
        onSaveBranding={handleSaveBranding}
        availableProjects={availableProjects}
      />

      <AttachmentManagerModal
        isOpen={attachmentModalOpen}
        onClose={() => setAttachmentModalOpen(false)}
        attachments={branding.attachments || []}
        onUpdateAttachments={(atts) => handleSaveBranding({ ...branding, attachments: atts })}
        rosters={technicianRosters}
      />
    </div>
  );
}
