import { vi, describe, it, beforeEach, expect, beforeAll} from 'vitest'
import gas from 'gas-local'
import { mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUi, mockUrlFetchApp } from './mocks'

const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger,
    PropertiesService: mockPropertiesService
}
const gLib = gas.require('./dist', mocks)

describe('Miscellaneous', () => {
  const mockToken = 'mockToken'
  const mockBaseUrl = 'https://mock.com'
  const mockRow1 = {
    Name: 'mock1',
    UM: 'LF',
    Notes: 'mockNote1',
    UnitCost: 10
  }
  const mockRow2 = {
    Name: 'mock2',
    UM: 'EACH',
    Notes: 'mockNote2',
    UnitCost: 100
  }
  const mockRow3 = {
    Name: 'mock3',
    UM: 'UNIT'
  }
  describe('_createMiscellaneous')

})
