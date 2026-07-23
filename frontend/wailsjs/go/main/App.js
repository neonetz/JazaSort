// @ts-check

async function invokeTauri(cmd, args = {}) {
  if (window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke) {
    return window.__TAURI_INTERNALS__.invoke(cmd, args);
  }
  return null;
}

export function CancelSort() {
  if (window['go']?.['main']?.['App']?.['CancelSort']) {
    return window['go']['main']['App']['CancelSort']();
  }
  return invokeTauri('cancel_sort');
}

export function DeleteFiles(arg1) {
  if (window['go']?.['main']?.['App']?.['DeleteFiles']) {
    return window['go']['main']['App']['DeleteFiles'](arg1);
  }
  return invokeTauri('delete_files', { paths: arg1 });
}

export function ExportConfig() {
  if (window['go']?.['main']?.['App']?.['ExportConfig']) {
    return window['go']['main']['App']['ExportConfig']();
  }
  return invokeTauri('export_config');
}

export function GetConfig() {
  if (window['go']?.['main']?.['App']?.['GetConfig']) {
    return window['go']['main']['App']['GetConfig']();
  }
  return invokeTauri('get_config');
}

export function GetLifetimeStats() {
  if (window['go']?.['main']?.['App']?.['GetLifetimeStats']) {
    return window['go']['main']['App']['GetLifetimeStats']();
  }
  return invokeTauri('get_lifetime_stats');
}

export function HasUndoHistory() {
  if (window['go']?.['main']?.['App']?.['HasUndoHistory']) {
    return window['go']['main']['App']['HasUndoHistory']();
  }
  return invokeTauri('has_undo_history');
}

export function ImportConfig() {
  if (window['go']?.['main']?.['App']?.['ImportConfig']) {
    return window['go']['main']['App']['ImportConfig']();
  }
  return invokeTauri('import_config');
}

export function IsSystemPath(arg1) {
  if (window['go']?.['main']?.['App']?.['IsSystemPath']) {
    return window['go']['main']['App']['IsSystemPath'](arg1);
  }
  return invokeTauri('is_system_path', { path: arg1 });
}

export function ResetConfig() {
  if (window['go']?.['main']?.['App']?.['ResetConfig']) {
    return window['go']['main']['App']['ResetConfig']();
  }
  return invokeTauri('reset_config');
}

export function SaveConfig(arg1) {
  if (window['go']?.['main']?.['App']?.['SaveConfig']) {
    return window['go']['main']['App']['SaveConfig'](arg1);
  }
  return invokeTauri('save_config', { cfg: arg1 });
}

export function ScanDuplicates(arg1) {
  if (window['go']?.['main']?.['App']?.['ScanDuplicates']) {
    return window['go']['main']['App']['ScanDuplicates'](arg1);
  }
  return invokeTauri('scan_duplicates', { path: arg1 });
}

export function ScanFolder(arg1) {
  if (window['go']?.['main']?.['App']?.['ScanFolder']) {
    return window['go']['main']['App']['ScanFolder'](arg1);
  }
  return invokeTauri('scan_folder', { path: arg1 });
}

export function SelectFolder() {
  if (window['go']?.['main']?.['App']?.['SelectFolder']) {
    return window['go']['main']['App']['SelectFolder']();
  }
  return invokeTauri('select_folder');
}

export function SelectTargetFolder() {
  if (window['go']?.['main']?.['App']?.['SelectTargetFolder']) {
    return window['go']['main']['App']['SelectTargetFolder']();
  }
  return invokeTauri('select_target_folder');
}

export function SortFolder(arg1) {
  if (window['go']?.['main']?.['App']?.['SortFolder']) {
    return window['go']['main']['App']['SortFolder'](arg1);
  }
  return invokeTauri('sort_folder', { path: arg1 });
}

export function UndoLastSort() {
  if (window['go']?.['main']?.['App']?.['UndoLastSort']) {
    return window['go']['main']['App']['UndoLastSort']();
  }
  return invokeTauri('undo_last_sort');
}
