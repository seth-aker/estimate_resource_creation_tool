import { vi, describe, it, beforeEach, expect, beforeAll} from 'vitest'
import { gasRequire } from 'tgas-local'
import { mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUi, mockUrlFetchApp } from './mocks'

const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger,
    PropertiesService: mockPropertiesService
}
const gLib = gasRequire('./src', mocks)

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
  const mockSpreadsheetData = [mockRow1, mockRow2, mockRow3]
  const miscDTO1 = {
    Name: 'mock1',
    Notes: 'mockNote1',
    UnitCost: 10,
    ImperialUnitOfMeasure: 'LF',
    MetricUnitOfMeasure: 'm',
    UnitCostSystemOfMeasure: 'Imperial'
  }
  const miscDTO2 = {
    Name: 'mock2',
    Notes: 'mockNote2',
    UnitCost: 100,
    ImperialUnitOfMeasure: 'EACH',
    MetricUnitOfMeasure: 'EACH',
    UnitCostSystemOfMeasure: 'Imperial'
  }
  const miscDTO3 = {
    Name: 'mock3',
    ImperialUnitOfMeasure: 'UNIT',
    MetricUnitOfMeasure: 'UNIT',
    UnitCostSystemOfMeasure: 'Imperial'
  }
  beforeEach(() => {
    vi.resetAllMocks()
  })
  describe('createMiscDTOFromRow', () => {
    it('successfully creates when row has imp_to_metric conversion', () => {
      const result = gLib.createMiscDTOFromRow(mockRow1, "Imperial")
      expect(result).toEqual(miscDTO1)
    })
    it('successfully creates when there is no conversion', () => {
      const result = gLib.createMiscDTOFromRow(mockRow2, "Imperial")
      expect(result).toEqual(miscDTO2)
    })
    it('successfully creates when there is no unit cost or notes', () => {
      const result = gLib.createMiscDTOFromRow(mockRow3, "Imperial")
      expect(result).toEqual(miscDTO3)
    })

  })
  describe('_createMiscellaneous', () => {
    it('returns failed row numbers when rows return with failure codes', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 400, getContentText: () => "Error" },
        { getResponseCode: () => 500, getContentText: () => "Error" },
        { getResponseCode: () => 201 }
      ])
      const dtos= [
        {rowData: 'data'},
        {rowData: 'data'},
        {rowData: 'data'},
      ]
      //@ts-ignore
      const failedRows = gLib._createMiscellaneous(dtos, mockToken, mockBaseUrl)
      expect(failedRows).toEqual([2,3])
      expect(mockLogger.log).toHaveBeenCalledTimes(3)
    })
    it('returns no failed rows when rows already exist or are created', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 409 },
        { getResponseCode: () => 200 },
        { getResponseCode: () => 201 }
      ])
      const dtos = [
        {rowData: 'data'},
        {rowData: 'data'},
        {rowData: 'data'},
      ]
      //@ts-ignore
      const failedRows = gLib._createMiscellaneous(dtos, mockToken, mockBaseUrl)
      expect(failedRows).toEqual([])
      expect(mockLogger.log).toHaveBeenCalledTimes(3)
    })
  })
  describe("CreateMiscellaneous", () => {
    beforeAll(() => {
      gLib.getSpreadSheetData = vi.fn(() => [])
      gLib.authenticate = vi.fn(() => ({token: mockToken, baseUrl: mockBaseUrl}))
      gLib.createMiscDTOFromRow = vi.fn()
      gLib._createMiscellaneous = vi.fn()
      gLib.highlightRows = vi.fn()
    })
    it('returns early when there is no data to send', () => {
      gLib.CreateMiscellaneous("Imperial")
      expect(mockLogger.log).toHaveBeenCalledWith("CreateMiscellaneous() failed to run because there was no data to send.")
      expect(mockUi.alert).toHaveBeenCalledWith('No data to send!')
    })
    it('highlights failed rows and alerts user when _createMiscellaneous returns with failed rows', () => {
      //@ts-ignore
      gLib._createMiscellaneous.mockReturnValue([2,3])
      //@ts-ignore
      gLib.getSpreadSheetData.mockReturnValue(mockSpreadsheetData)
      //@ts-ignore
      gLib.createMiscDTOFromRow.mockReturnValue([miscDTO1, miscDTO2, miscDTO3])
      //@ts-ignore
      gLib.CreateMiscellaneous()

      expect(gLib.highlightRows).toHaveBeenCalledWith([2,3], 'red')
      expect(mockUi.alert).toHaveBeenCalledWith('Some rows failed to be created: 2, 3')
    })
    it('successfully alerts user when all rows are correctly created', () => {
      //@ts-ignore
      gLib._createMiscellaneous.mockReturnValue([])
      //@ts-ignore
      gLib.getSpreadSheetData.mockReturnValue(mockSpreadsheetData)
      //@ts-ignore
      gLib.createMiscDTOFromRow.mockReturnValue([miscDTO1, miscDTO2, miscDTO3])
      //@ts-ignore
      gLib.CreateMiscellaneous()

      expect(mockUi.alert).toHaveBeenCalledWith('All rows successfully created!')
    })
  })

})
