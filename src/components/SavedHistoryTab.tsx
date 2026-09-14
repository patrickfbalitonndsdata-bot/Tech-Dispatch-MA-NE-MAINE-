import React, { useState, useMemo } from "react";
import {
  History,
  Trash2,
  Copy,
  Check,
  Download,
  Eye,
  Edit2,
  Calendar,
  User,
  Search,
  ChevronDown,
  Filter,
  FileText,
  Mail,
  ExternalLink,
  Tag,
  Paperclip,
  Clock,
  Sparkles,
  MapPin,
  Table,
  FileArchive,
  File,
  Layers,
  CalendarDays,
  Bookmark,
  CheckCircle2,
} from "lucide-react";
import { SavedEmailRecord, EmailAttachment } from "../types";
import { copyRichHtmlToClipboard, formatFileSize } from "../utils/outlookTemplateGenerator";
import { getAllAttachmentsFromDb } from "../utils/storageDb";

interface SavedHistoryTabProps {
  savedEmails: SavedEmailRecord[];
  onUpdateTag: (id: string, newTag: string) => void;
  onDeleteEmail: (id: string) => void;
  onClearAll: () => void;
  onSwitchToGenerator?: () => void;
}

export const SavedHistoryTab: React.FC<SavedHistoryTabProps> = ({
  savedEmails,
  onUpdateTag,
  onDeleteEmail,
  onClearAll,
  onSwitchToGenerator,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTech, setSelectedTech] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(() => {
    return savedEmails.length > 0 ? savedEmails[0].id : null;
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tempTagValue, setTempTagValue] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Extract unique technician names
  const uniqueTechnicians = useMemo(() => {
    const set = new Set<string>();
    savedEmails.forEach((e) => {
      if (e.technicianName) set.add(e.technicianName);
    });
    return Array.from(set).sort();
  }, [savedEmails]);

  // Extract unique work week keys/formatted
  const uniqueWeeks = useMemo(() => {
    const map = new Map<string, string>();
    savedEmails.forEach((e) => {
      if (e.workWeekKey) {
        map.set(e.workWeekKey, e.workWeekFormatted || e.workWeekKey);
      }
    });
    return Array.from(map.entries()).map(([key, label]) => ({ key, label }));
  }, [savedEmails]);

  // Filtered saved emails list
  const filteredEmails = useMemo(() => {
    return savedEmails.filter((record) => {
      const matchesTech =
        selectedTech === "all" ||
        record.technicianName.toLowerCase() === selectedTech.toLowerCase();

      const matchesWeek =
        selectedWeek === "all" || record.workWeekKey === selectedWeek;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        record.technicianName.toLowerCase().includes(q) ||
        record.technicianEmail.toLowerCase().includes(q) ||
        record.subject.toLowerCase().includes(q) ||
        record.versionTag.toLowerCase().includes(q) ||
        record.workWeekFormatted.toLowerCase().includes(q);

      return matchesTech && matchesWeek && matchesSearch;
    });
  }, [savedEmails, selectedTech, selectedWeek, searchQuery]);

  const activeEmail = useMemo(() => {
    if (selectedEmailId) {
      const found = filteredEmails.find((e) => e.id === selectedEmailId);
      if (found) return found;
    }
    return filteredEmails.length > 0 ? filteredEmails[0] : null;
  }, [filteredEmails, selectedEmailId]);

  const handleCopyEmail = async (record: SavedEmailRecord) => {
    const success = await copyRichHtmlToClipboard(record.htmlBody, record.plainText);
    if (success) {
      setCopiedId(record.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleDownloadEml = (record: SavedEmailRecord) => {
    const boundary = "----=_Part_" + Math.random().toString(36).substring(2);
    const emlContent = [
      `From: Sch Tech Dispatch System <dispatch@ndsdata.com>`,
      `To: ${record.technicianName} <${record.technicianEmail}>`,
      `Subject: ${record.subject}`,
      `Date: ${new Date(record.createdAt).toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      `X-Version-Tag: ${record.versionTag}`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      record.plainText,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      record.htmlBody,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    const blob = new Blob([emlContent], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeTag = record.versionTag.replace(/[^a-zA-Z0-9_-]/g, "_");
    link.download = `${record.technicianName.replace(/\s+/g, "_")}_${safeTag}_schedule.eml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAttachment = async (att: EmailAttachment) => {
    try {
      let base64 = att.dataBase64;
      let dataUrl = att.dataUrl;

      // If base64 is stripped from localStorage cache, recover from IndexedDB
      if (!base64 && !dataUrl) {
        try {
          const dbAtts = await getAllAttachmentsFromDb();
          const found = dbAtts.find((a) => a.id === att.id || a.name === att.name);
          if (found) {
            base64 = found.dataBase64;
            dataUrl = found.dataUrl;
          }
        } catch (dbErr) {
          console.warn("Could not retrieve attachment from DB:", dbErr);
        }
      }

      const href = dataUrl || (base64 ? `data:${att.type || "application/octet-stream"};base64,${base64}` : null);
      if (!href) {
        console.warn("Attachment content is not available.");
        return;
      }

      const link = document.createElement("a");
      link.href = href;
      link.download = att.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Failed to download attachment:", e);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (ext === "kmz" || ext === "kml") return <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />;
    if (ext === "pdf") return <FileText className="w-3.5 h-3.5 text-red-600 shrink-0" />;
    if (ext === "csv" || ext === "xlsx" || ext === "xls") return <Table className="w-3.5 h-3.5 text-emerald-600 shrink-0" />;
    if (ext === "zip" || ext === "rar" || ext === "7z") return <FileArchive className="w-3.5 h-3.5 text-amber-600 shrink-0" />;
    return <File className="w-3.5 h-3.5 text-zinc-600 shrink-0" />;
  };

  const handleStartEditTag = (record: SavedEmailRecord) => {
    setEditingTagId(record.id);
    setTempTagValue(record.versionTag);
  };

  const handleSaveTag = (id: string) => {
    if (tempTagValue.trim()) {
      onUpdateTag(id, tempTagValue.trim());
    }
    setEditingTagId(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-zinc-950 flex items-center justify-center font-bold shadow-xs">
            <History className="w-5 h-5 text-zinc-950" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-zinc-900 tracking-tight">Saved Email History</h2>
              <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-300">
                {savedEmails.length} Email{savedEmails.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-zinc-500">
              Persisted technician dispatches categorized by Work Week schedule with automatic versioning.
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {savedEmails.length > 0 && (
            <>
              {showClearConfirm ? (
                <div className="flex items-center space-x-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg text-xs">
                  <span className="text-red-700 font-semibold">Delete all history?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAll();
                      setShowClearConfirm(false);
                    }}
                    className="px-2 py-0.5 bg-red-600 text-white font-bold rounded hover:bg-red-700 transition cursor-pointer"
                  >
                    Yes, Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-2 py-0.5 bg-zinc-200 text-zinc-700 rounded hover:bg-zinc-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All History</span>
                </button>
              )}
            </>
          )}

          {onSwitchToGenerator && (
            <button
              type="button"
              onClick={onSwitchToGenerator}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Back to Schedule Generator</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 flex flex-col sm:flex-row items-center gap-2">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search technician, subject, version..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-900"
            />
          </div>

          {/* Technician Filter */}
          <select
            value={selectedTech}
            onChange={(e) => setSelectedTech(e.target.value)}
            className="w-full sm:w-48 px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-800 font-medium"
          >
            <option value="all">All Technicians ({uniqueTechnicians.length})</option>
            {uniqueTechnicians.map((tech) => (
              <option key={tech} value={tech}>
                {tech}
              </option>
            ))}
          </select>

          {/* Work Week Filter */}
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="w-full sm:w-56 px-2.5 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-zinc-800 font-medium"
          >
            <option value="all">All Work Weeks ({uniqueWeeks.length})</option>
            {uniqueWeeks.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-zinc-500 font-medium">
          Showing <span className="font-bold text-zinc-900">{filteredEmails.length}</span> of {savedEmails.length} records
        </div>
      </div>

      {/* Main Split Layout: Left List + Right Outlook Simulator */}
      {savedEmails.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
            <Bookmark className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-zinc-900">No Saved Email History Yet</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            When you generate email schedules for your technicians, click <strong>"Save (Initial)"</strong> or <strong>"Save All to History"</strong> in the generator to save a snapshot.
          </p>
          {onSwitchToGenerator && (
            <button
              type="button"
              onClick={onSwitchToGenerator}
              className="mt-2 inline-flex items-center space-x-2 px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-semibold hover:bg-zinc-800 transition cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Go to Schedule Generator</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Email Records List */}
          <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden flex flex-col max-h-[750px]">
            <div className="p-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between text-xs font-semibold text-zinc-700">
              <span className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-500" />
                <span>Saved Dispatches</span>
              </span>
              <span className="text-[11px] text-zinc-400 font-normal">
                {filteredEmails.length} matching
              </span>
            </div>

            <div className="overflow-y-auto divide-y divide-zinc-100 flex-1 p-2 space-y-1">
              {filteredEmails.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400 italic">
                  No records match your filter criteria.
                </div>
              ) : (
                filteredEmails.map((record) => {
                  const isSelected = activeEmail?.id === record.id;
                  const isCopied = copiedId === record.id;
                  const isEditingThisTag = editingTagId === record.id;
                  const attsCount = record.attachments?.length || record.attachmentsSummary?.length || 0;

                  return (
                    <div
                      key={record.id}
                      onClick={() => setSelectedEmailId(record.id)}
                      className={`p-3 rounded-lg border transition cursor-pointer flex flex-col gap-2 ${
                        isSelected
                          ? "bg-amber-50/70 border-amber-300 shadow-2xs"
                          : "bg-white border-zinc-200/80 hover:bg-zinc-50/80 hover:border-zinc-300"
                      }`}
                    >
                      {/* Top Row: Tech Name + Version Tag */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-1.5 font-bold text-xs text-zinc-900">
                            <span>{record.technicianName}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate max-w-[180px]">
                            {record.technicianEmail}
                          </div>
                        </div>

                        {/* Tag Badge / Inline Edit */}
                        {isEditingThisTag ? (
                          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={tempTagValue}
                              onChange={(e) => setTempTagValue(e.target.value)}
                              className="w-20 px-1.5 py-0.5 text-[11px] font-bold border border-amber-400 rounded bg-white text-zinc-900"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveTag(record.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-1">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                record.isInitialVersion
                                  ? "bg-blue-50 text-blue-800 border-blue-200"
                                  : "bg-amber-100 text-amber-900 border-amber-300"
                              }`}
                            >
                              {record.versionTag}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditTag(record);
                              }}
                              className="p-1 text-zinc-400 hover:text-zinc-700 rounded"
                              title="Edit version tag"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Work Week & Job info */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-600 pt-1 border-t border-zinc-100">
                        <span className="flex items-center space-x-1 text-zinc-500 font-medium">
                          <CalendarDays className="w-3 h-3 text-zinc-400" />
                          <span>{record.workWeekFormatted}</span>
                        </span>
                        <span className="font-semibold text-zinc-800 bg-zinc-100 px-1.5 py-0.2 rounded text-[10px]">
                          {record.jobCount} Job{record.jobCount !== 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Attachments & Date info */}
                      <div className="flex items-center justify-between text-[10px] text-zinc-400">
                        <span>{new Date(record.createdAt).toLocaleDateString()} {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {attsCount > 0 && (
                          <span className="flex items-center space-x-1 text-blue-700 font-semibold">
                            <Paperclip className="w-3 h-3" />
                            <span>{attsCount} file{attsCount !== 1 ? "s" : ""}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Outlook Simulator for Active Saved Record */}
          <div className="lg:col-span-8 space-y-4">
            {activeEmail ? (
              <div className="bg-white border border-zinc-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
                {/* Header Action Bar */}
                <div className="p-4 bg-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-white border border-zinc-700">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-semibold tracking-tight">{activeEmail.technicianName}</h3>
                        <span className="bg-amber-400 text-zinc-950 font-bold text-[10px] px-2 py-0.2 rounded-full">
                          {activeEmail.versionTag}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Work Week: {activeEmail.workWeekFormatted} &bull; Saved {new Date(activeEmail.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Actions for this saved record */}
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopyEmail(activeEmail)}
                      className={`flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer ${
                        copiedId === activeEmail.id
                          ? "bg-emerald-600 text-white"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                    >
                      {copiedId === activeEmail.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === activeEmail.id ? "Copied!" : "Copy for Outlook"}</span>
                    </button>

                    <button
                      onClick={() => handleDownloadEml(activeEmail)}
                      className="flex items-center space-x-1.5 text-xs font-semibold px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition border border-zinc-700 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.EML</span>
                    </button>

                    <button
                      onClick={() => onDeleteEmail(activeEmail.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 transition rounded-lg hover:bg-zinc-800 cursor-pointer"
                      title="Delete this saved record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Outlook Desktop Simulator Content */}
                <div className="p-4 sm:p-6 bg-zinc-100/60 flex-1 flex flex-col items-center justify-center overflow-x-auto">
                  <div className="w-full max-w-3xl bg-white rounded-xl shadow-md border border-zinc-300 overflow-hidden flex flex-col">
                    {/* Outlook Window Titlebar */}
                    <div className="bg-[#0078D4] text-white px-4 py-2 flex items-center justify-between text-xs select-none">
                      <div className="flex items-center space-x-2">
                        <Mail className="w-3.5 h-3.5 text-white" />
                        <span className="font-medium">Microsoft Outlook — Saved History Record</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded font-mono">
                          {activeEmail.versionTag}
                        </span>
                      </div>
                    </div>

                    {/* Headers */}
                    <div className="p-4 bg-white border-b border-zinc-200 space-y-2 text-xs font-sans">
                      <div className="flex items-center">
                        <span className="w-16 font-semibold text-zinc-400 uppercase text-[10px]">To:</span>
                        <span className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {activeEmail.technicianName} &lt;{activeEmail.technicianEmail}&gt;
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-16 font-semibold text-zinc-400 uppercase text-[10px]">Saved Date:</span>
                        <span className="text-zinc-600">{new Date(activeEmail.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex items-start">
                        <span className="w-16 font-semibold text-zinc-400 uppercase text-[10px] mt-0.5">Subject:</span>
                        <span className="font-bold text-zinc-900 text-sm">{activeEmail.subject}</span>
                      </div>

                      {/* Attachments Section in Saved View */}
                      {activeEmail.attachments && activeEmail.attachments.length > 0 && (
                        <div className="pt-2 mt-1 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-start gap-2">
                          <div className="flex items-center space-x-1.5 w-24 shrink-0 text-zinc-500 font-semibold uppercase text-[10px] pt-1">
                            <Paperclip className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Saved Files ({activeEmail.attachments.length}):</span>
                          </div>
                          <div className="flex-1 flex flex-wrap items-center gap-1.5">
                            {activeEmail.attachments.map((att) => (
                              <div
                                key={att.id}
                                className="flex items-center space-x-1.5 px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 rounded-md text-[11px] font-medium text-zinc-800 transition"
                              >
                                {getFileIcon(att.name)}
                                <span className="font-semibold truncate max-w-[140px]" title={att.name}>
                                  {att.name}
                                </span>
                                <span className="text-[10px] text-zinc-500 font-normal">
                                  ({formatFileSize(att.size)})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadAttachment(att)}
                                  title="Download saved attachment"
                                  className="text-zinc-500 hover:text-zinc-900 ml-0.5 cursor-pointer"
                                >
                                  <Download className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Email HTML Body */}
                    <div className="p-4 bg-[#F8FAFC] overflow-y-auto max-h-[550px]">
                      <div
                        className="outlook-body-wrapper"
                        dangerouslySetInnerHTML={{ __html: activeEmail.htmlBody }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-zinc-400 text-xs italic">
                Select a saved email record on the left to preview.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
