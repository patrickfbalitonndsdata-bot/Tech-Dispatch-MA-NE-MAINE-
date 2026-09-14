import React from "react";
import { Mail, Settings, Sparkles, ChevronDown, History } from "lucide-react";
import { SAMPLE_DATASETS, SampleDataset } from "../utils/sampleData";

interface NavbarProps {
  activeTab?: "generator" | "history";
  onTabChange?: (tab: "generator" | "history") => void;
  onLoadSample: (sample: SampleDataset) => void;
  onOpenSettings: () => void;
  onOpenSavedHistory?: () => void;
  savedEmailsCount?: number;
  activeDatasetName?: string;
  totalOrdersCount: number;
  techniciansCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab = "generator",
  onTabChange,
  onLoadSample,
  onOpenSettings,
  onOpenSavedHistory,
  savedEmailsCount = 0,
  activeDatasetName,
  totalOrdersCount,
  techniciansCount,
}) => {
  const [sampleMenuOpen, setSampleMenuOpen] = React.useState(false);

  return (
    <header className="bg-white border-b border-zinc-200 text-zinc-900 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-6">
            <div
              className="flex items-center space-x-3 cursor-pointer select-none"
              onClick={() => onTabChange?.("generator")}
            >
              <div className="w-9 h-9 rounded-lg bg-zinc-900 flex items-center justify-center text-white">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm tracking-tight text-zinc-900">Sch Tech Dispatch</span>
                  <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-1.5 py-0.5 rounded border border-zinc-200">
                    Outlook Edition
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500">Scheduling Team Outlook Email Generator via Airtable</p>
              </div>
            </div>

            {/* Top Navigation Tabs */}
            {onTabChange && (
              <div className="hidden sm:flex items-center bg-zinc-100 p-1 rounded-lg border border-zinc-200">
                <button
                  type="button"
                  onClick={() => onTabChange("generator")}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                    activeTab === "generator"
                      ? "bg-white text-zinc-950 shadow-xs border border-zinc-200/80"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span>Generator</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTabChange("history")}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                    activeTab === "history"
                      ? "bg-white text-zinc-950 shadow-xs border border-zinc-200/80"
                      : "text-zinc-600 hover:text-zinc-950"
                  }`}
                >
                  <History className="w-3.5 h-3.5 text-amber-600" />
                  <span>Saved History</span>
                  {savedEmailsCount > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        activeTab === "history"
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {savedEmailsCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center space-x-2 sm:space-x-2.5">
            {/* Mobile Tab Switcher */}
            {onTabChange && (
              <div className="flex sm:hidden items-center bg-zinc-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => onTabChange("generator")}
                  className={`px-2 py-1 text-xs font-semibold rounded ${
                    activeTab === "generator" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
                  }`}
                >
                  Gen
                </button>
                <button
                  type="button"
                  onClick={() => onTabChange("history")}
                  className={`px-2 py-1 text-xs font-semibold rounded flex items-center space-x-1 ${
                    activeTab === "history" ? "bg-white text-zinc-900 shadow-2xs" : "text-zinc-500"
                  }`}
                >
                  <span>Hist</span>
                  {savedEmailsCount > 0 && (
                    <span className="bg-amber-400 text-zinc-950 text-[9px] px-1 rounded-full font-bold">
                      {savedEmailsCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Sample Datasets Dropdown */}
            <div className="relative">
              <button
                onClick={() => setSampleMenuOpen(!sampleMenuOpen)}
                className="flex items-center space-x-1.5 text-xs font-medium bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.75 rounded-lg border border-zinc-200 transition shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Load Sample CSV</span>
                <span className="sm:hidden">Sample</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {sampleMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSampleMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 bg-white border border-zinc-200 rounded-xl shadow-lg z-20 py-1.5 divide-y divide-zinc-100">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Select Industry Template
                    </div>
                    {SAMPLE_DATASETS.map((sample) => (
                      <button
                        key={sample.id}
                        onClick={() => {
                          onLoadSample(sample);
                          setSampleMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-zinc-50 transition flex flex-col space-y-0.5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-zinc-900">{sample.name}</span>
                          <span className="text-[10px] text-zinc-500 bg-zinc-100 px-1.5 py-0.2 rounded">
                            {sample.category}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500 line-clamp-1">{sample.description}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Branding & Template Settings */}
            <button
              onClick={onOpenSettings}
              title="Branding & Outlook Template Settings"
              className="flex items-center space-x-1.5 text-xs font-medium bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-1.75 rounded-lg border border-zinc-200 transition shadow-xs cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
