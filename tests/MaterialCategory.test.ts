import { vi, describe, it, beforeEach, expect} from 'vitest'
import gas from 'gas-local'
import { mockLogger, mockRange, mockSpreadsheetApp, mockUi, mockUrlFetchApp } from './mocks'

const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger
}
const gLib = gas.require('./dist', mocks)

describe("MaterialCategory", () => {
    const ESTIMATE_REF = "00000000-0000-0000-0000-000000000000";
    const mockBaseUrl = 'https://mock.com'
    const mockToken = 'mock-token'
    const expectedHeader = {
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json'
    }
    beforeEach(() => {
        vi.resetAllMocks()
    })
    describe("_createMaterialSubcategories", () => {
        
    })
})