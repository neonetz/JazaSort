import React, { useState, useEffect, useRef } from 'react';
import {
  SelectFolder,
  ScanFolder,
  SortFolder,
  GetConfig,
  SaveConfig,
  SelectTargetFolder,
  ResetConfig,
  UndoLastSort,
  HasUndoHistory,
  GetLifetimeStats,
  ExportConfig,
  ImportConfig,
  ScanDuplicates,
  DeleteFiles,
  IsSystemPath,
  CancelSort,
  EventsOn
} from './api';

import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Plugin, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js';
import './App.css';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const centerTextPlugin: Plugin<'doughnut'> = {
  id: 'centerText',
  beforeDraw: function (chart) {
    // @ts-ignore
    if (chart.config.options?.plugins?.centerText?.display !== false) {
      const width = chart.width;
      const height = chart.height;
      const ctx = chart.ctx;

      ctx.restore();
      const fontSize = (height / 114).toFixed(2);
      ctx.font = `bold ${fontSize}em sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';

      // @ts-ignore
      const text = chart.config.options?.plugins?.centerText?.text || '';
      const textX = Math.round((width - ctx.measureText(text).width) / 2);
      const textY = height / 2 - 10;

      ctx.fillText(text, textX, textY);

      ctx.font = `normal ${(height / 250).toFixed(2)}em sans-serif`;
      ctx.fillStyle = '#94a3b8';
      const subText = 'TOTAL ITEMS';
      const subTextX = Math.round((width - ctx.measureText(subText).width) / 2);
      ctx.fillText(subText, subTextX, textY + 30);

      ctx.save();
    }
  }
};
ChartJS.register(centerTextPlugin);

type DialogType = 'alert' | 'confirm';
interface DialogState {
  isOpen: boolean;
  type: DialogType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

const DuplicateRow = React.memo(({ file, isChecked, onToggle }: any) => (
  <label className="flex items-start gap-3 p-3 hover:bg-[#27354f] bg-[#0f172a] rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-600">
    <input type="checkbox" className="mt-1 w-4 h-4 rounded bg-slate-900 border-slate-600 text-emerald-500 focus:ring-emerald-500" checked={isChecked} onChange={() => onToggle(file.path)} />
    <div className="overflow-hidden flex-1">
      <div className="text-sm text-slate-200 font-medium truncate" title={file.filename}>{file.filename}</div>
      <div className="text-xs text-slate-500 truncate mt-1" title={file.path}>{file.path}</div>
    </div>
  </label>
));

export default function App() {
  const [activeTab, setActiveTab] = useState<'sorter' | 'cleaner' | 'dashboard'>('sorter');

  // Sorting State
  const [folder, setFolder] = useState<string>('');
  const [recentFolders, setRecentFolders] = useState<string[]>([]);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<any>(null);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [lifetimeStats, setLifetimeStats] = useState<any | null>(null);
  const [lastActionTime, setLastActionTime] = useState<string>('');

  // Favorites & Config State
  const [favoriteFolders, setFavoriteFolders] = useState<string[]>([]);

  // System Warning State
  const [sysWarning, setSysWarning] = useState({ isOpen: false, countdown: 10 });
  const [disableWarningModal, setDisableWarningModal] = useState({ isOpen: false, countdown: 10 });
  const timerRef = useRef<any>(null);
  const disableTimerRef = useRef<any>(null);

  // Help Panel
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Custom Dialog State
  const [dialog, setDialog] = useState<DialogState>({ isOpen: false, type: 'alert', title: '', message: '' });

  // Cleaner State
  const [cleanerFolder, setCleanerFolder] = useState<string>('');
  const [duplicates, setDuplicates] = useState<any[] | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appConfig, setAppConfig] = useState<any | null>(null);

  // New Rule Form State
  const [newCat, setNewCat] = useState('');
  const [newExt, setNewExt] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [minSize, setMinSize] = useState<string>('');
  const [maxSize, setMaxSize] = useState<string>('');

  const showAlert = (title: string, message: string) => {
    setDialog({ isOpen: true, type: 'alert', title, message, onConfirm: () => setDialog(d => ({ ...d, isOpen: false })) });
  };

  const showConfirm = (title: string, message: string, confirmText: string, onConfirm: () => void) => {
    setDialog({ isOpen: true, type: 'confirm', title, message, confirmText, cancelText: 'Batal', onConfirm });
  };

  const closeDialog = () => setDialog(d => ({ ...d, isOpen: false }));

  const checkUndo = async () => {
    const has = await HasUndoHistory();
    setCanUndo(has);
  };

  const loadStats = async () => {
    const s = await GetLifetimeStats();
    setLifetimeStats(s);
  };

  const loadAppConfig = async () => {
    const c = await GetConfig();
    if (c) {
      setAppConfig(c);
      if (c.favorite_folders) {
        setFavoriteFolders(c.favorite_folders);
      }
    }
  };

  useEffect(() => {
    EventsOn("sort-progress", (data) => {
      setProgress(data);
      if (data.isDone) {
        setLoading(false);
        checkUndo();
        loadStats();
        const now = new Date();
        setLastActionTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        if (data.errorMsg) {
          showAlert("Peringatan", data.errorMsg);
        }
      }
    });
    checkUndo();
    loadStats();
    loadAppConfig();
  }, []);

  // System Warning Countdown Logic (When Sorting Protected Path)
  useEffect(() => {
    if (sysWarning.isOpen && sysWarning.countdown > 0) {
      timerRef.current = setTimeout(() => {
        setSysWarning(prev => ({ ...prev, countdown: prev.countdown - 1 }));
      }, 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [sysWarning]);

  // Disable Warning Modal Countdown Logic (10s Countdown Before Disabling Safety Warning Toggle)
  useEffect(() => {
    if (disableWarningModal.isOpen && disableWarningModal.countdown > 0) {
      disableTimerRef.current = setTimeout(() => {
        setDisableWarningModal(prev => ({ ...prev, countdown: prev.countdown - 1 }));
      }, 1000);
    }
    return () => clearTimeout(disableTimerRef.current);
  }, [disableWarningModal]);

  const openSettings = async () => {
    await loadAppConfig();
    setIsSettingsOpen(true);
  };

  const saveSettings = async () => {
    if (appConfig) {
      await SaveConfig(appConfig);
      setFavoriteFolders(appConfig.favorite_folders || []);
      setIsSettingsOpen(false);
      if (folder) {
        setLoading(true);
        const res = await ScanFolder(folder);
        setScanResult(res);
        setLoading(false);
      }
    }
  };

  const resetSettings = () => {
    showConfirm("Reset Pengaturan", "Apakah Anda yakin ingin mengembalikan semua aturan ke pengaturan pabrik?", "Reset ke Default", async () => {
      closeDialog();
      const c = await ResetConfig();
      setAppConfig(c);
      if (c.favorite_folders) setFavoriteFolders(c.favorite_folders);
      if (folder) {
        setLoading(true);
        const res = await ScanFolder(folder);
        setScanResult(res);
        setLoading(false);
      }
    });
  };

  const handleExport = async () => {
    try {
      await ExportConfig();
      showAlert("Berhasil", "Pengaturan berhasil diekspor!");
    } catch (e) {
      console.error(e);
    }
  };

  const handleImport = async () => {
    try {
      const c = await ImportConfig();
      setAppConfig(c);
      if (c.favorite_folders) setFavoriteFolders(c.favorite_folders);
      if (folder) {
        const res = await ScanFolder(folder);
        setScanResult(res);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectTarget = async () => {
    const selected = await SelectTargetFolder();
    if (selected) {
      setNewTarget(selected);
    }
  };

  const addRule = () => {
    if (!newCat || !newTarget || appConfig === null) return;
    if (!newExt && !newKeywords) return;

    const exts = newExt ? newExt.split(',').map(e => e.trim().toLowerCase()).filter(e => e.startsWith('.')) : [];
    const kws = newKeywords ? newKeywords.split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0) : [];
    let minMB = parseFloat(minSize);
    let maxMB = parseFloat(maxSize);

    const newRule = {
      category: newCat,
      extensions: exts,
      target_folder: newTarget,
      keywords: kws,
      min_size_mb: isNaN(minMB) ? 0 : minMB,
      max_size_mb: isNaN(maxMB) ? 0 : maxMB,
    };

    setAppConfig({ ...appConfig, rules: [...(appConfig.rules || []), newRule as any] } as any);
    setNewCat(''); setNewExt(''); setNewKeywords(''); setNewTarget(''); setMinSize(''); setMaxSize('');
  };

  const deleteRule = (index: number) => {
    if (!appConfig) return;
    const newRules = [...appConfig.rules];
    newRules.splice(index, 1);
    setAppConfig({ ...appConfig, rules: newRules } as any);
  };

  // Add Favorite Folder
  const handleAddFavorite = async () => {
    const selected = await SelectFolder();
    if (selected) {
      const current = appConfig?.favorite_folders || favoriteFolders || [];
      if (!current.includes(selected)) {
        const updated = [...current, selected];
        setFavoriteFolders(updated);
        if (appConfig) {
          const newCfg = { ...appConfig, favorite_folders: updated };
          setAppConfig(newCfg);
          await SaveConfig(newCfg);
        }
      }
    }
  };

  // Remove Favorite Folder
  const handleRemoveFavorite = async (pathToRemove: string) => {
    const updated = (appConfig?.favorite_folders || favoriteFolders).filter((p: string) => p !== pathToRemove);
    setFavoriteFolders(updated);
    if (appConfig) {
      const newCfg = { ...appConfig, favorite_folders: updated };
      setAppConfig(newCfg);
      await SaveConfig(newCfg);
    }
  };

  const executeFolderScan = async (path: string) => {
    setFolder(path);
    setLoading(true);
    setScanResult(null);
    setProgress(null);
    try {
      const res = await ScanFolder(path);
      setScanResult(res);
      setRecentFolders(prev => [path, ...prev.filter(p => p !== path)].slice(0, 5));
      setLastActionTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      showAlert("Error", "Target folder tidak ditemukan atau akses ditolak.");
    }
    setLoading(false);
  };

  const handleSelectFolder = async () => {
    const selected = await SelectFolder();
    if (selected) {
      await executeFolderScan(selected);
    }
  };

  // 1-Click Sort Favorite Folder (Bypasses 10s Delay!)
  const handleQuickSortFavorite = async (favPath: string) => {
    await executeFolderScan(favPath);
    executeSortForFolder(favPath);
  };

  const handlePreSortCheck = async () => {
    if (!folder) return;
    const isSys = await IsSystemPath(folder);
    if (isSys) {
      setSysWarning({ isOpen: true, countdown: 10 });
    } else {
      executeSortForFolder(folder);
    }
  };

  const executeSortForFolder = (targetFolder: string) => {
    setSysWarning({ isOpen: false, countdown: 10 });
    setLoading(true);
    setProgress({ totalMoved: 0, totalErrors: 0, isDone: false });
    SortFolder(targetFolder);
  };

  const handleCancelSort = () => {
    CancelSort();
  };

  const handleToggleWarnSystemPath = (currentlyOn: boolean) => {
    if (currentlyOn) {
      // User is attempting to turn OFF safety warning -> Trigger 10s countdown confirmation modal!
      setDisableWarningModal({ isOpen: true, countdown: 10 });
    } else {
      // User is turning safety warning back ON -> Apply immediately
      if (appConfig) {
        setAppConfig({ ...appConfig, warn_system_path: true });
      }
    }
  };

  const confirmDisableWarning = () => {
    if (appConfig) {
      setAppConfig({ ...appConfig, warn_system_path: false });
    }
    setDisableWarningModal({ isOpen: false, countdown: 10 });
  };

  const handleSelectCleanerFolder = async () => {
    const selected = await SelectFolder();
    if (selected) {
      setCleanerFolder(selected);
      setDuplicates(null);
    }
  };

  const handleScanDuplicates = async () => {
    if (!cleanerFolder) return;
    setLoading(true);
    setDuplicates(null);
    try {
      const res = await ScanDuplicates(cleanerFolder);
      setDuplicates(res || []);
      setSelectedForDeletion(new Set());
    } catch (e) {
      showAlert("Error", "Gagal memindai file duplikat.");
    }
    setLoading(false);
  };

  const toggleSelectAll = (groupIndex: number) => {
    if (!duplicates) return;
    const group = duplicates[groupIndex];
    const newSelected = new Set(selectedForDeletion);

    const allChecked = group.files.every(f => newSelected.has(f.path));

    if (allChecked) {
      group.files.forEach(f => newSelected.delete(f.path));
    } else {
      group.files.slice(1).forEach(f => newSelected.add(f.path));
    }
    setSelectedForDeletion(newSelected);
  };

  const toggleSelectFile = (path: string) => {
    const newSelected = new Set(selectedForDeletion);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedForDeletion(newSelected);
  };

  const handleDeleteSelected = () => {
    const paths = Array.from(selectedForDeletion);
    if (paths.length === 0) return;

    showConfirm("Konfirmasi Hapus", `Apakah Anda yakin ingin menghapus ${paths.length} file duplikat secara permanen?`, "Hapus Permanen", async () => {
      closeDialog();
      setLoading(true);
      try {
        const [deletedCount] = await DeleteFiles(paths);
        showAlert("Berhasil", `${deletedCount} file duplikat berhasil dihapus.`);
        handleScanDuplicates();
      } catch (e) {
        showAlert("Error", "Gagal menghapus beberapa file.");
        setLoading(false);
      }
    });
  };

  const handleUndo = async () => {
    showConfirm("Undo Penyortiran", "Apakah Anda yakin ingin mengembalikan file yang baru saja dipindahkan ke lokasi asalnya?", "Undo Sekarang", async () => {
      closeDialog();
      setLoading(true);
      try {
        const count = await UndoLastSort();
        showAlert("Undo Berhasil", `Berhasil mengembalikan ${count} file ke folder asal.`);
        checkUndo();
        loadStats();
        if (folder) {
          const res = await ScanFolder(folder);
          setScanResult(res);
        }
      } catch (e) {
        showAlert("Error", "Gagal melakukan undo penyortiran.");
      }
      setLoading(false);
    });
  };

  // Visual Chart Data
  const getChartData = () => {
    if (!scanResult || !scanResult.stats || scanResult.stats.length === 0) {
      return {
        labels: ['Tidak Ada Item'],
        datasets: [{
          data: [1],
          backgroundColor: ['#334155'],
          borderWidth: 0,
        }]
      };
    }

    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
      '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#64748b'
    ];

    return {
      labels: scanResult.stats.map((s: any) => s.ext),
      datasets: [{
        data: scanResult.stats.map((s: any) => s.count),
        backgroundColor: colors.slice(0, scanResult.stats.length),
        borderWidth: 2,
        borderColor: '#0f172a',
      }]
    };
  };

  // Lifetime History Line Chart
  const getHistoryChartData = () => {
    if (!lifetimeStats || !lifetimeStats.history) return null;
    const dates = Object.keys(lifetimeStats.history).sort();
    const last7 = dates.slice(-7);

    return {
      labels: last7.map(d => d.slice(5)),
      datasets: [
        {
          label: 'File Dipindahkan',
          data: last7.map(d => lifetimeStats.history[d].files_moved),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Ukuran (MB)',
          data: last7.map(d => Math.round(lifetimeStats.history[d].mb_moved)),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
          fill: true,
        }
      ]
    };
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-100 font-sans select-none overflow-hidden border border-slate-800">
      
      {/* Jakob's Heuristic #4 & #8: Minimalist Solid Top Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#1e293b] border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center font-bold text-white shadow-lg">
            JS
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide text-white flex items-center gap-2">
              JazaSort <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded font-mono">RUST v2</span>
            </h1>
            <p className="text-[11px] text-slate-400">Pengorganisir File Otomatis & Keamanan Cerdas</p>
          </div>
        </div>

        {/* Navigation Tabs - Jakob's Heuristic #6: Recognition Rather Than Recall */}
        <nav className="flex items-center bg-[#0f172a] p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('sorter')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'sorter' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📁</span> Sorter File
          </button>

          <button
            onClick={() => setActiveTab('cleaner')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'cleaner' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🧹</span> Pembersih Duplikat
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>📊</span> Dashboard Status
          </button>
        </nav>

        {/* Global Action Bar */}
        <div className="flex items-center gap-2">
          {canUndo && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-colors shadow-sm"
              title="Undo Penyortiran Terakhir (Jakob: Freedom & Control)"
            >
              <span>↩️</span> Undo Last Sort
            </button>
          )}

          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#27354f] transition-colors"
            title="Panduan & Tips Keamanan"
          >
            ❓
          </button>

          <button
            onClick={openSettings}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#27354f] transition-colors"
            title="Pengaturan Aturan & Keamanan"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden p-6 relative">
        
        {/* TAB 1: FILE SORTER */}
        {activeTab === 'sorter' && (
          <div className="h-full flex flex-col gap-5">
            
            {/* Jakob's Heuristic #7: Flexibility & Efficiency - Favorite Folders Bar */}
            <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-800 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                  <span>⭐</span> FOLDER FAVORIT (TANPA DELAY 10S)
                </div>
                <button
                  onClick={handleAddFavorite}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1"
                >
                  <span>➕</span> Tambah Favorit
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {favoriteFolders.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">Belum ada folder favorit ditambahkan.</span>
                ) : (
                  favoriteFolders.map((favPath, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-[#0f172a] border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-sm group hover:border-blue-500/50 transition-colors"
                    >
                      <span className="text-xs text-slate-200 font-medium truncate max-w-[200px]" title={favPath}>
                        📁 {favPath.split(/[/\\]/).pop() || favPath}
                      </span>

                      {/* 1-Click Instant Sort Button */}
                      <button
                        onClick={() => handleQuickSortFavorite(favPath)}
                        className="text-[10px] bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded transition-all font-semibold"
                        title="Sort Langsung (Bypass Peringatan 10s)"
                      >
                        🚀 Sort Saja
                      </button>

                      <button
                        onClick={() => handleRemoveFavorite(favPath)}
                        className="text-slate-500 hover:text-red-400 text-xs px-1"
                        title="Hapus dari Favorit"
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Main Selector & Action Control */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 flex-1 overflow-hidden">
              
              {/* Left Column: Target Folder & Stats */}
              <div className="md:col-span-1 flex flex-col gap-4 bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-sm overflow-y-auto custom-scrollbar">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                    Target Folder
                  </label>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectFolder}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-4 py-2.5 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                    >
                      <span>📂</span> Pilih Folder
                    </button>
                  </div>

                  {folder && (
                    <div className="mt-3 p-3 bg-[#0f172a] rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-400 mb-1">Folder Terpilih:</div>
                      <div className="text-xs font-mono text-blue-300 break-all font-medium">{folder}</div>
                    </div>
                  )}
                </div>

                {/* Recent Folders Quick Selection */}
                {recentFolders.length > 0 && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Riwayat Folder Terakhir
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {recentFolders.map((rf, i) => (
                        <button
                          key={i}
                          onClick={() => executeFolderScan(rf)}
                          className="text-left text-xs text-slate-300 hover:text-white bg-[#0f172a] hover:bg-[#27354f] p-2 rounded border border-slate-800/80 truncate transition-colors"
                          title={rf}
                        >
                          🕒 {rf.split(/[/\\]/).pop()} <span className="text-[10px] text-slate-500">({rf})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Item Summary Card */}
                {scanResult && (
                  <div className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 flex flex-col gap-3 mt-auto">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Total File Siap Disortir:</span>
                      <span className="text-sm font-bold text-emerald-400">{scanResult.totalSortable}</span>
                    </div>

                    <button
                      onClick={handlePreSortCheck}
                      disabled={loading || scanResult.totalSortable === 0}
                      className={`w-full py-3 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 ${
                        loading || scanResult.totalSortable === 0
                          ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                          : 'bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white shadow-emerald-900/40'
                      }`}
                    >
                      {loading ? (
                        <>
                          <span className="animate-spin">⏳</span> Menyortir...
                        </>
                      ) : (
                        <>
                          <span>⚡</span> Jalankan Sortir File Sekarang
                        </>
                      )}
                    </button>

                    {loading && (
                      <button
                        onClick={handleCancelSort}
                        className="w-full py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/50 rounded-lg text-xs font-semibold transition-colors"
                      >
                        ⛔ Batalkan Sortir
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Visual Category Breakdown Chart */}
              <div className="md:col-span-2 bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col justify-between overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <span>📊</span> Komposisi Ekstensi File
                  </h3>
                  {lastActionTime && (
                    <span className="text-[11px] text-slate-500">Pembaruan Terakhir: {lastActionTime}</span>
                  )}
                </div>

                <div className="flex-1 flex items-center justify-center relative max-h-[340px]">
                  <Doughnut
                    data={getChartData()}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 11 } } },
                        // @ts-ignore
                        centerText: { display: true, text: `${scanResult?.totalSortable || 0}` }
                      }
                    }}
                  />
                </div>

                {/* Progress Indicator */}
                {progress && (
                  <div className="mt-4 p-3 bg-[#0f172a] rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-300">
                      Proses: <strong className="text-emerald-400">{progress.totalMoved}</strong> dipindahkan,{' '}
                      <strong className="text-red-400">{progress.totalErrors}</strong> error
                    </span>
                    <span className="text-slate-500">{progress.isDone ? '✅ Selesai' : '⏳ Berjalan...'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DUPLICATE CLEANER */}
        {activeTab === 'cleaner' && (
          <div className="h-full flex flex-col gap-4 bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🧹</span> Pembersih File Duplikat Multi-Tahap (SHA-256)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Memindai file identik (byte-for-byte) secara aman dengan 3-stage hashing untuk menghemat ruang penyimpanan.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectCleanerFolder}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                >
                  Pilih Folder ({cleanerFolder ? cleanerFolder.split(/[/\\]/).pop() : 'Belum Dipilih'})
                </button>

                <button
                  onClick={handleScanDuplicates}
                  disabled={!cleanerFolder || loading}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-1.5 rounded-lg shadow transition-colors disabled:opacity-50"
                >
                  Pindai Duplikat
                </button>
              </div>
            </div>

            {/* Duplicates List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 pr-1">
              {!duplicates ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                  <span>🔍 Pilih folder lalu klik "Pindai Duplikat" untuk mencari file ganda.</span>
                </div>
              ) : duplicates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-emerald-400 text-xs font-medium">
                  <span>🎉 Selamat! Tidak ditemukan file duplikat di folder ini.</span>
                </div>
              ) : (
                duplicates.map((group, gIdx) => (
                  <div key={gIdx} className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/60">
                      <span className="font-mono text-slate-400 text-[11px]">HASH: {group.hash.slice(0, 16)}...</span>
                      <button
                        onClick={() => toggleSelectAll(gIdx)}
                        className="text-blue-400 hover:underline text-[11px]"
                      >
                        Pilih Duplikat (Kecuali Asli)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {group.files.map((file: any, fIdx: number) => (
                        <DuplicateRow
                          key={fIdx}
                          file={file}
                          isChecked={selectedForDeletion.has(file.path)}
                          onToggle={toggleSelectFile}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedForDeletion.size > 0 && (
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Dipilih untuk dihapus: <strong className="text-amber-400">{selectedForDeletion.size} file</strong>
                </span>

                <button
                  onClick={handleDeleteSelected}
                  className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition-colors"
                >
                  Hapus Terpilih Permanen
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DASHBOARD & LIFETIME STATS */}
        {activeTab === 'dashboard' && (
          <div className="h-full flex flex-col gap-5 overflow-y-auto custom-scrollbar pr-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col">
                <span className="text-xs font-semibold text-slate-400">Total File Dipindahkan</span>
                <span className="text-2xl font-bold text-blue-400 mt-2">{lifetimeStats?.total_files || 0}</span>
                <span className="text-[11px] text-slate-500 mt-1">Sejak awal penggunaan</span>
              </div>

              <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col">
                <span className="text-xs font-semibold text-slate-400">Total Ruang Dibereskan</span>
                <span className="text-2xl font-bold text-emerald-400 mt-2">
                  {((lifetimeStats?.total_mb || 0) / 1024).toFixed(2)} GB
                </span>
                <span className="text-[11px] text-slate-500 mt-1">Total {Math.round(lifetimeStats?.total_mb || 0)} MB</span>
              </div>

              <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-sm flex flex-col">
                <span className="text-xs font-semibold text-slate-400">Status Keamanan System</span>
                <span className={`text-sm font-bold mt-2 ${appConfig?.warn_system_path ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {appConfig?.warn_system_path ? '🛡️ Aktif (Peringatan 10s)' : '⚠️ Menonaktifkan Peringatan'}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">{favoriteFolders.length} Folder Favorit Dibebaskan</span>
              </div>
            </div>

            {/* History Line Chart */}
            <div className="bg-[#1e293b] p-5 rounded-xl border border-slate-800 shadow-sm flex-1 min-h-[300px] flex flex-col">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">
                📈 Riwayat Aktivitas 7 Hari Terakhir
              </h3>
              <div className="flex-1 relative">
                {getHistoryChartData() ? (
                  <Line
                    data={getHistoryChartData()!}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                        y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
                      }
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-slate-500">
                    Belum ada data aktivitas historis.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MODAL: 10s COUNTDOWN SYSTEM PATH WARNING */}
      {sysWarning.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-amber-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-amber-400">
              <span className="text-2xl">⚠️</span>
              <h3 className="font-bold text-base text-white">Peringatan Keamanan Folder System</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Folder yang Anda pilih (<strong className="text-amber-300">{folder}</strong>) berada di dalam lokasi proteksi sistem (C:\ Drive / Windows).
              Penyortiran dapat memindahkan file sistem secara tidak sengaja.
            </p>

            <div className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 text-center flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400">Waktu Tunggu Keamanan:</span>
              <span className="text-3xl font-bold font-mono text-amber-400">{sysWarning.countdown} Detik</span>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setSysWarning({ isOpen: false, countdown: 10 })}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Batal (Sangat Aman)
              </button>

              <button
                onClick={handlePreSortCheck}
                disabled={sysWarning.countdown > 0}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  sysWarning.countdown > 0
                    ? 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
                    : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/40'
                }`}
              >
                {sysWarning.countdown > 0 ? `Tunggu (${sysWarning.countdown}s)...` : 'Lanjutkan Sortir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: 10s COUNTDOWN BEFORE DISABLING SYSTEM WARNING TOGGLE (Jakob Heuristic #5: Error Prevention) */}
      {disableWarningModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-red-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-red-400">
              <span className="text-2xl">🛑</span>
              <h3 className="font-bold text-base text-white">Konfirmasi Mematikan Peringatan Keamanan</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Anda mencoba <strong className="text-red-400">mematikan Peringatan Keamanan System Path 10 Detik</strong>.
              Mematikan fitur ini berisiko menyebabkan folder sistem disortir secara tidak sengaja tanpa penundaan.
              Harap baca dan tunggu selama 10 detik sebelum mengonfirmasi.
            </p>

            <div className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 text-center flex flex-col items-center gap-2">
              <span className="text-xs text-slate-400">Hitung Mundur Konfirmasi:</span>
              <span className="text-3xl font-bold font-mono text-red-400">{disableWarningModal.countdown} Detik</span>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setDisableWarningModal({ isOpen: false, countdown: 10 })}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Batal (Tetap Amankan)
              </button>

              <button
                onClick={confirmDisableWarning}
                disabled={disableWarningModal.countdown > 0}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  disableWarningModal.countdown > 0
                    ? 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40'
                }`}
              >
                {disableWarningModal.countdown > 0 ? `Tunggu (${disableWarningModal.countdown}s)...` : 'Ya, Matikan Peringatan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SETTINGS & CONFIG MANAGER */}
      {isSettingsOpen && appConfig && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden gap-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <span>⚙️</span> Pengaturan Aturan & Keamanan
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white text-lg">×</button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-5 pr-1">
              
              {/* Safety Toggles Section */}
              <div className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">🛡️ Opsi Keamanan System</h4>
                
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">Peringatan Keamanan System Path (10 Detik)</div>
                    <div className="text-[11px] text-slate-500">Mencegah penyortiran tidak sengaja di folder C:\ / Windows. (Mematikan butuh konfirmasi 10s)</div>
                  </div>
                  <button
                    onClick={() => handleToggleWarnSystemPath(appConfig.warn_system_path)}
                    className={`w-12 h-6 rounded-full transition-colors relative p-1 ${
                      appConfig.warn_system_path ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      appConfig.warn_system_path ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Manage Favorite Folders Section */}
              <div className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">⭐ Kelola Folder Favorit</h4>
                  <button onClick={handleAddFavorite} className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1 rounded">
                    + Tambah
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  {(appConfig.favorite_folders || []).map((fav: string, i: number) => (
                    <div key={i} className="flex items-center justify-between bg-[#1e293b] px-3 py-2 rounded-lg border border-slate-800 text-xs">
                      <span className="text-slate-200 truncate font-mono" title={fav}>📁 {fav}</span>
                      <button onClick={() => handleRemoveFavorite(fav)} className="text-red-400 hover:text-red-300 font-bold ml-2">Hapus</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Rule Form */}
              <div className="bg-[#0f172a] p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">➕ Tambah Aturan Penyortiran Baru</h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <input
                    type="text"
                    placeholder="Nama Kategori (mis: Dokumen)"
                    value={newCat}
                    onChange={e => setNewCat(e.target.value)}
                    className="bg-[#1e293b] border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Ekstensi (mis: .pdf,.docx)"
                    value={newExt}
                    onChange={e => setNewExt(e.target.value)}
                    className="bg-[#1e293b] border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Folder Tujuan"
                    value={newTarget}
                    onChange={e => setNewTarget(e.target.value)}
                    className="flex-1 bg-[#1e293b] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <button onClick={handleSelectTarget} className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 rounded-lg border border-slate-700">
                    Pilih Target
                  </button>
                </div>

                <button onClick={addRule} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2 rounded-lg transition-colors">
                  Simpan Aturan Baru
                </button>
              </div>

              {/* Rules List */}
              <div className="flex flex-col gap-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Daftar Aturan Aktif ({appConfig.rules?.length || 0})</h4>
                {appConfig.rules?.map((rule: any, idx: number) => (
                  <div key={idx} className="bg-[#0f172a] p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-blue-300">{rule.category}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5">Target: {rule.target_folder}</div>
                      <div className="text-slate-500 text-[10px] mt-0.5">Ext: {rule.extensions?.join(', ')}</div>
                    </div>
                    <button onClick={() => deleteRule(idx)} className="text-red-400 hover:text-red-300 text-xs">Hapus</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
              <div className="flex gap-2">
                <button onClick={handleExport} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">Ekspor JSON</button>
                <button onClick={handleImport} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700">Impor JSON</button>
                <button onClick={resetSettings} className="text-xs bg-red-900/30 hover:bg-red-900/50 text-red-300 px-3 py-1.5 rounded-lg border border-red-800/50">Reset Default</button>
              </div>

              <button onClick={saveSettings} className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-lg shadow transition-colors">
                Simpan & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HELP & DIALOG MODALS */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">❓ Panduan Penggunaan & Keamanan</h3>
              <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-white">×</button>
            </div>

            <div className="text-xs text-slate-300 flex flex-col gap-3 leading-relaxed">
              <p><strong>1. Folder Favorit & Bypass 10s:</strong> Folder yang berada dalam daftar Favorit (Default: Downloads) secara otomatis dibebaskan dari waktu tunggu peringatan 10 detik.</p>
              <p><strong>2. Peringatan Keamanan System Path:</strong> Menyortir folder di drive sistem C:\ memerlukan konfirmasi waktu tunggu 10 detik untuk mencegah kesalahan pemindahan file OS.</p>
              <p><strong>3. Mematikan Fitur Keamanan:</strong> Jika Anda mematikan tombol peringatan di Pengaturan, aplikasi memerlukan waktu tunggu 10 detik sebagai konfirmasi pengamanan ekstra sebelum fitur dinonaktifkan.</p>
            </div>

            <button onClick={() => setIsHelpOpen(false)} className="bg-blue-600 text-white font-bold text-xs py-2 rounded-lg">Paham</button>
          </div>
        </div>
      )}

      {dialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-slate-700 rounded-2xl max-w-sm w-full p-6 shadow-2xl flex flex-col gap-4 text-center">
            <h3 className="font-bold text-sm text-white">{dialog.title}</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{dialog.message}</p>

            <div className="flex gap-2 mt-2">
              {dialog.type === 'confirm' && (
                <button onClick={closeDialog} className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg">
                  {dialog.cancelText || 'Batal'}
                </button>
              )}
              <button
                onClick={() => {
                  if (dialog.onConfirm) dialog.onConfirm();
                  closeDialog();
                }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow"
              >
                {dialog.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
