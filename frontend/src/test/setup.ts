import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Wails runtime
vi.mock('../wailsjs/runtime/runtime', () => ({
  EventsOn: vi.fn(),
  EventsOff: vi.fn(),
  EventsEmit: vi.fn(),
}));

// Mock Wails bindings
vi.mock('../wailsjs/go/main/App', () => ({
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
}));

// Mock Wails models
vi.mock('../wailsjs/go/models', () => ({
  main: {},
  config: {},
  stats: {},
  cleaner: {},
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