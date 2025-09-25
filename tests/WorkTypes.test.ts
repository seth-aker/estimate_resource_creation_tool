import gas from 'gas-local';
import { vi, beforeEach, expect, describe, it } from 'vitest'
import { mockSpreadsheetApp, mockUrlFetchApp, mockLogger } from './mocks';

const mocks = {
  SpreadsheetApp: mockSpreadsheetApp,
  UrlFetchApp: mockUrlFetchApp,
  Logger: mockLogger,
  // __proto__: gas.globalMockDefaults
}

const glib = gas.require('./dist', mocks)

describe('WorkTypes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  describe('_createWorkSubtypes', () => {
    it('returns empty array when workTypesData is empty', () => {
      const response = glib._createWorkSubtypes([], undefined, 'token', 'baseUrl')
      expect(response).toEqual([])
    })
  })
})
