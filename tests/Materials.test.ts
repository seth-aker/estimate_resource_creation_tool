import { vi, describe, it, beforeEach, expect} from 'vitest'
import gas from 'gas-local'
import { mockLogger, mockRange, mockSpreadsheetApp, mockUi, mockUrlFetchApp } from './mocks'

const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger
}
const gLib = gas.require('./dist', mocks)

describe('Materials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
})
