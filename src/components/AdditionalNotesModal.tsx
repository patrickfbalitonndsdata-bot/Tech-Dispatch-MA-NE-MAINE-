import React, { useState } from "react";
import {
  X,
  FileText,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Eye,
  Sliders,
  Calendar,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { AdditionalNotePreset, TemplateBranding } from "../types";
import { DEFAULT_PRESET_NOTES, renderPresetLinesHtml } from "../utils/outlookTemplateGenerator";

interface AdditionalNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  branding: TemplateBranding;
  onSaveBranding: (newBranding: TemplateBranding) => void;
  availableProjects?: string[];
  availableDays?: string[];
}

const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const AdditionalNotesModal: React.FC<AdditionalNotesModalProps> = ({
  isOpen,
  onClose,
  branding,
  onSaveBranding,
  availableProjects = [],
  availableDays = ALL_DAYS,
}) => {
  const [enabled, setEnabled] = useState<boolean>(branding.enableAdditionalNotes ?? true);
  const [presets, setPresets] = useState<AdditionalNotePreset[]>(() => {
    const base =
      branding.additionalNotes && branding.additionalNotes.length > 0
        ? branding.additionalNotes
        : DEFAULT_PRESET_NOTES;

    let list: AdditionalNotePreset[] = [];
    for (const p of base) {
      if (p.id === "preset_tmc_atr_install" || p.autoTriggerType === "tmc_atr_install") {
        const tmcPreset = DEFAULT_PRESET_NOTES.find((d) => d.id === "preset_tmc_install");
        const algPreset = DEFAULT_PRESET_NOTES.find((d) => d.id === "preset_alg_atr_install");
        if (tmcPreset && !base.some((b) => b.id === tmcPreset.id)) {
          list.push({ ...tmcPreset, enabled: p.enabled });
        }
        if (algPreset && !base.some((b) => b.id === algPreset.id)) {
          list.push({ ...algPreset, enabled: p.enabled });
        }
      } else {
        list.push(p);
      }
    }

    for (const defaultPreset of DEFAULT_PRESET_NOTES) {
      const exists = list.some((p) => p.id === defaultPreset.id);
      if (!exists) {
        list.push({ ...defaultPreset });
      }
    }
    return list;
  });

  // New Note Creator Form State
  const [newNoteText, setNewNoteText] = useState<string>("");
  const [newNoteLabel, setNewNoteLabel] = useState<string>("Custom Dispatch Note");
  const [newNoteDays, setNewNoteDays] = useState<string[]>(["All"]);
  const [newNoteProject, setNewNoteProject] = useState<string>("All");
  const [newNoteCustomProject, setNewNoteCustomProject] = useState<string>("");
  const [newNoteCategory, setNewNoteCategory] = useState<"All" | "Install" | "Teardown" | "BatterySwap">("All");

  // Expanded editor card state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleMaster = () => {
    setEnabled((prev) => !prev);
  };

  const handleTogglePreset = (id: string) => {
    setPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleTextChange = (id: string, newText: string) => {
    setPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, text: newText } : p))
    );
  };

  const handleLabelChange = (id: string, newLabel: string) => {
    setPresets((prev) =>
      prev.map((p) => (p.id === id ? { ...p, label: newLabel } : p))
    );
  };

  const handleDaysToggle = (presetId: string, day: string) => {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        const currentDays = p.targetDays || ["All"];
        if (day === "All") {
          return { ...p, targetDays: ["All"] };
        }
        let updated: string[];
        if (currentDays.includes("All")) {
          updated = [day];
        } else if (currentDays.includes(day)) {
          updated = currentDays.filter((d) => d !== day);
          if (updated.length === 0) updated = ["All"];
        } else {
          updated = [...currentDays, day];
          if (updated.length === ALL_DAYS.length) updated = ["All"];
        }
        return { ...p, targetDays: updated };
      })
    );
  };

  const handleProjectFilterChange = (presetId: string, proj: string) => {
    setPresets((prev) =>
      prev.map((p) => {
        if (p.id !== presetId) return p;
        return {
          ...p,
          targetProjects: proj ? [proj] : ["All"],
        };
      })
    );
  };

  const handleCategoryFilterChange = (presetId: string, cat: "All" | "Install" | "Teardown" | "BatterySwap") => {
    setPresets((prev) =>
      prev.map((p) => (p.id === presetId ? { ...p, targetCategory: cat } : p))
    );
  };

  const handleAddCustomNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    let targetProj = newNoteProject;
    if (newNoteProject === "Custom" && newNoteCustomProject.trim()) {
      targetProj = newNoteCustomProject.trim();
    }

    let finalNoteText = newNoteText.trim();
    if (!finalNoteText.startsWith("Note:") && !finalNoteText.startsWith("Note :") && !finalNoteText.startsWith("Loc.")) {
      finalNoteText = `Note: ${finalNoteText}`;
    }

    const newId = `custom_note_${Date.now()}`;
    const newPreset: AdditionalNotePreset = {
      id: newId,
      label: newNoteLabel.trim() || "Custom Note",
      text: finalNoteText,
      enabled: true,
      isCustom: true,
      targetDays: newNoteDays,
      targetProjects: targetProj === "All" ? ["All"] : [targetProj],
      targetCategory: newNoteCategory,
    };

    setPresets((prev) => [newPreset, ...prev]);
    setNewNoteText("");
    setNewNoteLabel("Custom Dispatch Note");
    setNewNoteDays(["All"]);
    setNewNoteProject("All");
    setNewNoteCustomProject("");
    setNewNoteCategory("All");
    setEnabled(true);
  };

  const handleDeletePreset = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  const handleResetDefaults = () => {
    setPresets(DEFAULT_PRESET_NOTES);
    setEnabled(true);
  };

  const handleSave = () => {
    const updated: TemplateBranding = {
      ...branding,
      enableAdditionalNotes: enabled,
      additionalNotes: presets,
    };
    onSaveBranding(updated);
    onClose();
  };

  const activeCount = presets.filter((p) => p.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-zinc-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400 text-zinc-950 flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">Additional Notes &amp; Dispatch Presets</h2>
              <p className="text-xs text-zinc-400">
                Configure highlighted yellow notes placed immediately beneath task lines for specific Days and Projects
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Master Toggle Banner */}
          <div
            className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
              enabled
                ? "bg-amber-50/70 border-amber-300 text-amber-950"
                : "bg-zinc-100 border-zinc-200 text-zinc-600"
            }`}
          >
            <div className="space-y-0.5">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-zinc-900">Additional Notes System</span>
                <span
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                    enabled ? "bg-amber-400 text-zinc-950 font-bold" : "bg-zinc-200 text-zinc-700"
                  }`}
                >
                  {enabled ? `ON (${activeCount} Active Presets)` : "OFF"}
                </span>
              </div>
              <p className="text-xs text-zinc-600">
                When enabled, notes are formatted with yellow highlights and attached directly under their matching Install, Teardown, or Battery Swap task lines.
              </p>
            </div>

            <button
              onClick={handleToggleMaster}
              type="button"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-hidden cursor-pointer ${
                enabled ? "bg-amber-500" : "bg-zinc-300"
              }`}
              title="Toggle Additional Notes"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Quick Add Custom Note Form */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-zinc-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>Add Customized Note</span>
              </h3>
              <span className="text-[11px] text-zinc-500">Attach to specific Days or Projects</span>
            </div>

            <form onSubmit={handleAddCustomNote} className="space-y-3">
              <div>
                <textarea
                  rows={2}
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Enter note text (e.g. Note: Please confirm the posted speed limits if there's any)..."
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] text-zinc-400 font-medium">Quick insert:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setNewNoteText("Note: Please report to the Auburn office at <input time> on <Input Day:Date>\nAddress: 23 Midstate Drive Suite 112 Auburn, MA 01501");
                      setNewNoteLabel("Meeting at Auburn Office");
                    }}
                    className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 transition cursor-pointer"
                  >
                    + Auburn Office Meeting
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewNoteText("Note: Please coordinate with Madison Lopez regarding the meeting location at a central location in New York City. If you have any concerns and question please reach out to Julie Incerpi.");
                      setNewNoteLabel("Meeting at New York City");
                    }}
                    className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200 transition cursor-pointer"
                  >
                    + NYC Meeting
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewNoteText("Note: Please upload data ASAP as these projects are Priority client.");
                      setNewNoteLabel("Priority Client ASAP Data Upload Note");
                    }}
                    className="text-[10px] bg-red-50 hover:bg-red-100 text-red-700 px-2 py-0.5 rounded border border-red-200 transition cursor-pointer"
                  >
                    + Priority Client Note
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewNoteText("Note: Please make sure to follow the correct file naming when uploading data for all SPEED locations being collecting by camera. See correct Format: <ALG>SPACE<Project Number>SPACE<SPEED> | Example: “ALG 25-99999 SPEED”.");
                      setNewNoteLabel("SPEED File Naming Format Note");
                    }}
                    className="text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200 transition cursor-pointer"
                  >
                    + SPEED File Naming Note
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewNoteText("Note: Please make sure to install the cameras exactly as shown in the KMZ file.");
                      setNewNoteLabel("KMZ Camera Placement Note");
                    }}
                    className="text-[10px] bg-purple-50 hover:bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 transition cursor-pointer"
                  >
                    + KMZ Placement Note
                  </button>
                </div>
              </div>

              {/* Scoping Options: Days, Project Number, and Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-zinc-200">
                {/* Target Days */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-500" />
                    <span>Target Days:</span>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setNewNoteDays(["All"])}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                        newNoteDays.includes("All")
                          ? "bg-amber-400 text-zinc-950 font-bold"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      All Days
                    </button>
                    {ALL_DAYS.map((day) => {
                      const isDaySelected = !newNoteDays.includes("All") && newNoteDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (newNoteDays.includes("All")) {
                              setNewNoteDays([day]);
                            } else if (newNoteDays.includes(day)) {
                              const filtered = newNoteDays.filter((d) => d !== day);
                              setNewNoteDays(filtered.length === 0 ? ["All"] : filtered);
                            } else {
                              const updated = [...newNoteDays, day];
                              setNewNoteDays(updated.length === ALL_DAYS.length ? ["All"] : updated);
                            }
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                            isDaySelected
                              ? "bg-amber-400 text-zinc-950 font-bold"
                              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Project Number */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-zinc-500" />
                    <span>Target Project #:</span>
                  </label>
                  <select
                    value={newNoteProject}
                    onChange={(e) => setNewNoteProject(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-zinc-300 rounded text-xs text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="All">All Projects</option>
                    {availableProjects.map((p) => (
                      <option key={p} value={p}>
                        Project: {p}
                      </option>
                    ))}
                    <option value="Custom">Custom Project #...</option>
                  </select>

                  {newNoteProject === "Custom" && (
                    <input
                      type="text"
                      placeholder="e.g. 25-10148"
                      value={newNoteCustomProject}
                      onChange={(e) => setNewNoteCustomProject(e.target.value)}
                      className="mt-1.5 w-full px-2 py-1 bg-white border border-zinc-300 rounded text-xs text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                    />
                  )}
                </div>

                {/* Target Task Category */}
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-zinc-500" />
                    <span>Apply To Task Type:</span>
                  </label>
                  <select
                    value={newNoteCategory}
                    onChange={(e) => setNewNoteCategory(e.target.value as any)}
                    className="w-full px-2 py-1 bg-white border border-zinc-300 rounded text-xs text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="All">All Task Types</option>
                    <option value="Install">Install lines only</option>
                    <option value="Teardown">Teardown lines only</option>
                    <option value="BatterySwap">Battery / SD Card Swaps only</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!newNoteText.trim()}
                  className="flex items-center space-x-1.5 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add to Notes</span>
                </button>
              </div>
            </form>
          </div>

          {/* Presets & Active Notes List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-zinc-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span>Preset &amp; Configured Notes Catalog</span>
                <span className="text-[10px] font-medium text-zinc-400 lowercase">({presets.length} total)</span>
              </h3>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="flex items-center space-x-1 text-[11px] text-zinc-500 hover:text-zinc-800 transition px-2 py-1 rounded-md hover:bg-zinc-100 cursor-pointer"
                  title="Reset to default NDS preset notes"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Defaults</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {presets.map((preset, index) => {
                const isSelected = preset.enabled && enabled;
                const isExpanded = expandedId === preset.id;
                const targetDays = preset.targetDays || ["All"];
                const targetProj = preset.targetProjects?.[0] || "All";
                const targetCat = preset.targetCategory || "All";

                return (
                  <div
                    key={preset.id}
                    className={`rounded-xl border transition-all p-4 ${
                      isSelected
                        ? "bg-white border-amber-300 ring-2 ring-amber-400/20 shadow-xs"
                        : "bg-zinc-50/70 border-zinc-200 opacity-80 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center space-x-2.5">
                        <input
                          type="checkbox"
                          id={`preset_chk_${preset.id}`}
                          checked={preset.enabled}
                          onChange={() => handleTogglePreset(preset.id)}
                          className="w-4 h-4 text-amber-600 rounded border-zinc-300 focus:ring-amber-500 cursor-pointer"
                        />
                        <div>
                          <label
                            htmlFor={`preset_chk_${preset.id}`}
                            className="font-bold text-xs text-zinc-900 cursor-pointer flex items-center gap-1.5"
                          >
                            <span>Preset #{index + 1}:</span>
                            <span className="text-zinc-800">{preset.label}</span>
                          </label>

                          {/* Trigger Rule Badge */}
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {preset.autoTriggerType === "tmc_atr_install" && (
                              <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.2 rounded border border-blue-200">
                                Auto-triggers on TMC/ATR Installs
                              </span>
                            )}
                            {preset.autoTriggerType === "speed_teardown_swap" && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-1.5 py-0.2 rounded border border-emerald-200">
                                Auto-triggers on Speed Add-ons (Teardowns &amp; Swaps)
                              </span>
                            )}
                            {preset.autoTriggerType === "priority_client_upload" && (
                              <span className="text-[10px] bg-red-50 text-red-700 font-semibold px-1.5 py-0.2 rounded border border-red-200">
                                Priority Client Urgent Upload
                              </span>
                            )}
                            {preset.autoTriggerType === "meeting_auburn" && (
                              <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-1.5 py-0.2 rounded border border-blue-200">
                                Auburn Office Meeting Note
                              </span>
                            )}
                            {preset.autoTriggerType === "meeting_nyc" && (
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-semibold px-1.5 py-0.2 rounded border border-indigo-200">
                                NYC Meeting Note
                              </span>
                            )}
                            {preset.autoTriggerType === "kmz_placement" && (
                              <span className="text-[10px] bg-purple-50 text-purple-700 font-semibold px-1.5 py-0.2 rounded border border-purple-200">
                                KMZ Placement Instructions
                              </span>
                            )}
                            {preset.isCustom && (
                              <span className="text-[10px] bg-amber-50 text-amber-800 font-semibold px-1.5 py-0.2 rounded border border-amber-200">
                                Custom Note
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-400">
                              • Days: {targetDays.join(", ")} • Proj: {targetProj} • Type: {targetCat}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : preset.id)}
                          className="text-zinc-500 hover:text-zinc-900 px-2 py-1 rounded text-[11px] font-medium hover:bg-zinc-100 flex items-center gap-0.5 cursor-pointer"
                        >
                          <span>{isExpanded ? "Hide Settings" : "Configure Scope"}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {preset.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeletePreset(preset.id)}
                            className="text-zinc-400 hover:text-red-600 p-1 rounded transition cursor-pointer"
                            title="Delete custom preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Editable Text Area */}
                    <div className="space-y-2 pl-6">
                      <textarea
                        rows={preset.text.split("\n").length > 2 ? 3 : 2}
                        value={preset.text}
                        onChange={(e) => handleTextChange(preset.id, e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs text-zinc-900 font-sans focus:outline-hidden focus:ring-2 focus:ring-amber-400 focus:border-amber-400 leading-relaxed"
                        placeholder="Note text..."
                      />

                      {/* Scoping Settings (Expandable) */}
                      {isExpanded && (
                        <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3 space-y-2.5">
                          <div className="font-semibold text-zinc-700 text-[11px]">Note Application Scope:</div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* Day Selection */}
                            <div>
                              <div className="text-[10px] text-zinc-500 font-medium mb-1">Target Days:</div>
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDaysToggle(preset.id, "All")}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                                    targetDays.includes("All")
                                      ? "bg-amber-400 text-zinc-950 font-bold"
                                      : "bg-white border border-zinc-200 text-zinc-600"
                                  }`}
                                >
                                  All
                                </button>
                                {ALL_DAYS.map((day) => (
                                  <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDaysToggle(preset.id, day)}
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                                      !targetDays.includes("All") && targetDays.includes(day)
                                        ? "bg-amber-400 text-zinc-950 font-bold"
                                        : "bg-white border border-zinc-200 text-zinc-600"
                                    }`}
                                  >
                                    {day.slice(0, 3)}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Project Filter */}
                            <div>
                              <div className="text-[10px] text-zinc-500 font-medium mb-1">Target Project #:</div>
                              <select
                                value={
                                  targetProj === "All" || availableProjects.includes(targetProj)
                                    ? targetProj
                                    : "Custom"
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "Custom") {
                                    handleProjectFilterChange(preset.id, "");
                                  } else {
                                    handleProjectFilterChange(preset.id, val);
                                  }
                                }}
                                className="w-full px-2 py-1 bg-white border border-zinc-300 rounded text-xs text-zinc-800"
                              >
                                <option value="All">All Projects</option>
                                {availableProjects.map((p) => (
                                  <option key={p} value={p}>
                                    Project {p}
                                  </option>
                                ))}
                                <option value="Custom">Custom Project #...</option>
                              </select>

                              {((!availableProjects.includes(targetProj) && targetProj !== "All") || targetProj === "") && (
                                <input
                                  type="text"
                                  placeholder="e.g. 26-410081"
                                  value={targetProj === "All" ? "" : targetProj}
                                  onChange={(e) => handleProjectFilterChange(preset.id, e.target.value)}
                                  className="mt-1.5 w-full px-2 py-1 bg-white border border-zinc-300 rounded text-xs text-zinc-800 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
                                />
                              )}
                            </div>

                            {/* Category Filter */}
                            <div>
                              <div className="text-[10px] text-zinc-500 font-medium mb-1">Target Task Type:</div>
                              <select
                                value={targetCat}
                                onChange={(e) => handleCategoryFilterChange(preset.id, e.target.value as any)}
                                className="w-full px-2 py-1 bg-white border border-zinc-300 rounded text-xs text-zinc-800"
                              >
                                <option value="All">All Task Types</option>
                                <option value="Install">Install lines only</option>
                                <option value="Teardown">Teardown lines only</option>
                                <option value="BatterySwap">Battery/SD Swaps only</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Real-time Yellow Highlight Visual Preview */}
                      <div className="bg-[#FFFFF0] border border-amber-200 rounded-lg p-2.5">
                        <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>Outlook Yellow Highlight Preview</span>
                        </div>
                        <div
                          className="text-xs leading-relaxed text-zinc-900 font-sans"
                          dangerouslySetInnerHTML={{
                            __html: renderPresetLinesHtml(preset.text),
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {enabled ? (
              <span className="text-emerald-700 font-medium">
                ✓ {activeCount} active notes will be formatted with yellow highlight under matching task lines.
              </span>
            ) : (
              <span className="text-zinc-500">
                ✕ Additional Notes are currently disabled.
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              type="button"
              className="text-xs font-semibold text-zinc-600 hover:text-zinc-800 px-4 py-2 rounded-lg hover:bg-zinc-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              type="button"
              className="text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white px-5 py-2 rounded-lg shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Apply Notes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
