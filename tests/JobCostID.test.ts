import gas from 'gas-local';
import path from 'path'
import { vi, beforeEach, test,expect } from 'vitest'
const SpreadsheetApp = {
  getUi: vi.fn(() => SpreadsheetApp),
  alert: vi.fn(),
  getActiveSpreadsheet: vi.fn(() => SpreadsheetApp),
  getActiveSheet: vi.fn(),
  getRange: vi.fn(() => SpreadsheetApp),
  getLastColumn: vi.fn(),
  getBackgroundColor: vi.fn(),
  getSheetByName: vi.fn(() => SpreadsheetApp),
  getValue: vi.fn(),
}
const UrlFetchApp = {
  fetch: vi.fn()
}
const authenticate = vi.fn()
const mocks = {
  SpreadsheetApp,
  UrlFetchApp,
  authenticate,
  __proto__: gas.globalMockDefaults
}
const filterfunc = (f: any) => {
  const ext = path.extname(f)
  return ext == '.ts'
}
const glib = gas.require('./src', mocks, {filter: filterfunc})
console.log(glib)
beforeEach(() => {
  vi.resetAllMocks()
})

test('CreateJCIDS exits early if getSpreadsheetData returns with no data', () => {
  glib.CreateJCIDS()
  expect(glib.mocks.authenticate).toHaveBeenCalledOnce()
  expect(glib.mocks.Logger.log).toHaveBeenCalledExactlyOnceWith("No data to send!")
  expect(glib.SpreadsheetApp.alert).toHaveBeenCalledExactlyOnceWith("No data to send!")
})
