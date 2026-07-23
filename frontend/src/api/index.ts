// Clean Tauri v2 API Bridge

async function invokeTauri<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__?.invoke) {
    return await (window as any).__TAURI_INTERNALS__.invoke(cmd, args);
  }
  return null as unknown as T;
}

export async function SelectFolder(): Promise<string> {
  return (await invokeTauri<string>('select_folder')) || '';
}

export async function SelectTargetFolder(): Promise<string> {
  return (await invokeTauri<string>('select_target_folder')) || '';
}

export async function GetConfig(): Promise<any> {
  return await invokeTauri('get_config');
}

export async function SaveConfig(cfg: any): Promise<void> {
  return await invokeTauri('save_config', { cfg });
}

export async function ResetConfig(): Promise<any> {
  return await invokeTauri('reset_config');
}

export async function ExportConfig(): Promise<void> {
  return await invokeTauri('export_config');
}

export async function ImportConfig(): Promise<any> {
  return await invokeTauri('import_config');
}

export async function ScanFolder(path: string): Promise<any> {
  return await invokeTauri('scan_folder', { path });
}

export async function SortFolder(path: string): Promise<void> {
  return await invokeTauri('sort_folder', { path });
}

export async function CancelSort(): Promise<void> {
  return await invokeTauri('cancel_sort');
}

export async function UndoLastSort(): Promise<number> {
  return (await invokeTauri<number>('undo_last_sort')) || 0;
}

export async function HasUndoHistory(): Promise<boolean> {
  return (await invokeTauri<boolean>('has_undo_history')) || false;
}

export async function GetLifetimeStats(): Promise<any> {
  return await invokeTauri('get_lifetime_stats');
}

export async function ScanDuplicates(path: string): Promise<any> {
  return await invokeTauri('scan_duplicates', { path });
}

export async function DeleteFiles(paths: string[]): Promise<[number, any]> {
  return (await invokeTauri<[number, any]>('delete_files', { paths })) || [0, null];
}

export async function IsSystemPath(path: string): Promise<boolean> {
  return (await invokeTauri<boolean>('is_system_path', { path })) || false;
}

export function EventsOn(eventName: string, callback: (data: any) => void): () => void {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__?.listen) {
    const unlisten = (window as any).__TAURI_INTERNALS__.listen(eventName, (event: any) => {
      callback(event.payload);
    });
    return () => {
      if (typeof unlisten === 'function') unlisten();
    };
  }
  return () => {};
}
