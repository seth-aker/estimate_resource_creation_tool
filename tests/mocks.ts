import { vi } from 'vitest'
export const mockUi = {
    alert: vi.fn()
}
export const mockRange = {
  setBackground: vi.fn(),
  getValue: vi.fn(),
  getValues: vi.fn()
}
export const mockSheet = {
  getRange: vi.fn(() => mockRange),
  getLastColumn: vi.fn(),
  getDataRange: vi.fn(() => mockRange)
}
const mockSpreadsheet = {
  getActiveSheet: vi.fn(() => mockSheet),
  getSheetByName: vi.fn(() => mockSheet)
}
export const mockSpreadsheetApp = {
    getUi: vi.fn(() => mockUi),
    getActiveSpreadsheet: vi.fn(() => mockSpreadsheet),
}

export const mockUrlFetchApp = {
  fetch: vi.fn(),
  fetchAll: vi.fn()
}
export const mockLogger = {
  log: vi.fn()
}

export const mockAuthenticate = vi.fn(() => ({token: 'mockToken', baseUrl: 'mockBaseUrl.com'}))

// mockSpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheetApp);
// mockSpreadsheetApp.getActiveSheet.mockReturnValue(mockSpreadsheetApp);
// mockSpreadsheetApp.getRange.mockReturnValue(mockSpreadsheetApp);
// mockSpreadsheetApp.getSheetByName.mockReturnValue(mockSpreadsheetApp);