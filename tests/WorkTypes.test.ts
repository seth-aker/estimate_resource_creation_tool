import gas from 'gas-local';
import { vi, beforeEach, expect, describe, it, beforeAll } from 'vitest'
import { mockSpreadsheetApp, mockUrlFetchApp, mockLogger, mockUi } from './mocks';

const mockGetDBSubcategoryList = vi.fn()
const mockGetDBCategoryList = vi.fn()
const mockGetSpreadsheetData = vi.fn()
const mockCreateWorkTypes = vi.fn(() => ({failedWorkTypes: [], createdWorkTypes: []}))
const mockCreateWorkSubTypes = vi.fn(() => ({failedWorkSubtypes: [], createdWorkSubtypes: []}))
const mocks = {
  SpreadsheetApp: mockSpreadsheetApp,
  UrlFetchApp: mockUrlFetchApp,
  Logger: mockLogger,
  // __proto__: gas.globalMockDefaults
}

const glib = gas.require('./dist', mocks)

describe('WorkTypes', () => {
  const mockWorkTypeID = "1234"
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
  describe('_createWorkSubtypes', () => {

    it('returns empty array when workTypeSubTypeMap is empty', () => {
      const {failedWorkSubtypes, createdWorkSubtypes} = glib._createWorkSubtypes([], 'token', 'baseUrl')
      expect(failedWorkSubtypes).toEqual([])
      expect(createdWorkSubtypes).toEqual([])
    })
    it('returns an empty array when all workSubTypes are created successfully', () => {
      const mockWorkTypeMap = [
        {parentRef: 'asphaltREF', subtype: 'Paving'},
        {parentRef: 'asphaltREF', subtype: 'Demo'}
      ]
      const mockPayloads = mockWorkTypeMap.map((each) => ({
        EstimateREF: ESTIMATE_REF,
        Name: each.subtype,
        CategoryREF: each.parentRef
      }))
      const expectedFetchOptions = mockPayloads.map((payload) => {
        return {
          url: mockBaseUrl + "/Resource/Subcategory/WorkSubType",
          method: 'post' as const,
          headers: expectedHeader,
          payload: JSON.stringify(payload)
        }
      })
      const mockReturnValues = [
        { getResponseCode: () => 201,
          getContentText: () => JSON.stringify({Item: mockPayloads[0]})
        },
        { getResponseCode: () => 201,
          getContentText: () => JSON.stringify({Item: mockPayloads[1]})
        },
      ]
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      const {failedWorkSubtypes, createdWorkSubtypes} = glib._createWorkSubtypes(mockWorkTypeMap, mockToken, mockBaseUrl)

      expect(failedWorkSubtypes).toHaveLength(0)
      expect(mockUrlFetchApp.fetchAll).toBeCalledWith(expectedFetchOptions)
      expect(mockLogger.log).nthCalledWith(1, "Work Subtype \"Paving\" successfully created.")
      expect(mockLogger.log).nthCalledWith(2, "Work Subtype \"Demo\" successfully created.")
      expect(createdWorkSubtypes).toEqual(mockPayloads)
    })
    it('returns correct worksubtypes that failed', () => {
       const mockWorkTypeMap = [
        {parentRef: 'asphaltREF', subtype: 'Paving'},
        {parentRef: 'asphaltREF', subtype: 'Demo'}
      ]

      const mockPayloads = [
        { EstimateREF: ESTIMATE_REF,
          Name: 'Paving',
          CategoryREF: 'asphaltREF'
        },
        { EstimateREF: ESTIMATE_REF,
          Name: 'Demo',
          CategoryREF: 'asphaltREF'
        }
      ]
      const expectedFetchOptions = mockPayloads.map((payload) => {
        return {
          url: mockBaseUrl + "/Resource/Subcategory/WorkSubType",
          method: 'post' as const,
          headers: expectedHeader,
          payload: JSON.stringify(payload)
        }
      })
      const mockReturnValues = [
        { getResponseCode: () => 400,
          getContentText: () => "Mock Error Message"
        },
        { getResponseCode: () => 500,
          getContentText: () => "Mock Error Message"
        },
      ]
      const expectedReturnValues = [
        'Paving',
        'Demo'
      ]
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      const {failedWorkSubtypes, createdWorkSubtypes} = glib._createWorkSubtypes(mockWorkTypeMap, mockToken, mockBaseUrl)
      
      expect(failedWorkSubtypes).toEqual(expectedReturnValues) 
      expect(mockUrlFetchApp.fetchAll).toBeCalledWith(expectedFetchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Subtype: "Paving" failed to create with status code 400. Error: Mock Error Message')
      expect(mockLogger.log).nthCalledWith(2, 'Work Subtype: "Demo" failed to create with status code 500. Error: Mock Error Message')
      expect(createdWorkSubtypes).toHaveLength(0)
    })
    it('logs correct message when the server response is either 200 or 409 (item already exists in the database)', () => {
      const mockWorkTypeMap = [
        {parentRef: mockWorkTypeID, subtype: 'Paving'},
        {parentRef: mockWorkTypeID, subtype: 'Demo'}
      ]
      
      const mockPayloads = [
        { EstimateREF: ESTIMATE_REF,
          Name: 'Paving',
          CategoryREF: mockWorkTypeID
        },
        { EstimateREF: ESTIMATE_REF,
          Name: 'Demo',
          CategoryREF: mockWorkTypeID
        }
      ]
      glib.getDBSubcategoryList = mockGetDBSubcategoryList;
      mockGetDBSubcategoryList.mockReturnValue([
        mockPayloads[0],
        mockPayloads[1]
      ])
      const expectedFetchOptions = mockPayloads.map((payload) => {
        return {
          url: mockBaseUrl + "/Resource/Subcategory/WorkSubType",
          method: 'post' as const,
          headers: expectedHeader,
          payload: JSON.stringify(payload)
        }
      })
      const mockReturnValues = [
        { getResponseCode: () => 409 },
        { getResponseCode: () => 200 },
      ]
      const expectedQuery = `?$filter=EstimateREF eq ${ESTIMATE_REF} and ((Name eq 'Paving' and CategoryREF eq ${mockWorkTypeID}) or (Name eq 'Demo' and CategoryREF eq ${mockWorkTypeID}))`
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      const {failedWorkSubtypes, createdWorkSubtypes} = glib._createWorkSubtypes(mockWorkTypeMap, mockToken, mockBaseUrl)
      
      expect(failedWorkSubtypes).toEqual([]) 
      expect(mockUrlFetchApp.fetchAll).toBeCalledWith(expectedFetchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Subtype: "Paving" already existed in the database.')
      expect(mockLogger.log).nthCalledWith(2, 'Work Subtype: "Demo" already existed in the database.')
      expect(createdWorkSubtypes).toEqual(mockPayloads)
      expect(mockGetDBSubcategoryList).toHaveBeenCalledWith('WorkSubType', mockToken, mockBaseUrl, expectedQuery)
    })

  })
  describe('_createWorkTypes', () => {
    it('should create all worktypes successfully when response codes are 201', () => {
      const mockWorkTypes = [
        'Asphalt',
        'Concrete',
        'Mobilization'
      ]
      const mockPayloads = mockWorkTypes.map((each) => ({EstimateREF: ESTIMATE_REF, Name: each}))
      const expectedBatchOptions =  mockPayloads.map((payload) => {
        return {
          url: mockBaseUrl + '/Resource/Category/WorkType',
          method: 'post' as const,
          headers: expectedHeader,
          payload: JSON.stringify(payload)
        }
      })
      const mockCreatedWorkTypes = [
        { Item: {
          Name: "Asphalt",
          EstimateREF: ESTIMATE_REF,
          ObjectID: '0001'
        }},
        { Item: {
          Name: "Concrete",
          EstimateREF: ESTIMATE_REF,
          ObjectID: '0002'
        }},
        { Item: {
          Name: "Mobilization",
          EstimateREF: ESTIMATE_REF,
          ObjectID: '0003'
        }}
      ]
      const mockReturnValues = mockCreatedWorkTypes.map((eachWorkType) => {
        return {
          getResponseCode: () => 201,
          getContentText: () => JSON.stringify(eachWorkType)
        }
      })
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      
      const {failedWorkTypes, createdWorkTypes} = glib._createWorkTypes(mockWorkTypes, mockToken, mockBaseUrl)

      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Type: "Asphalt" successfully created')
      expect(mockLogger.log).nthCalledWith(2, 'Work Type: "Concrete" successfully created')
      expect(mockLogger.log).nthCalledWith(3, 'Work Type: "Mobilization" successfully created')
      expect(failedWorkTypes).toHaveLength(0)
      expect(createdWorkTypes).toEqual(mockCreatedWorkTypes.map(each => each.Item))
    })
    it('should handle error response codes correctly', () => {
      const mockWorkTypeData = [
        'Asphalt',
        'Concrete',
        'Mobilization'
      ]
      const mockPayloads = [
        {EstimateREF: ESTIMATE_REF, Name: 'Asphalt'},
        {EstimateREF: ESTIMATE_REF, Name: 'Concrete'},
        {EstimateREF: ESTIMATE_REF, Name: 'Mobilization'}
      ]
      const expectedBatchOptions =  mockPayloads.map((payload) => {
        return {
          url: mockBaseUrl + '/Resource/Category/WorkType',
          method: 'post' as const,
          headers: expectedHeader,
          payload: JSON.stringify(payload)
        }
      })
      const mockReturnValues = expectedBatchOptions.map(_ => {
        return { getResponseCode: () => 400, getContentText: () => 'Mock Error Message'}
      })
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      const {failedWorkTypes, createdWorkTypes} = glib._createWorkTypes(mockWorkTypeData, mockToken, mockBaseUrl)
      expect(failedWorkTypes).toEqual(mockWorkTypeData)
      expect(createdWorkTypes).toHaveLength(0)
      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Type: "Asphalt" failed to create with status code 400. Error: Mock Error Message')
      expect(mockLogger.log).nthCalledWith(2, 'Work Type: "Concrete" failed to create with status code 400. Error: Mock Error Message')
      expect(mockLogger.log).nthCalledWith(3, 'Work Type: "Mobilization" failed to create with status code 400. Error: Mock Error Message')
    })

    it('should handle response codes of 200 or 409 by getting work type info with get request', () => {
      const mockWorkTypeData = [
        'Asphalt',
        'Concrete'
      ]
      const mockPayloads = [
        {EstimateREF: ESTIMATE_REF, Name: 'Asphalt'},
        {EstimateREF: ESTIMATE_REF, Name: 'Concrete'},
      ]
      const expectedBatchOptions =  mockPayloads.map((payload) => {
        return {
          url: mockBaseUrl + '/Resource/Category/WorkType',
          method: 'post' as const,
          headers: expectedHeader,
          payload: JSON.stringify(payload)
        }
      })
      const mockReturnValues = [
        { getResponseCode: () => 200},
        { getResponseCode: () => 409}
      ]
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      const mockReturnAsphalt = {
        Name: 'Asphalt',
        EstimateREF: ESTIMATE_REF,
        ObjectID: '0001'
      }
      const mockReturnConcrete = {
        Name: "Concrete",
        EstimateREF: ESTIMATE_REF,
        ObjectID: '0002'
      }

      glib.getDBCategoryList = mockGetDBCategoryList
      mockGetDBCategoryList.mockReturnValue([mockReturnAsphalt, mockReturnConcrete])
      const expectedQuery = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (Name eq 'Asphalt' or Name eq 'Concrete')`
      const {failedWorkTypes, createdWorkTypes} = glib._createWorkTypes(mockWorkTypeData, mockToken, mockBaseUrl)

      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Type: "Asphalt" already exists in the database')
      expect(mockLogger.log).nthCalledWith(2, 'Work Type: "Concrete" already exists in the database')
      expect(failedWorkTypes).toHaveLength(0)
      expect(createdWorkTypes).toEqual([mockReturnAsphalt, mockReturnConcrete])
      expect(mockGetDBCategoryList).toHaveBeenCalledWith('WorkType', mockToken, mockBaseUrl, expectedQuery)
    })
  })
  describe('CreateWorkTypes', () => {
    beforeAll(() => {
      glib.authenticate = vi.fn(() => ({token: mockToken, baseUrl: mockBaseUrl}))
      glib.getSpreadSheetData = mockGetSpreadsheetData
      glib._createWorkTypes = mockCreateWorkTypes
      glib._createWorkSubtypes = mockCreateWorkSubTypes
    })
    

    it('returns early when there is not data in the spreadsheet', () => {
      mockGetSpreadsheetData.mockReturnValue([])
      glib.CreateWorkTypes()
      expect(mockLogger.log).toHaveBeenCalledWith('No data to send!')
      expect(mockUi.alert).toHaveBeenCalledWith('No data to send!')
      expect(mockCreateWorkTypes).not.toHaveBeenCalled()
      expect(mockCreateWorkSubTypes).not.toHaveBeenCalled()
    })
    it('sends an array of unique worktypes to _createWorkTypes', () => {
      const mockSpreadSheetData: IWorkType[] = [
        {"Work Type": 'Asphalt', "Work Subtype": "" },
        {"Work Type": 'Asphalt', "Work Subtype": ""},
        {"Work Type": 'Concrete', "Work Subtype": ""}
      ]
      mockGetSpreadsheetData.mockReturnValue(mockSpreadSheetData)
      const expextedUniqueWorkTypes = [
        'Asphalt',
        'Concrete'
      ]
      glib.CreateWorkTypes()

      expect(mockCreateWorkTypes).toHaveBeenCalledWith(expextedUniqueWorkTypes, mockToken, mockBaseUrl)
      expect(mockUi.alert).toHaveBeenCalledWith("All worktypes created successfully!")
    })
  })
})
