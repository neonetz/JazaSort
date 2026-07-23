import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';

// Mock Tauri API bridge
vi.mock('../api', () => ({
  SelectFolder: vi.fn(),
  ScanFolder: vi.fn(),
  SortFolder: vi.fn(),
  GetConfig: vi.fn(),
  SaveConfig: vi.fn(),
  SelectTargetFolder: vi.fn(),
  ResetConfig: vi.fn(),
  UndoLastSort: vi.fn(),
  HasUndoHistory: vi.fn(),
  GetLifetimeStats: vi.fn(),
  ExportConfig: vi.fn(),
  ImportConfig: vi.fn(),
  ScanDuplicates: vi.fn(),
  DeleteFiles: vi.fn(),
  IsSystemPath: vi.fn(),
  CancelSort: vi.fn(),
  EventsOn: vi.fn(),
}));

// Suppress console.error in tests unless needed
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (args[0]?.includes?.('Warning: ReactDOM.render is no longer supported')) {
      return;
    }
    originalError.call(console, ...args);
  };
});
afterAll(() => {
  console.error = originalError;
});