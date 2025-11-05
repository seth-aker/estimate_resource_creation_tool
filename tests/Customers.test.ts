import { vi, describe, it, beforeEach, expect, beforeAll} from 'vitest'
import { gasRequire } from 'tgas-local'
import { mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUi, mockUrlFetchApp } from './mocks'
const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger,
    PropertiesService: mockPropertiesService
}
const gLib = gasRequire('./dist', mocks)

describe('Customers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  const mockBaseUrl = 'https://mock.com'
  const mockToken = 'mock-token' 
  const mockCustomerRow1 = {
    Name: "Cust1",
    City: "City1",
    Address1: 'Address1',
    State: "NY",
    Zip: "05056",
    Category: 'Cat1'
  }
  const mockCustomerRow2 = {
    Name: "Cust2",
    City: "City2",
    Address1: 'Address2',
    State: "NY",
    Zip: "05056",
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
      expect(mockLogger.log).nthCalledWith(1, 'Customer Category: "cat1" failed to create with status code 400. Error: Error')
      expect(mockLogger.log).nthCalledWith(2, 'Customer Category: "cat2" failed to create with status code 500. Error: Error')
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
    
    it('returns failed rows when error status code is returned', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 400, getContentText: () => 'Error' },
        { getResponseCode: () => 500, getContentText: () => 'Error' }
      ])
      
      const failedRows = gLib._createCustomers([mockCustomerRow1, mockCustomerRow2], mockToken, mockBaseUrl)

      expect(failedRows).toEqual([2,3])
      expect(mockLogger.log).nthCalledWith(1, 'Row 2: Customer "Cust1" failed with status code 400. Error: Error')
      expect(mockLogger.log).nthCalledWith(2, 'Row 3: Customer "Cust2" failed with status code 500. Error: Error')
    })
    it('logs customer already existed in the database', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 409 },
        { getResponseCode: () => 200 }
      ])
      const failedRows = gLib._createCustomers([mockCustomerRow1, mockCustomerRow2], mockToken, mockBaseUrl)

      expect(failedRows).toEqual([])
      expect(mockLogger.log).nthCalledWith(1, 'Row 2: Customer "Cust1" already existed in the database.')
      expect(mockLogger.log).nthCalledWith(2, 'Row 3: Customer "Cust2" already existed in the database.')
    })
    it('correctly logs when all responses are 201', () => {
       mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 201 },
        { getResponseCode: () => 201 }
      ])
      const failedRows = gLib._createCustomers([mockCustomerRow1, mockCustomerRow2], mockToken, mockBaseUrl)

      expect(failedRows).toEqual([])
      expect(mockLogger.log).nthCalledWith(1, 'Customer: "Cust1" successfully created')
      expect(mockLogger.log).nthCalledWith(2, 'Customer: "Cust2" successfully created')
    })
  })
  describe('CreateCustomers', () => {
    beforeAll(() => {
      gLib.authenticate = vi.fn(() => ({token: mockToken, baseUrl: mockBaseUrl}))
      gLib.getSpreadSheetData = vi.fn()
      gLib._createCustomerCategories = vi.fn()
      gLib._createCustomers = vi.fn()
      gLib.highlightRows = vi.fn()
    })
    it('exits early when there is no customer data to send', () => {
      gLib.getSpreadSheetData.mockReturnValue([])
      gLib.CreateCustomers()
      expect(mockLogger.log).toHaveBeenCalledWith("CreateCustomers() failed to run because there was no data to send.")
      expect(mockUi.alert).toHaveBeenCalledWith('No data to send!')
      expect(gLib._createCustomerCategories).not.toHaveBeenCalled()
    })
    it('throws error when _createCustomerCategories returns failed categories', () => {
      gLib.getSpreadSheetData.mockReturnValue([mockCustomerRow1, mockCustomerRow2])
      gLib._createCustomerCategories.mockReturnValue(['Cat1'])
      
      expect(() => gLib.CreateCustomers()).toThrow('Script failed while creating the following customer categories: Cat1')
      expect(gLib._createCustomerCategories).toHaveBeenCalledWith(['Cat1'], mockToken, mockBaseUrl)
      expect(gLib._createCustomers).not.toHaveBeenCalled()
    })
    it('alerts users of an error and highlights failed rows when _createCustomers returns failed rows', () => {
      gLib.getSpreadSheetData.mockReturnValue([mockCustomerRow1, mockCustomerRow2])
      gLib._createCustomerCategories.mockReturnValue([])
      gLib._createCustomers.mockReturnValue([2,3])

      gLib.CreateCustomers()
      
      expect(gLib._createCustomers).toHaveBeenCalledWith([mockCustomerRow1, mockCustomerRow2], mockToken, mockBaseUrl)
      expect(gLib.highlightRows).toHaveBeenCalledWith([2,3], 'red')
      expect(mockUi.alert).toHaveBeenCalledWith('Some rows failed to be created. Failed Rows: 2, 3')
    })
    it('correctly completes with no errors when all functions return empty arrays', () => {
      gLib.getSpreadSheetData.mockReturnValue([mockCustomerRow1, mockCustomerRow2])
      gLib._createCustomerCategories.mockReturnValue([])
      gLib._createCustomers.mockReturnValue([])

      gLib.CreateCustomers()
      expect(gLib._createCustomerCategories).toHaveBeenCalledWith(['Cat1'], mockToken, mockBaseUrl)
      expect(gLib._createCustomers).toHaveBeenCalledWith([mockCustomerRow1, mockCustomerRow2], mockToken, mockBaseUrl)
      expect(mockUi.alert).toHaveBeenCalledWith("All customers successfully created.")
    })
  })
})
