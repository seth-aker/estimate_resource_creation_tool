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
export const mockSpreadsheet = {
  getActiveSheet: vi.fn(() => mockSheet),
  getSheetByName: vi.fn(() => mockSheet as typeof mockSheet | null)
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
export const mockUserProperties = {
  baseUrl: 'https://mock.com',
  clientID: 'mockClientID',
  clientSecret: 'mockClientSecret',
  userName: 'mockUserName',
  password: 'mockPassword',
  serverName: 'mockServerName',
  dbName: 'mockDbName'
}
export const mockPropertiesObject = {
  getProperties: vi.fn(() => mockUserProperties),
  getProperty: vi.fn((prop: string) => {    
    if(Object.hasOwn(mockUserProperties, prop)) {
      return mockUserProperties[prop as keyof typeof mockUserProperties]
    } else {
      return null
    }
  }),
  setProperties: vi.fn()
}
export const mockPropertiesService = {
  getUserProperties: vi.fn(() => mockPropertiesObject),
  getScriptProperties: vi.fn(() => mockPropertiesObject)
}
export const mockAuthenticate = vi.fn(() => ({token: 'mockToken', baseUrl: 'mockBaseUrl.com'}))

// mockSpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSpreadsheetApp);
// mockSpreadsheetApp.getActiveSheet.mockReturnValue(mockSpreadsheetApp);
// mockSpreadsheetApp.getRange.mockReturnValue(mockSpreadsheetApp);
// mockSpreadsheetApp.getSheetByName.mockReturnValue(mockSpreadsheetApp);
