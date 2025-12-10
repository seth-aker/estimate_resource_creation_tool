import { vi, describe, it, beforeEach, expect, beforeAll} from 'vitest'
import { gasRequire } from 'tgas-local'
import { mockCacheService, mockHtmlService, mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUi, mockUrlFetchApp, mockUserProperties, mockUtilities } from './mocks'

const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger,
    PropertiesService: mockPropertiesService,
    Utilities: mockUtilities,
    HtmlService: mockHtmlService,
    CacheService: mockCacheService
}
const gLib = gasRequire('./src', mocks)
const ESTIMATE_REF = "00000000-0000-0000-0000-000000000000"
const mockBaseUrl = 'https://mock.com'
const mockToken = 'mockToken'
const mockHeader = {
  'Authorization': `Bearer ${mockToken}`,
  'Content-Type': 'application/json',
  'ClientID': mockUserProperties.clientID,
  'ClientSecret': mockUserProperties.clientSecret,
  "ConnectionString": `Server=${mockUserProperties.serverName};Database=${mockUserProperties.dbName};MultipleActiveResultSets=true;Integrated Security=SSPI;`
}
describe('Materials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  describe('createMaterialDTO', () => {
    it('creates a material dto object for imperial system of measure', () => {
      const mockMaterialRow: IMaterialRow = {
        Name: 'material',
        Category: 'category',
        Subcategory: 'subcategory',
        "Unit of Measure": "TON",
        BaseCost: 10,
        IsTemporaryMaterial: false,
        TaxPercent: 0.1,
        WastePercent: 0.1,
        JobCostIDCode: "JCID",
        Notes: "mock note",
        ShouldRoundQuantity: true,
        QuantityRoundingIncrement: 1,
        TruckingCost: 10
      }
      const expectedDTO: IMaterialDTO = {
        EstimateREF: ESTIMATE_REF,
        Name: mockMaterialRow.Name,
        Category: mockMaterialRow.Category,
        Subcategory: mockMaterialRow.Subcategory,
        ImperialUnitOfMeasure: "TON",
        MetricUnitOfMeasure: "MT",
        BaseCost: mockMaterialRow.BaseCost,
        BaseCostSystemOfMeasure: 'Imperial',
        IsTemporaryMaterial: mockMaterialRow.IsTemporaryMaterial,
        TaxPercent: mockMaterialRow.TaxPercent,
        WastePercent: mockMaterialRow.WastePercent,
        TruckingCost: mockMaterialRow.TruckingCost,
        TruckingCostSystemOfMeasure: 'Imperial',
        JobCostIDCode: mockMaterialRow.JobCostIDCode,
        Notes: mockMaterialRow.Notes,
        ShouldRoundQuantity: mockMaterialRow.ShouldRoundQuantity,
        QuantityRoundingIncrement: mockMaterialRow.QuantityRoundingIncrement,
        QuantityRoundingIncrementSystemOfMeasure: 'Imperial'
      }
      const createdDTO = gLib.createMaterialDTO(mockMaterialRow, 'Imperial')

      expect(createdDTO).toEqual(expectedDTO)
    })
    it('returns correct um when the unit of measure does not exist in the conversion object', () => {
      const mockMaterialRow: IMaterialRow = {
        Name: 'material',
        Category: 'category',
        Subcategory: 'subcategory',
        "Unit of Measure": "EACH",
        BaseCost: 10,
        IsTemporaryMaterial: false,
        TaxPercent: 0.1,
        WastePercent: 0.1,
        JobCostIDCode: "JCID",
        Notes: "mock note",
        ShouldRoundQuantity: true,
        QuantityRoundingIncrement: 1,
        TruckingCost: 10
      }
      const expectedDTO: IMaterialDTO = {
        EstimateREF: ESTIMATE_REF,
        Name: mockMaterialRow.Name,
        Category: mockMaterialRow.Category,
        Subcategory: mockMaterialRow.Subcategory,
        ImperialUnitOfMeasure: "EACH",
        MetricUnitOfMeasure: "EACH",
        BaseCost: mockMaterialRow.BaseCost,
        BaseCostSystemOfMeasure: 'Imperial',
        IsTemporaryMaterial: mockMaterialRow.IsTemporaryMaterial,
        TaxPercent: mockMaterialRow.TaxPercent,
        WastePercent: mockMaterialRow.WastePercent,
        TruckingCost: mockMaterialRow.TruckingCost,
        TruckingCostSystemOfMeasure: 'Imperial',
        JobCostIDCode: mockMaterialRow.JobCostIDCode,
        Notes: mockMaterialRow.Notes,
        ShouldRoundQuantity: mockMaterialRow.ShouldRoundQuantity,
        QuantityRoundingIncrement: mockMaterialRow.QuantityRoundingIncrement,
        QuantityRoundingIncrementSystemOfMeasure: 'Imperial'
      }
      const createdDTO = gLib.createMaterialDTO(mockMaterialRow, 'Imperial')

      expect(createdDTO).toEqual(expectedDTO)
    })
    it('returns the correct ums when converting from metric to imperial', () => {
      const mockMaterialRow: IMaterialRow = {
        Name: 'material',
        Category: 'category',
        Subcategory: 'subcategory',
        "Unit of Measure": "m",
        BaseCost: 10,
        IsTemporaryMaterial: false,
        TaxPercent: 0.1,
        WastePercent: 0.1,
        JobCostIDCode: "JCID",
        Notes: "mock note",
        ShouldRoundQuantity: true,
        QuantityRoundingIncrement: 1,
        TruckingCost: 10
      }
      const expectedDTO: IMaterialDTO = {
        EstimateREF: ESTIMATE_REF,
        Name: mockMaterialRow.Name,
        Category: mockMaterialRow.Category,
        Subcategory: mockMaterialRow.Subcategory,
        ImperialUnitOfMeasure: "LF",
        MetricUnitOfMeasure: "m",
        BaseCost: mockMaterialRow.BaseCost,
        BaseCostSystemOfMeasure: 'Metric',
        IsTemporaryMaterial: mockMaterialRow.IsTemporaryMaterial,
        TaxPercent: mockMaterialRow.TaxPercent,
        WastePercent: mockMaterialRow.WastePercent,
        TruckingCost: mockMaterialRow.TruckingCost,
        TruckingCostSystemOfMeasure: 'Metric',
        JobCostIDCode: mockMaterialRow.JobCostIDCode,
        Notes: mockMaterialRow.Notes,
        ShouldRoundQuantity: mockMaterialRow.ShouldRoundQuantity,
        QuantityRoundingIncrement: mockMaterialRow.QuantityRoundingIncrement,
        QuantityRoundingIncrementSystemOfMeasure: 'Metric'
      }
      const createdDTO = gLib.createMaterialDTO(mockMaterialRow, 'Metric')
      expect(createdDTO).toEqual(expectedDTO)
    })
  })
  describe('_createMaterials', () => {
    const mockMaterialDTO: IMaterialDTO = {
      EstimateREF: ESTIMATE_REF,
      Name: 'mockName',
      Category: 'category',
      Subcategory: 'subcategory',
      ImperialUnitOfMeasure: 'EACH',
      MetricUnitOfMeasure: 'EACH',
      BaseCost: 10,
      BaseCostSystemOfMeasure: 'Imperial',
      IsTemporaryMaterial: false,
      TaxPercent: 0.05,
      WastePercent: 0.1,
      TruckingCost: 0,
      TruckingCostSystemOfMeasure: 'Imperial',
      JobCostIDCode: 'JCID',
      Notes: 'Note',
      ShouldRoundQuantity: false,
      QuantityRoundingIncrement: undefined,
      QuantityRoundingIncrementSystemOfMeasure: 'Imperial'
    }
    const mockMaterialDTO2: IMaterialDTO = {
      EstimateREF: ESTIMATE_REF,
      Name: 'mockName2',
      Category: 'category2',
      Subcategory: 'subcategory2',
      ImperialUnitOfMeasure: 'LF',
      MetricUnitOfMeasure: 'm',
      BaseCost: 10,
      BaseCostSystemOfMeasure: 'Imperial',
      IsTemporaryMaterial: false,
      TaxPercent: 0.05,
      WastePercent: 0.1,
      TruckingCost: 0,
      TruckingCostSystemOfMeasure: 'Imperial',
      JobCostIDCode: 'JCID',
      Notes: 'Note',
      ShouldRoundQuantity: true,
      QuantityRoundingIncrement: 1,
      QuantityRoundingIncrementSystemOfMeasure: 'Imperial'
    }
    it('correctly returns failed materials when the response codes are error codes', () => {
      const expectedBatchOptions = [mockMaterialDTO, mockMaterialDTO2].map((each) => ({
        url: `${mockBaseUrl}/Resource/Material`,
        headers: mockHeader,
        method: 'post' as const,
        payload: JSON.stringify(each),
        muteHttpExceptions: true
      }))
      mockUrlFetchApp.fetchAll.mockReturnValue([
        {
          getResponseCode: () => 400,
          getContentText: () => "Mock Error Message"
        },
        {
          getResponseCode: () => 500,
          getContentText: () => 'Mock Error Message'
        }
      ])
      const {failedMaterials, createdMaterials} = gLib._createMaterials([mockMaterialDTO, mockMaterialDTO2], mockToken, mockBaseUrl)
      expect(failedMaterials).toEqual([2,3])
      expect(createdMaterials).toHaveLength(0)
      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1,'Material "mockName" failed with status code: 400. Error Message: Mock Error Message')
      expect(mockLogger.log).nthCalledWith(2,'Material "mockName2" failed with status code: 500. Error Message: Mock Error Message')
    })
    it('correctly logs materials that already existed in the database', () => {
      const expectedBatchOptions = [mockMaterialDTO, mockMaterialDTO2].map((each) => ({
        url: `${mockBaseUrl}/Resource/Material`,
        headers: mockHeader,
        method: 'post' as const,
        payload: JSON.stringify(each),
        muteHttpExceptions: true
      }))
      mockUrlFetchApp.fetchAll.mockReturnValue([
        {
          getResponseCode: () => 200, getContentText: () => ''
        },
        {
          getResponseCode: () => 409, getContentText: () => ''
        }
      ])
      const {failedMaterials, createdMaterials} = gLib._createMaterials([mockMaterialDTO, mockMaterialDTO2], mockToken, mockBaseUrl)
      expect(failedMaterials).toEqual([2,3])
      expect(createdMaterials).toHaveLength(0)
      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1,'Material "mockName" already existed in the database.')
      expect(mockLogger.log).nthCalledWith(2,'Material "mockName2" already existed in the database.')
    })
    it('correctly logs created materials and returns them with response codes of 201', () => {
      const expectedBatchOptions = [mockMaterialDTO, mockMaterialDTO2].map((each) => ({
        url: `${mockBaseUrl}/Resource/Material`,
        headers: mockHeader,
        method: 'post' as const,
        payload: JSON.stringify(each),
        muteHttpExceptions: true
      }))
      const mockReturnValue = {...mockMaterialDTO, ObjectID: 'mockObjectID'}
      const mockReturnValue2 = {...mockMaterialDTO2, ObjectID: 'mockObjectID2'}
      mockUrlFetchApp.fetchAll.mockReturnValue([
        {
          getResponseCode: () => 201,
          getContentText: () => JSON.stringify(mockReturnValue)
        },
        {
          getResponseCode: () => 201,
          getContentText: () => JSON.stringify(mockReturnValue2)
        }
      ])
      const {failedMaterials, createdMaterials} = gLib._createMaterials([mockMaterialDTO, mockMaterialDTO2], mockToken, mockBaseUrl)
      expect(failedMaterials).toHaveLength(0)
      expect(createdMaterials).toEqual([mockReturnValue, mockReturnValue2])
      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Material "mockName" successfully created.')
      expect(mockLogger.log).nthCalledWith(2, 'Material "mockName2" successfully created.')
    })
  })
  describe('CreateMaterials', () => {
    const mockGetSpreadSheetData = vi.fn()
    const mockCreateMaterialDTO = vi.fn()
    const mockCreateMaterials = vi.fn()
    const mockHighlightRows = vi.fn()
    beforeAll(() => {
      gLib.authenticate = vi.fn(() => ({token: mockToken, baseUrl: mockBaseUrl}))
      gLib.getSpreadSheetData = mockGetSpreadSheetData
      gLib.createMaterialDTO = mockCreateMaterialDTO
      gLib._createMaterials = mockCreateMaterials
      gLib.highlightRows = mockHighlightRows
    })
    it('exits early when there is no material data', () => {
      mockGetSpreadSheetData.mockReturnValue([])
      gLib.CreateMaterials('Imperial')
      expect(mockLogger.log).toHaveBeenCalledWith('CreateMaterials() failed to run because there was no valid data to send.')
      expect(mockUi.alert).toHaveBeenCalledWith('No data to send!')
      expect(mockCreateMaterialDTO).not.toHaveBeenCalled()
      expect(mockCreateMaterials).not.toHaveBeenCalled()
      expect(mockHighlightRows).not.toHaveBeenCalled()
    })
    it('correctly alerts the user of failed materials and highlights correct rows', () => {
      const mockMaterialRow: IMaterialRow = {
        Name: 'material',
        Category: 'category',
        Subcategory: 'subcategory',
        "Unit of Measure": "TON",
        BaseCost: 10,
        IsTemporaryMaterial: false,
        TaxPercent: 0.1,
        WastePercent: 0.1,
        JobCostIDCode: "JCID",
        Notes: "mock note",
        ShouldRoundQuantity: true,
        QuantityRoundingIncrement: 1,
        TruckingCost: 10
      }
      const mockMaterialDTO: IMaterialDTO = {
        EstimateREF: ESTIMATE_REF,
        Name: mockMaterialRow.Name,
        Category: mockMaterialRow.Category,
        Subcategory: mockMaterialRow.Subcategory,
        ImperialUnitOfMeasure: "TON",
        MetricUnitOfMeasure: "MT",
        BaseCost: mockMaterialRow.BaseCost,
        BaseCostSystemOfMeasure: 'Imperial',
        IsTemporaryMaterial: mockMaterialRow.IsTemporaryMaterial,
        TaxPercent: mockMaterialRow.TaxPercent,
        WastePercent: mockMaterialRow.WastePercent,
        TruckingCost: mockMaterialRow.TruckingCost,
        TruckingCostSystemOfMeasure: 'Imperial',
        JobCostIDCode: mockMaterialRow.JobCostIDCode,
        Notes: mockMaterialRow.Notes,
        ShouldRoundQuantity: mockMaterialRow.ShouldRoundQuantity,
        QuantityRoundingIncrement: mockMaterialRow.QuantityRoundingIncrement,
        QuantityRoundingIncrementSystemOfMeasure: 'Imperial'
      }
      mockGetSpreadSheetData.mockReturnValue([mockMaterialRow])
      mockCreateMaterialDTO.mockReturnValue(mockMaterialDTO)
      mockCreateMaterials.mockReturnValue({failedMaterials: [2], createdMaterials: []})
      gLib.CreateMaterials('Imperial')
      expect(mockCreateMaterialDTO).toHaveBeenCalledExactlyOnceWith(mockMaterialRow, 'Imperial')
      expect(mockCreateMaterials).toHaveBeenCalledWith([mockMaterialDTO], mockToken, mockBaseUrl)
      expect(mockHighlightRows).toHaveBeenCalledWith([2], 'red')
      expect(mockUi.alert).toHaveBeenCalledWith("Some materials failed to be created at Rows: 2")
    })
    it('completes successfully when no failed rows are returned', () => {
      const mockMaterialRow: IMaterialRow = {
        Name: 'material',
        Category: 'category',
        Subcategory: 'subcategory',
        "Unit of Measure": "TON",
        BaseCost: 10,
        IsTemporaryMaterial: false,
        TaxPercent: 0.1,
        WastePercent: 0.1,
        JobCostIDCode: "JCID",
        Notes: "mock note",
        ShouldRoundQuantity: true,
        QuantityRoundingIncrement: 1,
        TruckingCost: 10
      }
      const mockMaterialDTO: IMaterialDTO = {
        EstimateREF: ESTIMATE_REF,
        Name: mockMaterialRow.Name,
        Category: mockMaterialRow.Category,
        Subcategory: mockMaterialRow.Subcategory,
        ImperialUnitOfMeasure: "TON",
        MetricUnitOfMeasure: "MT",
        BaseCost: mockMaterialRow.BaseCost,
        BaseCostSystemOfMeasure: 'Imperial',
        IsTemporaryMaterial: mockMaterialRow.IsTemporaryMaterial,
        TaxPercent: mockMaterialRow.TaxPercent,
        WastePercent: mockMaterialRow.WastePercent,
        TruckingCost: mockMaterialRow.TruckingCost,
        TruckingCostSystemOfMeasure: 'Imperial',
        JobCostIDCode: mockMaterialRow.JobCostIDCode,
        Notes: mockMaterialRow.Notes,
        ShouldRoundQuantity: mockMaterialRow.ShouldRoundQuantity,
        QuantityRoundingIncrement: mockMaterialRow.QuantityRoundingIncrement,
        QuantityRoundingIncrementSystemOfMeasure: 'Imperial'
      }
      mockGetSpreadSheetData.mockReturnValue([mockMaterialRow])
      mockCreateMaterialDTO.mockReturnValue(mockMaterialDTO)
      mockCreateMaterials.mockReturnValue({failedMaterials: [], createdMaterials: [mockMaterialDTO]})
      gLib.CreateMaterials('Imperial')
      expect(mockCreateMaterialDTO).toHaveBeenCalledExactlyOnceWith(mockMaterialRow, 'Imperial')
      expect(mockCreateMaterials).toHaveBeenCalledWith([mockMaterialDTO], mockToken, mockBaseUrl)
      expect(mockUi.alert).toHaveBeenCalledWith('All materials successfully created!')
    })
  })
})
