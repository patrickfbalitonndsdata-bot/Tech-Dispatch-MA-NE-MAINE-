import React, { useState, useMemo } from "react";
import {
  X,
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
  ArrowRight,
  Monitor,
} from "lucide-react";
import { SavedEmailRecord } from "../types";
import { copyRichHtmlToClipboard } from "../utils/outlookTemplateGenerator";

interface SavedEmailHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedEmails: SavedEmailRecord[];
  onUpdateTag: (id: string, newTag: string) => void;
  onDeleteEmail: (id: string) => void;
  onClearAll: () => void;
}

export const SavedEmailHistoryModal: React.FC<SavedEmailHistoryModalProps> = ({
  isOpen,
  onClose,
  savedEmails,
  onUpdateTag,
  onDeleteEmail,
  onClearAll,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTech, setSelectedTech] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState<string>("all");
  const [previewEmail, setPreviewEmail] = useState<SavedEmailRecord | null>(null);
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

  if (!isOpen) return null;

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
      `Content-Type: text/plain; charset="utf-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      record.plainText,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="utf-8"`,
      `Content-Transfer-Encoding: 8bit`,
      ``,
      record.htmlBody,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    const blob = new Blob([emlContent], { type: "message/rfc822;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = `${record.technicianName.replace(/[^a-zA-Z0-9]/g, "_")}_${record.versionTag.replace(/[^a-zA-Z0-9]/g, "_")}_Schedule.eml`;
    link.href = url;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startEditingTag = (record: SavedEmailRecord) => {
    setEditingTagId(record.id);
    setTempTagValue(record.versionTag);
  };

  const saveEditedTag = (id: string) => {
    if (tempTagValue.trim()) {
      onUpdateTag(id, tempTagValue.trim());
    }
    setEditingTagId(null);
  };

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedEmails, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Sch_Tech_Dispatch_Saved_Emails_${new Date().toISOString().split("T")[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-5xl w-full border border-zinc-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-800 flex items-center justify-center font-bold">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-zinc-900">Saved Email History</h2>
                <span className="text-xs font-semibold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                  {savedEmails.length} Total Saved
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Auto-versioned per technician work week (Initial, v.2, v.3...) stored locally in browser
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {savedEmails.length > 0 && (
              <button
                onClick={handleExportJson}
                className="hidden sm:inline-flex items-center space-x-1.5 text-xs font-medium bg-white hover:bg-zinc-100 text-zinc-700 px-3 py-1.5 rounded-lg border border-zinc-200 transition cursor-pointer"
                title="Backup all saved email records to JSON"
              >
                <Download className="w-3.5 h-3.5 text-zinc-500" />
                <span>Export JSON</span>
              </button>
            )}

            {savedEmails.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="inline-flex items-center space-x-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition cursor-pointer"
                title="Clear all saved history records"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Clear All Confirmation Dialog Overlay */}
        {showClearConfirm && (
          <div className="p-4 bg-red-50 border-b border-red-200 flex items-center justify-between animate-in fade-in">
            <div className="text-xs text-red-900">
              <span className="font-bold">Are you sure?</span> This will delete all {savedEmails.length} saved email version records from local storage.
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-3 py-1 bg-white text-zinc-700 text-xs font-medium rounded-md border border-zinc-300 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearAll();
                  setShowClearConfirm(false);
                  setPreviewEmail(null);
                }}
                className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-md hover:bg-red-700"
              >
                Yes, Delete All
              </button>
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="p-4 bg-white border-b border-zinc-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search technician, subject, version..."
              className="w-full pl-8.5 pr-3 py-1.75 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Technician Filter */}
          <div className="relative">
            <User className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400 pointer-events-none" />
            <select
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
              className="w-full pl-8.5 pr-8 py-1.75 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 appearance-none cursor-pointer"
            >
              <option value="all">All Technicians ({uniqueTechnicians.length})</option>
              {uniqueTechnicians.map((tech) => (
                <option key={tech} value={tech}>
                  {tech}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-3 text-zinc-400 pointer-events-none" />
          </div>

          {/* Work Week Filter */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-zinc-400 pointer-events-none" />
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full pl-8.5 pr-8 py-1.75 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 appearance-none cursor-pointer"
            >
              <option value="all">All Work Weeks ({uniqueWeeks.length})</option>
              {uniqueWeeks.map((week) => (
                <option key={week.key} value={week.key}>
                  {week.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-3 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* Content Area: Main List & Side-by-Side Preview (if selected) */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Email Records List */}
          <div className={`overflow-y-auto p-4 space-y-3 flex-1 ${previewEmail ? "md:max-w-md md:border-r md:border-zinc-200" : "w-full"}`}>
            {filteredEmails.length === 0 ? (
              <div className="p-12 text-center text-zinc-500 space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900">No Saved Emails Found</h4>
                  <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                    {savedEmails.length === 0
                      ? "When you click 'Save to History' on an email preview, it will be automatically cataloged here with work-week version tags (Initial, v.2, etc.)."
                      : "No saved emails matched your active search and filter criteria."}
                  </p>
                </div>
              </div>
            ) : (
              filteredEmails.map((record) => {
                const isSelected = previewEmail?.id === record.id;
                const isEditing = editingTagId === record.id;

                return (
                  <div
                    key={record.id}
                    className={`bg-white border rounded-xl p-3.5 transition-all shadow-2xs hover:shadow-xs space-y-2.5 ${
                      isSelected
                        ? "border-amber-400 bg-amber-50/20 ring-2 ring-amber-400/30"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {/* Top Row: Tech Name + Version Tag Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-sm text-zinc-900">{record.technicianName}</span>
                          <span className="text-[11px] text-zinc-500 truncate max-w-[150px]">
                            {record.technicianEmail}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-zinc-500 mt-0.5">
                          <span className="flex items-center gap-1 text-zinc-600 font-medium">
                            <Calendar className="w-3 h-3 text-zinc-400" />
                            {record.workWeekFormatted}
                          </span>
                          <span>&bull;</span>
                          <span className="text-zinc-400">
                            {new Date(record.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            {new Date(record.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Version Tag (Editable) */}
                      <div className="shrink-0 flex items-center space-x-1">
                        {isEditing ? (
                          <div className="flex items-center space-x-1">
                            <input
                              type="text"
                              value={tempTagValue}
                              onChange={(e) => setTempTagValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditedTag(record.id);
                                if (e.key === "Escape") setEditingTagId(null);
                              }}
                              autoFocus
                              className="px-2 py-0.5 text-xs font-bold border border-amber-400 rounded bg-white text-zinc-900 w-24 focus:outline-hidden"
                            />
                            <button
                              onClick={() => saveEditedTag(record.id)}
                              className="p-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px]"
                              title="Save Tag"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingTagId(null)}
                              className="p-1 text-zinc-400 hover:text-zinc-600 rounded text-[10px]"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="group relative flex items-center space-x-1">
                            <span
                              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border cursor-pointer ${
                                record.isInitialVersion || record.versionTag.toLowerCase() === "initial"
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                                  : "bg-amber-100 text-amber-950 border-amber-300"
                              }`}
                              onClick={() => startEditingTag(record)}
                              title="Click to edit version tag"
                            >
                              {record.versionTag}
                            </span>
                            <button
                              onClick={() => startEditingTag(record)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-400 hover:text-zinc-700 transition"
                              title="Edit tag label"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Subject Line */}
                    <div className="text-xs text-zinc-800 bg-zinc-50 px-2.5 py-1.5 rounded-md border border-zinc-100 font-medium line-clamp-2">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Subject</span>
                      {record.subject}
                    </div>

                    {/* Meta Badges Row */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-600">
                      <span className="bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded font-medium">
                        {record.jobCount} Jobs
                      </span>
                      {record.customIdEnabled && (
                        <span className="bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded font-medium">
                          Custom ID
                        </span>
                      )}
                      {record.emailUpdateEnabled && (
                        <span className="bg-yellow-100 text-yellow-900 border border-yellow-300 px-1.5 py-0.5 rounded font-bold">
                          Update v{record.emailUpdateVersion || "2"}
                        </span>
                      )}
                      {(record.attachmentsSummary || []).length > 0 && (
                        <span className="bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Paperclip className="w-2.5 h-2.5 text-zinc-400" />
                          {record.attachmentsSummary?.length} Attachments
                        </span>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="pt-1.5 border-t border-zinc-100 flex items-center justify-between gap-1">
                      <button
                        onClick={() => setPreviewEmail(isSelected ? null : record)}
                        className={`flex items-center space-x-1 text-xs font-semibold px-2.5 py-1 rounded-md transition cursor-pointer ${
                          isSelected
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 hover:bg-zinc-200 text-zinc-800"
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isSelected ? "Close Preview" : "View Email"}</span>
                      </button>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleCopyEmail(record)}
                          className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition cursor-pointer"
                          title="Copy Styled HTML for Outlook"
                        >
                          {copiedId === record.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDownloadEml(record)}
                          className="p-1.5 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition cursor-pointer"
                          title="Download Outlook .EML File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onDeleteEmail(record.id)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition cursor-pointer"
                          title="Delete Version from History"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Email Detailed Preview Panel */}
          {previewEmail && (
            <div className="flex-1 bg-zinc-100/70 p-4 flex flex-col overflow-hidden border-t md:border-t-0 border-zinc-200">
              {/* Preview Header & View Mode Switcher */}
              <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-xs mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-zinc-900">
                      {previewEmail.technicianName}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                      {previewEmail.versionTag}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500">{previewEmail.workWeekFormatted}</span>
                </div>
              </div>

              {/* Viewer Area - Desktop Outlook View */}
              <div className="flex-1 bg-white rounded-xl border border-zinc-300 shadow-xs overflow-y-auto p-4 flex justify-center">
                <div className="w-full max-w-2xl">
                  <div className="border-b border-zinc-200 pb-3 mb-4 space-y-1 text-xs font-sans">
                    <div>
                      <span className="font-semibold text-zinc-400 w-16 inline-block uppercase text-[10px]">To:</span>
                      <span className="text-blue-700 font-medium">
                        {previewEmail.technicianName} &lt;{previewEmail.technicianEmail}&gt;
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-400 w-16 inline-block uppercase text-[10px]">Subject:</span>
                      <span className="font-bold text-zinc-900">{previewEmail.subject}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-400 w-16 inline-block uppercase text-[10px]">Saved:</span>
                      <span className="text-zinc-600">{new Date(previewEmail.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div
                    className="outlook-html-body text-zinc-900 font-sans text-xs"
                    dangerouslySetInnerHTML={{ __html: previewEmail.htmlBody }}
                  />
                </div>
              </div>

              {/* Bottom Quick Action */}
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  Tag: <span className="font-bold text-zinc-900">{previewEmail.versionTag}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCopyEmail(previewEmail)}
                    className="px-3 py-1.5 bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-semibold rounded-lg border border-zinc-200 shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    {copiedId === previewEmail.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedId === previewEmail.id ? "Copied!" : "Copy Styled HTML"}</span>
                  </button>

                  <button
                    onClick={() => handleDownloadEml(previewEmail)}
                    className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .EML</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            Showing <span className="font-semibold text-zinc-800">{filteredEmails.length}</span> of{" "}
            <span className="font-semibold text-zinc-800">{savedEmails.length}</span> saved email records
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition shadow-xs cursor-pointer"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
