import { vi, describe, it, beforeEach, expect} from 'vitest'
import gas from 'gas-local'
import { mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUrlFetchApp, mockUserProperties } from './mocks'
const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger,
    PropertiesService: mockPropertiesService
}
const gLib = gas.require('./dist', mocks)

describe('Customers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  const ESTIMATE_REF = "00000000-0000-0000-0000-000000000000";
  const mockBaseUrl = 'https://mock.com'
  const mockToken = 'mock-token' 
  const mockHeader = {
      'Authorization': `Bearer ${mockToken}`,
      'Content-Type': 'application/json',
      'ClientID': mockUserProperties.clientID,
      'ClientSecret': mockUserProperties.clientSecret,
      "ConnectionString": `Server=${mockUserProperties.serverName};Database=${mockUserProperties.dbName};MultipleActiveResultSets=true;Integrated Security=SSPI;`
  }
  describe('_createCustomerCategories', () => {
    it('returns early when customer categories array is length of 0', () => {
      const result = gLib._createCustomerCategories([], mockToken, mockBaseUrl)
      expect(result).toEqual([])
      expect(mockUrlFetchApp.fetchAll).not.toHaveBeenCalled()
    })
    it('returns failed categories when response code is a failure', () => {
      const categories = ['cat1', 'cat2', 'cat3']
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 400, getContentText: () => 'Error' },
        { getResponseCode: () => 500, getContentText: () => 'Error' },
        { getResponseCode: () => 201 }
      ])
      const response = gLib._createCustomerCategories(categories, mockToken, mockBaseUrl)
      
      expect(response).toEqual(['cat1', 'cat2'])
      expect(mockLogger.log).nthCalledWith(1, 'Category: "cat1" failed to create with status code 400. Error: Error')
      expect(mockLogger.log).nthCalledWith(2, 'Category: "cat2" failed to create with status code 500. Error: Error')
    })
    it('returns successfully when response is 409 or 200', () => {
      const categories = ['cat1', 'cat2', 'cat3']
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 409 },
        { getResponseCode: () => 200 },
        { getResponseCode: () => 201 }
      ])
      const response = gLib._createCustomerCategories(categories, mockToken, mockBaseUrl)
      
      expect(response).toEqual([])
      expect(mockLogger.log).nthCalledWith(1, 'Customer Category: "cat1" already existed in the database.')
      expect(mockLogger.log).nthCalledWith(2, 'Customer Category: "cat2" already existed in the database.')
    })
    it('returns successfully when response is 201', () => {
      const categories = ['cat1', 'cat2', 'cat3']
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 201 },
        { getResponseCode: () => 201 }
      ])
      const response = gLib._createCustomerCategories(categories, mockToken, mockBaseUrl)
      
      expect(response).toEqual([])
      expect(mockLogger.log).nthCalledWith(1, 'Customer Category: "cat1" successfully created')
      expect(mockLogger.log).nthCalledWith(2, 'Customer Category: "cat2" successfully created')
    })
  })
  describe('_createCustomers', () => {
    
  })
})
