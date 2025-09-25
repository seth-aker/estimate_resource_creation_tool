import gas from 'gas-local';
import { vi, beforeEach, expect, describe, it } from 'vitest'
import { mockSpreadsheetApp, mockUrlFetchApp, mockLogger, mockUi } from './mocks';

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
    it('returns empty array when workTypesData is empty', () => {
      const response = glib._createWorkSubtypes([], undefined, 'token', 'baseUrl')
      expect(response).toEqual([])
    })
    it('returns an empty array when all workSubTypes are created successfully', () => {
      const mockWorkTypeData = [
        { "Work Type": 'Asphalt', "Work Subtype": "Paving"},
        { "Work Type": 'Asphalt', "Work Subtype": "Demo"},
        { "Work Type": 'Concrete', "Work Subtype": ""},
        { "Work Type": 'Asphalt', "Work Subtype": "" }
      ]
      const mockWorkTypeParent: ICategoryItem = {
        EstimateREF: ESTIMATE_REF,
        Name: 'Asphalt',
        ObjectID: mockWorkTypeID,
        AntiTamperToken: 'token'
      }
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
      const expectedFetchOptions = mockPayloads.map((payload) => {
        return {
          url: mockBaseUrl + "/Resource/Subcategory/WorkSubType",
          method: 'post' as const,
          headers: expectedHeader,
          payload: JSON.stringify(payload)
        }
      })
      const mockReturnValues = [
        { getResponseCode: () => 201 },
        { getResponseCode: () => 201 },
      ]
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      const returnData = glib._createWorkSubtypes(mockWorkTypeData, mockWorkTypeParent, mockToken, mockBaseUrl)

      expect(returnData).toEqual([])
      expect(mockUrlFetchApp.fetchAll).toBeCalledWith(expectedFetchOptions)
      expect(mockLogger.log).nthCalledWith(1, "Work Subtype \"Paving\" successfully created.")
      expect(mockLogger.log).nthCalledWith(2, "Work Subtype \"Demo\" successfully created.")
    })
    it('returns correct worktypes that failed', () => {
      const mockWorkTypeData = [
        { "Work Type": 'Asphalt', "Work Subtype": "Paving"},
        { "Work Type": 'Asphalt', "Work Subtype": "Demo"},
        { "Work Type": 'Concrete', "Work Subtype": ""},
        { "Work Type": 'Asphalt', "Work Subtype": "" }
      ]

      const mockWorkTypeParent: ICategoryItem = {
        EstimateREF: ESTIMATE_REF,
        Name: 'Asphalt',
        ObjectID: mockWorkTypeID,
        AntiTamperToken: 'token'
      }
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
      const expectedFetchOptions = mockPayloads.map((payload) => {
        return {
          url: mockBaseUrl + "/Resource/Subcategory/WorkSubType",
          method: 'post' as const,
          headers: expectedHeader,
          payload: JSON.stringify(payload)
        }
      })
      const mockReturnValues = [
        { getResponseCode: () => 400 },
        { getResponseCode: () => 500 },
      ]
      const expectedReturnValues = [
        {workType: 'Asphalt', workSubtype: 'Paving'},
        {workType: 'Asphalt', workSubtype: 'Demo'},
      ]
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      const returnValues = glib._createWorkSubtypes(mockWorkTypeData, mockWorkTypeParent, mockToken, mockBaseUrl)
      
      expect(returnValues).toEqual(expectedReturnValues) 
      expect(mockUrlFetchApp.fetchAll).toBeCalledWith(expectedFetchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Subtype: "Paving" failed to create with status code 400')
      expect(mockLogger.log).nthCalledWith(2, 'Work Subtype: "Demo" failed to create with status code 500')
    })
    it('logs correct message when the server response is either 200 or 409 (item already exists in the database)', () => {
      const mockWorkTypeData = [
        { "Work Type": 'Asphalt', "Work Subtype": "Paving"},
        { "Work Type": 'Asphalt', "Work Subtype": "Demo"},
        { "Work Type": 'Concrete', "Work Subtype": ""},
        { "Work Type": 'Asphalt', "Work Subtype": "" }
      ]

      const mockWorkTypeParent: ICategoryItem = {
        EstimateREF: ESTIMATE_REF,
        Name: 'Asphalt',
        ObjectID: mockWorkTypeID,
        AntiTamperToken: 'token'
      }
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
      
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      const returnValues = glib._createWorkSubtypes(mockWorkTypeData, mockWorkTypeParent, mockToken, mockBaseUrl)
      
      expect(returnValues).toEqual([]) 
      expect(mockUrlFetchApp.fetchAll).toBeCalledWith(expectedFetchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Subtype: "Paving" already existed in the database.')
      expect(mockLogger.log).nthCalledWith(2, 'Work Subtype: "Demo" already existed in the database.')
    })

  })
  describe('_getUniqueWorkTypes', () => {
    it('should return only one instance of each worktype in the list', () => {
      const mockWorkTypeData = [
        { "Work Type": 'Asphalt', "Work Subtype": "Paving"},
        { "Work Type": 'Asphalt', "Work Subtype": "Demo"},
        { "Work Type": 'Concrete', "Work Subtype": ""},
        { "Work Type": 'Asphalt', "Work Subtype": "" },
        { "Work Type": 'Concrete', 'Work Subtype': "Paving"},
        { "Work Type": "Mobilization", "Work Subtype": ''}
      ]
      const expectedResult = ['Asphalt', 'Concrete', 'Mobilization']
      const actualResult: Set<string> = glib._getUniqueWorkTypes(mockWorkTypeData)
      const resultArray = Array.from(actualResult).sort()
      expect(resultArray).toEqual(expectedResult)
    })
  })
  describe('_createWorkTypes', () => {
    it('should create all worktypes and subtypes successfully when response codes are 201', () => {
      const mockWorkTypeData = [
        { "Work Type": 'Asphalt', "Work Subtype": "Paving"},
        { "Work Type": 'Asphalt', "Work Subtype": "Demo"},
        { "Work Type": 'Concrete', "Work Subtype": ""},
        { "Work Type": 'Asphalt', "Work Subtype": "" },
        { "Work Type": 'Concrete', 'Work Subtype': "Paving"},
        { "Work Type": "Mobilization", "Work Subtype": ''}
      ]
      glib._getUniqueWorkTypes = (_: string) => new Set<string>(['Asphalt', 'Concrete', 'Mobilization'])
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
      glib._createWorkSubtypes = vi.fn(() => [])
      
      glib._createWorkTypes(mockWorkTypeData, mockToken, mockBaseUrl)

      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Type: "Asphalt" successfully created.')
      expect(mockLogger.log).nthCalledWith(2, 'Work Type: "Concrete" successfully created.')
      expect(mockLogger.log).nthCalledWith(3, 'Work Type: "Mobilization" successfully created.')
      expect(glib._createWorkSubtypes).toHaveBeenCalledTimes(3)
      expect(glib._createWorkSubtypes).nthCalledWith(1, mockWorkTypeData, mockCreatedWorkTypes[0]?.Item, mockToken, mockBaseUrl)
      expect(glib._createWorkSubtypes).nthCalledWith(2, mockWorkTypeData, mockCreatedWorkTypes[1]?.Item, mockToken, mockBaseUrl)
      expect(glib._createWorkSubtypes).nthCalledWith(3, mockWorkTypeData, mockCreatedWorkTypes[2]?.Item, mockToken, mockBaseUrl)
      expect(mockSpreadsheetApp.getUi).toHaveBeenCalled()
      expect(mockUi.alert).toHaveBeenCalledWith('All worktypes created successfully!')
      
    })
    it('should handle error response codes correctly', () => {
      const mockWorkTypeData = [
        { "Work Type": 'Asphalt', "Work Subtype": "Paving"},
        { "Work Type": 'Asphalt', "Work Subtype": "Demo"},
        { "Work Type": 'Concrete', "Work Subtype": ""},
        { "Work Type": 'Asphalt', "Work Subtype": "" },
        { "Work Type": 'Concrete', 'Work Subtype': "Paving"},
        { "Work Type": "Mobilization", "Work Subtype": ''}
      ]
      glib._getUniqueWorkTypes = (_: string) => new Set<string>(['Asphalt', 'Concrete', 'Mobilization'])
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
        return { getResponseCode: () => 400}
      })
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      glib._createWorkSubtypes = vi.fn()
      glib._createWorkTypes(mockWorkTypeData, mockToken, mockBaseUrl)

      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Type: "Asphalt" failed to create with status code 400')
      expect(mockLogger.log).nthCalledWith(2, 'Work Type: "Concrete" failed to create with status code 400')
      expect(mockLogger.log).nthCalledWith(3, 'Work Type: "Mobilization" failed to create with status code 400')
      expect(glib._createWorkSubtypes).not.toHaveBeenCalled()
      expect(mockSpreadsheetApp.getUi).toHaveBeenCalled()
      expect(mockUi.alert).toHaveBeenLastCalledWith("The following worktype(s) failed to be created. \nAsphalt,\nConcrete,\nMobilization")
    })

    it('should handle response codes of 200 or 409 by getting work type info with get request', () => {
      const mockWorkTypeData = [
        { "Work Type": 'Asphalt', "Work Subtype": "Paving"},
        { "Work Type": 'Asphalt', "Work Subtype": "Demo"},
        { "Work Type": 'Concrete', "Work Subtype": ""},
        { "Work Type": 'Asphalt', "Work Subtype": "" },
        { "Work Type": 'Concrete', 'Work Subtype': "Paving"},
        {}
      ]
      glib._getUniqueWorkTypes = (_: string) => new Set<string>(['Asphalt', 'Concrete'])
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
      mockUrlFetchApp.fetch.mockImplementation((getUrl: string, _options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions) => {
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ Items: 
            [getUrl.includes('Asphalt') ? mockReturnAsphalt: mockReturnConcrete]
          })
        }
      })
      const mockGetOptions = {
        method: 'get',
        headers: expectedHeader
      }
      glib._createWorkSubtypes = vi.fn(() => [])

      glib._createWorkTypes(mockWorkTypeData, mockToken, mockBaseUrl)

      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Type: "Asphalt" already existed in the database.')
      expect(mockUrlFetchApp.fetch).nthCalledWith(1, `${mockBaseUrl}/Resource/Category/WorkType?filter=EstimateREF eq ${ESTIMATE_REF} and Name eq 'Asphalt'`, mockGetOptions)
      expect(mockUrlFetchApp.fetch).nthCalledWith(2, `${mockBaseUrl}/Resource/Category/WorkType?filter=EstimateREF eq ${ESTIMATE_REF} and Name eq 'Concrete'`, mockGetOptions)
      expect(glib._createWorkSubtypes).nthCalledWith(1, mockWorkTypeData, mockReturnAsphalt, mockToken, mockBaseUrl)
      expect(glib._createWorkSubtypes).nthCalledWith(2, mockWorkTypeData, mockReturnConcrete, mockToken, mockBaseUrl)
      expect(mockSpreadsheetApp.getUi).toHaveBeenCalled()
      expect(mockUi.alert).toHaveBeenCalledWith('All worktypes created successfully!')

    })
    it('should gracefully handle a variety of codes (201, 400, 409)', () => {
      const mockWorkTypeData = [
        { "Work Type": 'Asphalt', "Work Subtype": "Paving"},
        { "Work Type": 'Asphalt', "Work Subtype": "Demo"},
        { "Work Type": 'Concrete', "Work Subtype": ""},
        { "Work Type": 'Asphalt', "Work Subtype": "" },
        { "Work Type": 'Concrete', 'Work Subtype': "Paving"},
        { "Work Type": 'Mobilization', "Work Subtype": ""}
      ]
      glib._getUniqueWorkTypes = (_: string) => new Set<string>(['Asphalt', 'Concrete', 'Mobilization'])
      const mockPayloads = [
        {EstimateREF: ESTIMATE_REF, Name: 'Asphalt'},
        {EstimateREF: ESTIMATE_REF, Name: 'Concrete'},
        {EstimateREF: ESTIMATE_REF, Name: 'Mobilization'},
      ]
      const expectedBatchOptions =  mockPayloads.map((payload) => {
        return {
          url: mockBaseUrl + '/Resource/Category/WorkType',
          method: 'post' as const,
          headers: expectedHeader,
          payload: JSON.stringify(payload)
        }
      })
      const mockAsphaltItem = {
        Name: "Asphalt",
        EstimateREF: ESTIMATE_REF,
        ObjectID: '0001'
      }
      const mockReturnValues = [
        { getResponseCode: () => 201, // Asphalt
          getContentText: () => JSON.stringify({Item: mockAsphaltItem})
        },
        { getResponseCode: () => 409}, // Concrete
        { getResponseCode: () => 400} // Mobilization
      ]
      mockUrlFetchApp.fetchAll.mockReturnValue(mockReturnValues)
      
      const mockReturnConcrete = {
        Name: "Concrete",
        EstimateREF: ESTIMATE_REF,
        ObjectID: '0002'
      }
      mockUrlFetchApp.fetch.mockImplementation((_getUrl: string, _options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions) => {
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ Items: 
            [mockReturnConcrete]
          })
        }
      })
      const mockGetOptions = {
        method: 'get',
        headers: expectedHeader
      }
      glib._createWorkSubtypes = vi.fn(() => [])

      glib._createWorkTypes(mockWorkTypeData, mockToken, mockBaseUrl)

      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'Work Type: "Asphalt" successfully created.')
      expect(glib._createWorkSubtypes).nthCalledWith(1, mockWorkTypeData, mockAsphaltItem, mockToken, mockBaseUrl)

      expect(mockLogger.log).nthCalledWith(2, 'Work Type: "Concrete" already existed in the database.')
      expect(mockUrlFetchApp.fetch).nthCalledWith(1, `${mockBaseUrl}/Resource/Category/WorkType?filter=EstimateREF eq ${ESTIMATE_REF} and Name eq 'Concrete'`, mockGetOptions)
      expect(glib._createWorkSubtypes).nthCalledWith(2, mockWorkTypeData, mockReturnConcrete, mockToken, mockBaseUrl)

      expect(mockLogger.log).nthCalledWith(3, 'Work Type: "Mobilization" failed to create with status code 400')
  
     
      expect(mockSpreadsheetApp.getUi).toHaveBeenCalled()
      expect(mockUi.alert).toHaveBeenCalledWith('The following worktype(s) failed to be created. \nMobilization')
    })
  })
})
