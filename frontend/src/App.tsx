import React, { useState, useEffect, useRef } from 'react';
import { SelectFolder, ScanFolder, SortFolder, GetConfig, SaveConfig, SelectTargetFolder, ResetConfig, UndoLastSort, HasUndoHistory, GetLifetimeStats, ExportConfig, ImportConfig, ScanDuplicates, DeleteFiles, IsSystemPath, CancelSort, EventsOn } from './api';

import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Plugin, CategoryScale, LinearScale, PointElement, LineElement } from 'chart.js';
import './App.css';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

const centerTextPlugin: Plugin<'doughnut'> = {
  id: 'centerText',
  beforeDraw: function(chart) {
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

const DuplicateRow = React.memo(({ file, isChecked, onToggle, color }: any) => (
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
  const [scanResult, setScanResult] = useState<main.ScanResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<any>(null);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [lifetimeStats, setLifetimeStats] = useState<stats.LifetimeStats | null>(null);
  const [lastActionTime, setLastActionTime] = useState<string>('');
  
  // System Warning State
  const [sysWarning, setSysWarning] = useState({ isOpen: false, countdown: 10 });
  const timerRef = useRef<any>(null);

  // Help Panel
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Custom Dialog State
  const [dialog, setDialog] = useState<DialogState>({ isOpen: false, type: 'alert', title: '', message: '' });

  // Cleaner State
  const [cleanerFolder, setCleanerFolder] = useState<string>('');
  const [duplicates, setDuplicates] = useState<cleaner.DuplicateGroup[] | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appConfig, setAppConfig] = useState<config.Config | null>(null);
  
  // New Rule Form State
  const [newCat, setNewCat] = useState('');
  const [newExt, setNewExt] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [minSize, setMinSize] = useState<string>('');
  const [maxSize, setMaxSize] = useState<string>('');

  const showAlert = (title: string, message: string) => {
    setDialog({ isOpen: true, type: 'alert', title, message, onConfirm: () => setDialog(d => ({...d, isOpen: false})) });
  };

  const showConfirm = (title: string, message: string, confirmText: string, onConfirm: () => void) => {
    setDialog({ isOpen: true, type: 'confirm', title, message, confirmText, cancelText: 'Cancel', onConfirm });
  };

  const closeDialog = () => setDialog(d => ({...d, isOpen: false}));

  const checkUndo = async () => {
    const has = await HasUndoHistory();
    setCanUndo(has);
  };

  const loadStats = async () => {
    const s = await GetLifetimeStats();
    setLifetimeStats(s);
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
          showAlert("Warning", data.errorMsg);
        }
      }
    });
    checkUndo();
    loadStats();
  }, []);

  // System Warning Countdown Logic
  useEffect(() => {
    if (sysWarning.isOpen && sysWarning.countdown > 0) {
      timerRef.current = setTimeout(() => {
        setSysWarning(prev => ({ ...prev, countdown: prev.countdown - 1 }));
      }, 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [sysWarning]);

  const openSettings = async () => {
    const c = await GetConfig();
    setAppConfig(c);
    setIsSettingsOpen(true);
  };

  const saveSettings = async () => {
    if (appConfig) {
      await SaveConfig(appConfig);
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
    showConfirm("Reset Rules", "Are you sure you want to reset all rules to their default settings?", "Reset to Default", async () => {
      closeDialog();
      const c = await ResetConfig();
      setAppConfig(c);
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
      showAlert("Success", "Settings exported successfully!");
    } catch(e) {
      console.error(e);
    }
  };

  const handleImport = async () => {
    try {
      const c = await ImportConfig();
      setAppConfig(c);
      if (folder) {
        const res = await ScanFolder(folder);
        setScanResult(res);
      }
    } catch(e) {
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

  const executeFolderScan = async (path: string) => {
    setFolder(path);
    setLoading(true);
    setScanResult(null);
    setProgress(null);
    try {
      const res = await ScanFolder(path);
      setScanResult(res);
      // add to recents
      setRecentFolders(prev => {
        const newRecents = [path, ...prev.filter(p => p !== path)].slice(0, 5);
        return newRecents;
      });
      setLastActionTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      showAlert("Error", "Target not found or access denied.");
    }
    setLoading(false);
  };

  const handleSelectFolder = async () => {
    const selected = await SelectFolder();
    if (selected) {
      await executeFolderScan(selected);
    }
  };

  const handlePreSortCheck = async () => {
    if (!folder) return;
    const isSys = await IsSystemPath(folder);
    if (isSys) {
      setSysWarning({ isOpen: true, countdown: 10 });
    } else {
      executeSort();
    }
  };

  const executeSort = () => {
    setSysWarning({ isOpen: false, countdown: 10 });
    setLoading(true);
    setProgress({ totalMoved: 0, totalErrors: 0, isDone: false });
    SortFolder(folder);
  };

  const handleCancelSort = () => {
    CancelSort();
  };

  const handleSelectCleanerFolder = async () => {
    const selected = await SelectFolder();
    if (selected) setCleanerFolder(selected); setDuplicates(null);
  };

  const handleScanDuplicates = async () => {
    if (!cleanerFolder) return;
    setLoading(true);
    setDuplicates(null);
    setSelectedForDeletion(new Set());
    try {
      const res = await ScanDuplicates(cleanerFolder);
      setDuplicates(res || []);
    } catch(e) {
      console.error(e);
    }
    setLoading(false);
  };

  const toggleDeleteSelection = (path: string) => {
    const newSet = new Set(selectedForDeletion);
    if (newSet.has(path)) newSet.delete(path);
    else newSet.add(path);
    setSelectedForDeletion(newSet);
  };

  const handleDeleteSelected = () => {
    if (selectedForDeletion.size === 0) return;
    showConfirm("Delete Files", `Are you sure you want to delete ${selectedForDeletion.size} files permanently? This cannot be undone.`, "Delete Files", async () => {
      closeDialog();
      setLoading(true);
      const paths = Array.from(selectedForDeletion);
      const deleted = await DeleteFiles(paths);
      showAlert("Success", `Deleted ${deleted} files successfully.`);
      await handleScanDuplicates();
      setLoading(false);
    });
  };

  const handleUndo = async () => {
    setLoading(true);
    try {
      await UndoLastSort();
      await checkUndo();
      await loadStats();
      if (folder) {
        const res = await ScanFolder(folder);
        setScanResult(res);
        setProgress(null);
        setLastActionTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const insertMacro = (macro: string) => {
    setNewTarget(prev => prev + macro);
  };

  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#64748b'];

  const chartData = {
    labels: scanResult?.stats?.map(s => s.ext) || [],
    datasets: [{
      data: scanResult?.stats?.map(s => s.count) || [],
      backgroundColor: colors,
      borderWidth: 2,
      borderColor: '#0f172a',
      hoverOffset: 4,
    }],
  };

  const chartOptions = {
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#f8fafc', borderColor: '#334155', borderWidth: 1 },
      // @ts-ignore
      centerText: { display: true, text: scanResult ? scanResult.totalSortable.toString() : '0' }
    }
  };

  const getLineData = () => {
    if (!lifetimeStats || !lifetimeStats.history) return { labels: [], datasets: [] };
    const dates = Object.keys(lifetimeStats.history).sort();
    const recent = dates.slice(-14);
    return {
      labels: recent,
      datasets: [{
        label: 'Files Organized',
        data: recent.map(d => lifetimeStats.history[d].files_moved),
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f6',
        tension: 0.3,
      }]
    };
  };

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1e293b', titleColor: '#f8fafc', bodyColor: '#f8fafc', borderColor: '#334155', borderWidth: 1 }, centerText: { display: false } },
    scales: { x: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } }, y: { grid: { color: '#1e293b' }, ticks: { color: '#94a3b8' } } }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b1120]/40 text-slate-200 font-sans overflow-hidden select-none relative">
      
      {/* TOP BAR */}
      <div className="h-14 bg-[#1e293b]/60 backdrop-blur-md border-b border-slate-700/50 flex items-center justify-between px-6 shadow-md z-10 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 border-r border-slate-700 pr-6">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            <span className="font-semibold text-lg tracking-wide text-white">JazaSort <span className="text-xs text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded ml-1 border border-blue-800">v1.0.1-beta.4</span></span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setActiveTab('sorter')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'sorter' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>Sorter</button>
            <button onClick={() => setActiveTab('cleaner')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'cleaner' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>Cleaner</button>
            <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>Analytics</button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-400 flex items-center gap-2">
            {loading && <svg className="w-4 h-4 text-blue-400 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="3" stroke="currentColor" strokeDasharray="16 16" strokeLinecap="round"/></svg>}
            {lastActionTime && <span className="bg-slate-800 px-2 py-1 rounded text-xs border border-slate-700">Last update: {lastActionTime}</span>}
          </div>
          <button onClick={() => setIsHelpOpen(true)} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white" title="Help & Documentation">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>
          <button onClick={openSettings} className="p-2 hover:bg-slate-700 rounded-full transition-colors text-slate-400 hover:text-white" title="Settings">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        
        {/* SORTER VIEW */}
        {activeTab === 'sorter' && (
          <div className="flex flex-1 w-full h-full absolute inset-0">
        {/* LEFT SIDEBAR */}
        <div className="w-64 bg-[#0b1120]/40 backdrop-blur-sm border-r border-slate-800/50 flex flex-col">
          <div className="p-4">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 pl-2">Navigation</div>
                <button onClick={handleSelectFolder} disabled={loading} className="w-full flex items-center gap-3 px-3 py-2 rounded-md bg-[#1e293b] hover:bg-[#27354f] border border-slate-700 transition-colors text-left shadow-sm">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  <span className="text-sm font-medium text-slate-200">Choose Folder...</span>
                </button>
              </div>

              <div className="flex-1 px-4 py-2 overflow-y-auto">
                {folder && (
                  <div className="mt-2 mb-6">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-2">Target Workspace</div>
                    <div className="px-3 py-2 bg-[#0f172a] rounded-md text-xs font-mono text-slate-400 break-all border border-slate-800 shadow-inner">
                      {folder}
                    </div>
                  </div>
                )}
                {recentFolders.length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 pl-2">Recent</div>
                    <div className="space-y-1">
                      {recentFolders.map(rf => (
                        <button key={rf} onClick={() => executeFolderScan(rf)} className="w-full text-left px-3 py-1.5 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 truncate transition-colors" title={rf}>
                          {rf.split('\\').pop() || rf.split('/').pop()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-slate-800 bg-[#0b1120]">
                {progress && progress.isDone ? (
                  <div className="text-center py-3 px-3 bg-[#1e293b] border border-slate-700 rounded-lg shadow-lg">
                    <div className="text-emerald-400 text-sm font-semibold mb-3">Process Complete</div>
                    {canUndo && (
                      <button onClick={handleUndo} disabled={loading} className="w-full py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded transition-colors shadow-sm flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                        Undo Last Move
                      </button>
                    )}
                  </div>
                ) : progress ? (
                  <div className="w-full bg-[#1e293b] p-3 rounded-lg border border-slate-700 shadow-lg">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-300">Sorting...</span>
                      <span className="text-blue-400 font-bold">{Math.round((progress.totalMoved / (scanResult?.totalSortable || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 mb-3 shadow-inner">
                      <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${(progress.totalMoved / (scanResult?.totalSortable || 1)) * 100}%` }}></div>
                    </div>
                    <button onClick={handleCancelSort} className="w-full py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded transition-colors flex items-center justify-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> Cancel
                    </button>
                  </div>
                ) : null}

                {(!progress || progress.isDone) && (
                  <button onClick={handlePreSortCheck} disabled={loading || !scanResult || scanResult.totalSortable === 0} className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white text-sm font-bold rounded-lg transition-colors shadow-lg">
                    Start Sorting
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT MAIN CONTENT */}
            <div className="flex-1 bg-[#0f172a]/20 p-8 flex flex-col relative">
              {!scanResult ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <svg className="w-16 h-16 mb-4 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  <p className="text-sm font-medium tracking-wide">Select a folder to begin analysis.</p>
                </div>
              ) : scanResult.totalSortable === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-emerald-500">
                  <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-lg font-bold">Workspace is clean!</p>
                  <p className="text-sm text-slate-400 mt-2">No supported files found to organize.</p>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex w-full max-w-4xl h-[400px]">
                    <div className="flex-1 relative flex items-center justify-center">
                      <div className="w-[300px] h-[300px]">
                        <Doughnut data={chartData} options={chartOptions as any} />
                      </div>
                    </div>
                    <div className="w-64 flex flex-col justify-center pl-8">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-700 pb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        Detected File Types
                      </div>
                      <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                        {scanResult.stats.map((stat, i) => (
                          <div key={stat.ext} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: colors[i % colors.length] }}></div>
                              <span className="text-sm text-slate-300 font-medium">{stat.ext}</span>
                            </div>
                            <span className="text-sm font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">{stat.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CLEANER VIEW */}
        {activeTab === 'cleaner' && (
          <div className="flex flex-1 w-full h-full absolute inset-0 bg-[#0f172a]/20">
            <div className="w-80 bg-[#0b1120]/40 backdrop-blur-sm border-r border-slate-800/50 flex flex-col p-6">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Duplicate Cleaner
              </h2>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">Find and safely delete identical files using Byte-level Verification (SHA-256).</p>
              
              <button onClick={handleSelectCleanerFolder} disabled={loading} className="w-full flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-[#27354f] border border-slate-700 py-3 rounded-xl transition-colors mb-4 shadow-sm">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                <span className="text-sm font-medium">Choose Target Folder</span>
              </button>
              
              {cleanerFolder && (
                <div className="bg-[#0f172a] p-3 rounded-md text-xs font-mono text-slate-400 break-all border border-slate-800 mb-6 shadow-inner">
                  {cleanerFolder}
                </div>
              )}

              <div className="mt-auto">
                <button onClick={() => { setCleanerFolder(''); setDuplicates(null); }} className="w-full text-slate-500 hover:text-slate-300 text-sm mb-4 transition-colors">Clear Selection</button>
                <button onClick={handleScanDuplicates} disabled={!cleanerFolder || loading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 py-3 rounded-xl font-bold transition-colors shadow-lg">
                  Start Deep Scan
                </button>
              </div>
            </div>

            <div className="flex-1 p-8 flex flex-col overflow-hidden relative">
              {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
                  <svg className="w-10 h-10 text-emerald-500 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="3" stroke="currentColor" strokeDasharray="16 16" strokeLinecap="round"/></svg>
                  <p className="text-sm font-medium tracking-wide">Performing Byte-Level Verification...</p>
                </div>
              ) : !duplicates ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                  <svg className="w-16 h-16 mb-4 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  Select a folder and scan to find duplicates.
                </div>
              ) : duplicates.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-emerald-500">
                  <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-lg font-bold">Awesome! No duplicates found.</p>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-end mb-6 bg-[#1e293b] p-6 rounded-2xl border border-slate-700 shadow-md">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">Found {duplicates.length} duplicate groups</h3>
                      <p className="text-sm text-slate-400">Review the groups below and select the redundant files to safely delete.</p>
                    </div>
                    <button onClick={handleDeleteSelected} disabled={selectedForDeletion.size === 0} className="bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 px-6 py-2.5 rounded-lg font-semibold transition-colors shadow-lg flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete Selected ({selectedForDeletion.size})
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-6">
                    {duplicates.map((group, i) => (
                      <div key={i} className="bg-[#1e293b] border border-slate-700 rounded-xl p-4 shadow-sm">
                        <div className="text-xs text-slate-500 mb-3 font-mono flex items-center gap-2">
                          <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                          SHA-256 Hash: {group.hash.substring(0, 16)}... | Size: {group.files[0].size_mb.toFixed(2)} MB
                        </div>
                        <div className="space-y-2">
                          {group.files.map((file, j) => (
                            <DuplicateRow 
                               key={j} 
                               file={file} 
                               isChecked={selectedForDeletion.has(file.path)} 
                               onToggle={toggleDeleteSelection} 
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-1 flex-col w-full h-full absolute inset-0 bg-[#0f172a]/20 p-8 overflow-y-auto custom-scrollbar">
            <h2 className="text-2xl font-bold text-white mb-8 flex items-center gap-3">
              <svg className="w-7 h-7 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              Lifetime Analytics
            </h2>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="bg-[#1e293b] border border-slate-700 p-8 rounded-2xl flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <svg className="w-24 h-24 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                </div>
                <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2 relative z-10">Total Files Organized</div>
                <div className="text-6xl font-black text-blue-400 relative z-10 drop-shadow-md">{lifetimeStats?.total_files || 0}</div>
              </div>
              <div className="bg-[#1e293b] border border-slate-700 p-8 rounded-2xl flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <svg className="w-24 h-24 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                </div>
                <div className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-2 relative z-10">Space Managed (MB)</div>
                <div className="text-6xl font-black text-emerald-400 relative z-10 drop-shadow-md">{lifetimeStats?.total_mb?.toFixed(2) || 0}</div>
              </div>
            </div>

            <div className="bg-[#1e293b] border border-slate-700 p-6 rounded-2xl shadow-lg flex-1 min-h-[350px] flex flex-col">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                Activity Timeline (Last 14 Active Days)
              </h3>
              <div className="flex-1 w-full">
                {lifetimeStats && Object.keys(lifetimeStats.history).length > 0 ? (
                  <Line data={getLineData()} options={lineOptions as any} />
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500 italic">No sorting history available yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* SYSTEM WARNING MODAL (10-SEC COUNTDOWN) */}
      {sysWarning.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[70]">
          <div className="bg-[#0f172a] border-2 border-yellow-500/50 rounded-2xl shadow-[0_0_50px_rgba(234,179,8,0.2)] w-[500px] overflow-hidden transform transition-all">
            <div className="p-8 flex flex-col items-center text-center">
              <svg className="w-20 h-20 text-yellow-500 mb-6 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <h2 className="text-2xl font-black text-white mb-4">System Directory Detected!</h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-6">
                You are about to sort files inside a critical Windows system directory. This could make Windows unstable, crash applications, or prevent your PC from booting.
              </p>
              <div className="bg-yellow-500/10 text-yellow-300 text-xs font-mono px-4 py-2 rounded border border-yellow-500/20 mb-2">
                Only proceed if you know exactly what you are doing.
              </div>
            </div>
            
            <div className="bg-[#1e293b] flex flex-col">
              <div className="w-full h-1 bg-slate-800">
                <div className="h-full bg-yellow-500 transition-all ease-linear duration-1000" style={{ width: `${(sysWarning.countdown / 10) * 100}%` }}></div>
              </div>
              <div className="px-6 py-5 flex gap-4">
                <button onClick={() => setSysWarning({isOpen: false, countdown: 10})} className="flex-1 py-3 text-sm font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors border border-slate-700">
                  No, Cancel
                </button>
                <button onClick={executeSort} disabled={sysWarning.countdown > 0} className="flex-1 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg transition-colors shadow-lg">
                  {sysWarning.countdown > 0 ? `Wait ${sysWarning.countdown}s...` : "Yes, I Understand"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HELP DRAWER / MODAL */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-[60]" onClick={() => setIsHelpOpen(false)}>
          <div className="bg-[#0f172a] border-l border-slate-700 shadow-2xl w-[400px] h-full flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#1e293b]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Help & Guide
              </h2>
              <button onClick={() => setIsHelpOpen(false)} className="text-slate-400 hover:text-white p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 help-details custom-scrollbar text-sm text-slate-300">
              <details className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 cursor-pointer group" open>
                <summary className="font-bold text-white outline-none flex justify-between items-center">
                  How Sorter Works
                  <span className="text-blue-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 leading-relaxed">JazaSort automatically moves files from your messy folder into neat, organized folders based on Rules. You can review your Rules in the Settings menu (⚙️). If you make a mistake, simply click the <b>Undo Move</b> button to revert everything.</p>
              </details>
              
              <details className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 cursor-pointer group">
                <summary className="font-bold text-white outline-none flex justify-between items-center">
                  Using Macros (Smart Folders)
                  <span className="text-blue-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 leading-relaxed">In the Target Folder path, you can type special codes that auto-change based on the file:</p>
                <ul className="mt-2 space-y-1 text-xs font-mono text-slate-400">
                  <li>{`{YEAR}`} - File creation year (e.g. 2023)</li>
                  <li>{`{MONTH}`} - File month (e.g. 05)</li>
                  <li>{`{ARTIST}`} - MP3 Song Artist</li>
                  <li>{`{CAMERA}`} - Photo Camera Model</li>
                </ul>
                <p className="mt-2 leading-relaxed">Example: <code>C:\Music\{`{ARTIST}`}</code> will move songs into folders named after the singer!</p>
              </details>

              <details className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 cursor-pointer group">
                <summary className="font-bold text-white outline-none flex justify-between items-center">
                  Duplicate Cleaner
                  <span className="text-blue-400 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <p className="mt-3 leading-relaxed">The cleaner finds identical files by reading their <b>Byte-level (SHA-256) signature</b>. Even if a file is named differently, we will detect it. Simply scan, select the ones you don't want, and hit Delete.</p>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl shadow-2xl w-[900px] max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#1e293b]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Advanced Rule Editor
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-700 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-[#0b1120] custom-scrollbar">
              
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">Share & Backup</h3>
                  <p className="text-xs text-slate-400 mt-1">Export your rules to share with others, or import an existing preset.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleExport} className="px-5 py-2 border border-slate-600 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors shadow-sm">Export Config</button>
                  <button onClick={handleImport} className="px-5 py-2 border border-blue-600/50 bg-blue-900/20 text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-900/40 transition-colors shadow-sm">Import Config</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 flex flex-col justify-between shadow-sm">
                  <div className="mb-2">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      Deep Scan
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Scan inside subdirectories.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer mt-auto self-end">
                    <input type="checkbox" className="sr-only peer" checked={appConfig?.scan_subfolders || false} onChange={(e) => setAppConfig({...appConfig, scan_subfolders: e.target.checked} as any)} />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 shadow-inner"></div>
                  </label>
                </div>

                <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 flex flex-col justify-between shadow-sm">
                  <div className="mb-2">
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                      Hide Unsupported
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Prunes empty/cache files from RAM.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer mt-auto self-end">
                    <input type="checkbox" className="sr-only peer" checked={appConfig?.hide_unsupported || false} onChange={(e) => setAppConfig({...appConfig, hide_unsupported: e.target.checked} as any)} />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 shadow-inner"></div>
                  </label>
                </div>

                <div className="bg-[#1e293b] p-4 rounded-xl border border-slate-700 flex flex-col justify-between shadow-sm col-span-2">
                  <div className="mb-2 flex justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                        <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Enable Glass Backdrop (Mica)
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">Transparent UI effect. <span className="text-yellow-500">Requires App Restart.</span></p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer mt-auto">
                      <input type="checkbox" className="sr-only peer" checked={appConfig?.enable_mica || false} onChange={(e) => setAppConfig({...appConfig, enable_mica: e.target.checked} as any)} />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500 shadow-inner"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 pl-2">Current Active Rules</h3>
                <div className="space-y-4">
                  {appConfig?.rules.map((rule, idx) => (
                    <div key={idx} className="bg-[#1e293b] border border-slate-700 p-5 rounded-xl flex justify-between items-center shadow-sm hover:border-slate-600 transition-colors">
                      <div className="overflow-hidden">
                        <div className="font-bold text-blue-400 text-lg mb-1">{rule.category}</div>
                        <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                          <span><b>Ext:</b> <span className="text-slate-300">{rule.extensions?.join(', ') || 'Any'}</span></span>
                          {rule.keywords && rule.keywords.length > 0 && <span><b>Keywords:</b> <span className="text-slate-300">{rule.keywords.join(', ')}</span></span>}
                          {((rule.min_size_mb || 0) > 0 || (rule.max_size_mb || 0) > 0) && (
                            <span><b>Size Limit:</b> <span className="text-slate-300">{(rule.min_size_mb || 0) > 0 ? `> ${rule.min_size_mb}MB ` : ''} {(rule.max_size_mb || 0) > 0 ? `< ${rule.max_size_mb}MB` : ''}</span></span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-slate-500 mt-2 truncate bg-[#0f172a] px-2 py-1 rounded border border-slate-800" title={rule.target_folder}>Target: {rule.target_folder}</div>
                      </div>
                      <button onClick={() => deleteRule(idx)} className="ml-4 p-3 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors shadow-sm" title="Delete Rule">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                  {(!appConfig?.rules || appConfig.rules.length === 0) && (
                    <div className="text-slate-500 text-sm italic text-center py-6 bg-[#1e293b] rounded-xl border border-slate-700 border-dashed">No rules defined. Add one below.</div>
                  )}
                </div>
              </div>

              <div className="bg-[#1e293b] border border-slate-700 p-6 rounded-2xl shadow-lg">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-5">Create New Rule</h3>
                
                <div className="grid grid-cols-3 gap-5 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Category Name</label>
                    <input type="text" value={newCat} onChange={e => setNewCat(e.target.value)} className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="e.g. My Vault" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Extensions (optional)</label>
                    <input type="text" value={newExt} onChange={e => setNewExt(e.target.value)} className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="e.g. .pdf, .docx" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Keywords (optional)</label>
                    <input type="text" value={newKeywords} onChange={e => setNewKeywords(e.target.value)} className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all" placeholder="e.g. report, invoice" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Min Size (MB) (optional)</label>
                    <input type="number" min="0" value={minSize} onChange={e => setMinSize(e.target.value)} className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Size (MB) (optional)</label>
                    <input type="number" min="0" value={maxSize} onChange={e => setMaxSize(e.target.value)} className="w-full bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all" placeholder="0" />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Target Folder</label>
                  <div className="flex gap-3">
                    <input type="text" value={newTarget} onChange={e => setNewTarget(e.target.value)} className="flex-1 bg-[#0b1120] border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-all font-mono" placeholder="e.g. C:/Files/{YEAR}" />
                    <button onClick={handleSelectTarget} className="bg-slate-700 hover:bg-slate-600 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors text-white whitespace-nowrap shadow-sm">Browse UI...</button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-slate-500">Suggested Macros:</span>
                    <button onClick={() => insertMacro('{YEAR}')} className="macro-chip"><code>{`{YEAR}`}</code></button>
                    <button onClick={() => insertMacro('{MONTH}')} className="macro-chip"><code>{`{MONTH}`}</code></button>
                    <button onClick={() => insertMacro('{ARTIST}')} className="macro-chip"><code>{`{ARTIST}`}</code></button>
                    <button onClick={() => insertMacro('{ALBUM}')} className="macro-chip"><code>{`{ALBUM}`}</code></button>
                    <button onClick={() => insertMacro('{CAMERA}')} className="macro-chip"><code>{`{CAMERA}`}</code></button>
                  </div>
                </div>

                <button onClick={addRule} disabled={!newCat || !newTarget || (!newExt && !newKeywords)} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg">Add Rule</button>
              </div>
            </div>

            <div className="p-6 bg-[#1e293b] border-t border-slate-800 flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
              <button onClick={resetSettings} className="text-slate-400 hover:text-red-400 text-sm font-medium transition-colors px-4 py-2 hover:bg-red-400/10 rounded-lg">
                Reset to Factory Defaults
              </button>
              <button onClick={saveSettings} className="bg-blue-600 hover:bg-blue-500 px-8 py-3 rounded-xl text-white font-bold transition-colors shadow-lg">
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DIALOG MODAL */}
      {dialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80]">
          <div className="bg-[#1e293b] border border-slate-700 rounded-2xl shadow-2xl w-[450px] overflow-hidden transform transition-all">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                {dialog.type === 'confirm' ? <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> : null}
                {dialog.title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">{dialog.message}</p>
            </div>
            <div className="bg-[#0f172a] px-6 py-4 flex justify-end gap-3 border-t border-slate-800">
              {dialog.type === 'confirm' && (
                <button onClick={closeDialog} className="px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors">
                  {dialog.cancelText || 'Cancel'}
                </button>
              )}
              <button onClick={() => { if(dialog.onConfirm) dialog.onConfirm(); else closeDialog(); }} 
                className={`px-6 py-2.5 text-sm font-bold text-white rounded-lg transition-colors shadow-lg ${dialog.type === 'confirm' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                {dialog.type === 'confirm' ? dialog.confirmText : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
