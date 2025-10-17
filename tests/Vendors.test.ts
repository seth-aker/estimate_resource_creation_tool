import { vi, describe, it, beforeEach, expect, beforeAll} from 'vitest'
import gas from 'gas-local'
import { mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUi, mockUrlFetchApp } from './mocks'

// const mockGetDBCategoryList = vi.fn()
// const mockGetDBSubcategoryList = vi.fn()
// const mockGetOrganization = vi.fn()
const mockToken = 'mockToken'
const mockBaseUrl = 'https://mock.com'
const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger,
    PropertiesService: mockPropertiesService
}
const gLib = gas.require('./dist', mocks)

describe('Vendors', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  describe('_addVendorMaterialCategories', () => {
    const mockPayloads: IVendorMaterialPayload[] = [
      {OrganizationREF: 'mockOrgREF', MaterialCategoryREF: 'matREF1'},
      {OrganizationREF: 'mockOrgREF', MaterialCategoryREF: 'matREF2'},
      {OrganizationREF: 'mockOrgREF', MaterialCategoryREF: 'matREF3'}
    ]
    it('exits early if payloads array is empty', () => {
      const failedMaterialCategories = gLib._addVendorMaterialCategories([], false, mockToken, mockBaseUrl)
      expect(failedMaterialCategories).toEqual([])
      expect(mockUrlFetchApp.fetchAll).not.toHaveBeenCalled()
    })
    it('returns correct errored material categories and logs errors correctly when error responses are returned', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 400, getContentText: () => 'Error'},
        { getResponseCode: () => 500, getContentText: () => 'Error'},
        { getResponseCode: () => 201 }
      ])
      
      const expectedBatchOptions = mockPayloads.map(payload => ({
        url: `${mockBaseUrl}/Resource/Organization/OrganizationMaterialCategory`,
        headers: gLib.createHeaders(mockToken),
        method: 'post' as const,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }))

      const failedCategories = gLib._addVendorMaterialCategories(mockPayloads, false, mockToken, mockBaseUrl)
      
      expect(failedCategories).toEqual([mockPayloads[0], mockPayloads[1]])
      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'An error occured adding material category with id: matREF1 to organization with id: mockOrgREF. Error: Error')
      expect(mockLogger.log).nthCalledWith(2, 'An error occured adding material category with id: matREF2 to organization with id: mockOrgREF. Error: Error')

    })
    it('correctly logs categories that already exist in the database.', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 409 },
        { getResponseCode: () => 200 },
        { getResponseCode: () => 201 }
      ])
      const failedCategories = gLib._addVendorMaterialCategories(mockPayloads, false, mockToken, mockBaseUrl)
      expect(failedCategories).toEqual([])
      expect(mockLogger.log).nthCalledWith(1, 'Vendor with id: mockOrgREF already has material category with id: matREF1 attached.')
      expect(mockLogger.log).nthCalledWith(2, 'Vendor with id: mockOrgREF already has material category with id: matREF2 attached.')
    })
    it('correctly logs categories added to vendor', () => {
        mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 201 },
        { getResponseCode: () => 201 },
        { getResponseCode: () => 201 }
      ])
      const failedCategories = gLib._addVendorMaterialCategories(mockPayloads, false, mockToken, mockBaseUrl)
      expect(failedCategories).toEqual([])
      expect(mockLogger.log).nthCalledWith(1, 'Material category with id: matREF1 successfully added to vendor with id: mockOrgREF')
      expect(mockLogger.log).nthCalledWith(2, 'Material category with id: matREF2 successfully added to vendor with id: mockOrgREF')
      expect(mockLogger.log).nthCalledWith(3, 'Material category with id: matREF3 successfully added to vendor with id: mockOrgREF')

    })
    it('correctly calls endpoints and logs exceptions when isSubCat is true', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 400, getContentText: () => 'Error' },
        { getResponseCode: () => 409 },
        { getResponseCode: () => 201 }
      ])
      const mockSubCatPayloads: IVendorMaterialPayload[] = [
        { OrganizationREF: 'mockOrgREF', MaterialSubcategoryREF: 'subCatREF1'},
        { OrganizationREF: 'mockOrgREF', MaterialSubcategoryREF: 'subCatREF2'},
        { OrganizationREF: 'mockOrgREF', MaterialSubcategoryREF: 'subCatREF3'},

      ]
      const expectedBatchOptions = mockSubCatPayloads.map(payload => ({
        url: `${mockBaseUrl}/Resource/Organization/OrganizationMaterialSubcategory`,
        headers: gLib.createHeaders(mockToken),
        method: 'post' as const,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }))

      const failedMaterialSubcategories = gLib._addVendorMaterialCategories(mockSubCatPayloads, true, mockToken, mockBaseUrl)

      expect(failedMaterialSubcategories).toEqual([mockSubCatPayloads[0]])
      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
      expect(mockLogger.log).nthCalledWith(1, 'An error occured adding material subcategory with id: subCatREF1 to organization with id: mockOrgREF. Error: Error')
      expect(mockLogger.log).nthCalledWith(2, 'Vendor with id: mockOrgREF already has material subcategory with id: subCatREF2 attached.')
      expect(mockLogger.log).nthCalledWith(3, 'Material subcategory with id: subCatREF3 successfully added to vendor with id: mockOrgREF')
    })
  })
  describe('_createVendors', () => {
    const mockVendorRows: IVendorRow[] = [
      {Name: 'mockVendor1', City: 'mockCity', "Vendor Category": 'VendorCategory1', "Material Categories": 'Matcat1, Matcat2' },
      {Name: 'mockVendor2', City: 'mockCity', "Vendor Category": 'VendorCategory1', "Material Categories": 'Matcat1'},
      {Name: 'mockVendor3', City: 'mockCity', "Vendor Category": 'VendorCategory2', "Material Categories": 'Matcat3, Matcat4'}
    ]
    
    it('should call url fetch app with the correct options', () => {
      const mockPayloads = [
        {Name: 'mockVendor1', City: 'mockCity', Category: 'VendorCategory1'},
        {Name: 'mockVendor2', City: 'mockCity', Category: 'VendorCategory1'},
        {Name: 'mockVendor3', City: 'mockCity', Category: 'VendorCategory2'}
      ]
      const expectedBatchOptions = mockPayloads.map(payload => {
        return {
          url: `${mockBaseUrl}/Resource/Organization/Vendor`,
          method: 'post' as const,
          headers: gLib.createHeaders(mockToken),
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        }
      })
      mockUrlFetchApp.fetchAll.mockReturnValue([])
      const {failedRows, createdVendors} = gLib._createVendors(mockVendorRows, mockToken, mockBaseUrl)

      expect(failedRows).toEqual([])
      expect(createdVendors).toEqual([])
      expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
    })
    it('should return failed rows and correctly log errors', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 400, getContentText: () => "Error"},
        { getResponseCode: () => 500, getContentText: () => "Error"},
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({Item: {Name: 'mockVendor3', City: 'mockCity', Category: 'VendorCategory2'}}))}
      ])
      const {failedRows, createdVendors} = gLib._createVendors(mockVendorRows, mockToken, mockBaseUrl)
      expect(failedRows).toEqual([2,3])
      expect(createdVendors).toHaveLength(1)
      expect(mockLogger.log).nthCalledWith(1, 'Row 2: Vendor "mockVendor1" failed with status code 400. Error: Error')
      expect(mockLogger.log).nthCalledWith(2, 'Row 3: Vendor "mockVendor2" failed with status code 500. Error: Error')
      expect(mockLogger.log).nthCalledWith(3, 'Row 4: Vendor with name "mockVendor3" successfully created')

    })
    it('should return created vendors and log success', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({Item: {Name: 'mockVendor1', City: 'mockCity', Category: 'VendorCategory1'}}))},
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({Item: {Name: 'mockVendor2', City: 'mockCity', Category: 'VendorCategory1'}}))},
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({Item: {Name: 'mockVendor3', City: 'mockCity', Category: 'VendorCategory2'}}))}
      ])
      const {failedRows, createdVendors} = gLib._createVendors(mockVendorRows, mockToken, mockBaseUrl)
      expect(failedRows).toHaveLength(0)
      expect(createdVendors).toHaveLength(3)
      expect(mockLogger.log).nthCalledWith(1, 'Row 2: Vendor with name "mockVendor1" successfully created')
      expect(mockLogger.log).nthCalledWith(2, 'Row 3: Vendor with name "mockVendor2" successfully created')
      expect(mockLogger.log).nthCalledWith(3, 'Row 4: Vendor with name "mockVendor3" successfully created')
    })
    it('should call getOrganization() when vendor already exists in the database', () => {
      gLib.getOrganization = vi.fn(() => [
        {Name: 'mockVendor1'},
        {Name: 'mockVendor2'},
      ])
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 409 },
        { getResponseCode: () => 200 },
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({Item: {Name: 'mockVendor3', City: 'mockCity', Category: 'VendorCategory2'}}))}
      ])
      const expectedQuery = `?$filter=EstimateREF eq 00000000-0000-0000-0000-000000000000 and ((Name eq 'mockVendor1' and City eq 'mockCity') or (Name eq 'mockVendor2' and City eq 'mockCity'))`
      
      const {failedRows, createdVendors} = gLib._createVendors(mockVendorRows, mockToken, mockBaseUrl)
      
      expect(failedRows).toEqual([])
      expect(createdVendors).toContainEqual(
        {Name: 'mockVendor1'}
      )
      expect(mockLogger.log).nthCalledWith(1, 'Row 2: Vendor with name "mockVendor1" already exists')
      expect(mockLogger.log).nthCalledWith(2, 'Row 3: Vendor with name "mockVendor2" already exists')
      expect(mockLogger.log).nthCalledWith(3, 'Row 4: Vendor with name "mockVendor3" successfully created')
      expect(gLib.getOrganization).toHaveBeenCalledWith('Vendor', mockToken, mockBaseUrl, expectedQuery)
    })
  })
  describe('_createVendorCategories', () => {
    beforeAll(() => {
      gLib.getDBCategoryList = vi.fn()
    })
    const mockVendorCategories = ['cat1', 'cat2', 'cat3']
    it('returns empty categories when an empty array is passed to it', () => {
      const {failedVendorCategories, createdVendorCategores} = gLib._createVendorCategories([], mockToken, mockBaseUrl)
      expect(failedVendorCategories).toEqual([])
      expect(createdVendorCategores).toEqual([])
      expect(mockUrlFetchApp.fetchAll).not.toHaveBeenCalled()
    })
    it('returns failed categories when response codes are errors and logs the errors properly', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 400, getContentText: () => "Error"},
        { getResponseCode: () => 500, getContentText: () => 'Error'},
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({ Item: 'Cat3Response Object'}))}
      ])
      const {failedVendorCategories, createdVendorCategores} = gLib._createVendorCategories(mockVendorCategories, mockToken, mockBaseUrl)

      expect(failedVendorCategories).toEqual(['cat1', 'cat2'])
      expect(createdVendorCategores).toEqual(['Cat3Response Object'])
      expect(mockLogger.log).nthCalledWith(1, 'Vendor Category: "cat1" failed to create with status code 400. Error: Error')
      expect(mockLogger.log).nthCalledWith(2, 'Vendor Category: "cat2" failed to create with status code 500. Error: Error')
      expect(mockLogger.log).nthCalledWith(3, 'Vendor Category: "cat3" successfully created')
    })
    it('returns no failed categories when response is 409 and fetches pre-existing categories', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 409 },
        { getResponseCode: () => 200 },
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({ Item: 'Cat3Response Object'}))}
      ])
      gLib.getDBCategoryList.mockReturnValue(['Cat1Response Object', 'Cat2Response Object'])
      
      const {failedVendorCategories, createdVendorCategores} = gLib._createVendorCategories(mockVendorCategories, mockToken, mockBaseUrl)

      expect(failedVendorCategories).toEqual([])
      expect(createdVendorCategores).toEqual(['Cat3Response Object', 'Cat1Response Object', 'Cat2Response Object'])
      const expectedQuery = "?$filter=EstimateREF eq 00000000-0000-0000-0000-000000000000 and (Name eq 'cat1' or Name eq 'cat2')"
      expect(gLib.getDBCategoryList).toHaveBeenCalledWith('VendorCategory', mockToken, mockBaseUrl, expectedQuery)
      expect(mockLogger.log).nthCalledWith(1, 'Vendor Category: "cat1" already existed in the database.')
      expect(mockLogger.log).nthCalledWith(2, 'Vendor Category: "cat2" already existed in the database.')
      expect(mockLogger.log).nthCalledWith(3, 'Vendor Category: "cat3" successfully created')
    })
    it('returns with all successfully created vendor categories', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({ Item: 'Cat1Response Object'}))},
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({ Item: 'Cat2Response Object'}))},
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({ Item: 'Cat3Response Object'}))}
      ])
      const {failedVendorCategories, createdVendorCategores } = gLib._createVendorCategories(mockVendorCategories, mockToken, mockBaseUrl)

      expect(failedVendorCategories).toEqual([])
      expect(createdVendorCategores).toEqual(['Cat1Response Object', 'Cat2Response Object', 'Cat3Response Object'])
      expect(mockLogger.log).nthCalledWith(1, 'Vendor Category: "cat1" successfully created')
      expect(mockLogger.log).nthCalledWith(2, 'Vendor Category: "cat2" successfully created')
      expect(mockLogger.log).nthCalledWith(3, 'Vendor Category: "cat3" successfully created')
    })
  })
  describe('CreateVendors', () => {
    beforeAll(() => {
      gLib.authenticate = vi.fn(() => ({token: mockToken, baseUrl: mockBaseUrl}))
      gLib.getSpreadSheetData = vi.fn()
      gLib._createVendorCategories = vi.fn(() => ({failedVendorCategories: []}))
      gLib._createVendors = vi.fn()
      gLib.getDBCategoryList = vi.fn(() => [])
      gLib.getDBSubcategoryList = vi.fn(() => [])
      gLib._addVendorMaterialCategories = vi.fn(() => [])
    })
    it('exits early when there is no data to send', () => {
      gLib.getSpreadSheetData.mockReturnValue([])

      gLib.CreateVendors()
      expect(mockLogger.log).toHaveBeenCalledWith("CreateVendors() failed to run because there was no data to send.")
      expect(mockUi.alert).toHaveBeenCalledWith('No data to send!')
      expect(gLib._createVendorCategories).not.toHaveBeenCalled()
    })
    it('correctly calls _createVendorCategories when there are vendor categories to create', () => {
      gLib.getSpreadSheetData.mockReturnValue([
        {Name: 'mockVendor1',City: 'mockCity1', 'Vendor Category': 'VendorCategory1'},
        { Name: 'mockVendor2', City: 'mockCity2', 'Vendor Category': 'VendorCategory2'},
        { Name: 'mockVendor3', City: 'mockCity3', 'Vendor Category': 'VendorCategory1'}  ])
      gLib._createVendors.mockReturnValue({ failedRows: [], createdVendors: []})
      gLib.CreateVendors()
      expect(gLib._createVendorCategories).toHaveBeenCalledWith(['VendorCategory1', 'VendorCategory2'], mockToken, mockBaseUrl)
      expect(mockUi.alert).toHaveBeenCalledWith('All rows were created successfully.')
    })
    it('throws an error when _createVendorCategories returns with failed categories', () => {
      gLib.getSpreadSheetData.mockReturnValue([
        { Name: 'mockVendor1', City: 'mockCity1', 'Vendor Category': 'VendorCategory1'},
        { Name: 'mockVendor2', City: 'mockCity2', 'Vendor Category': 'VendorCategory2'},
        { Name: 'mockVendor3', City: 'mockCity3', 'Vendor Category': 'VendorCategory1'}  ])
      gLib._createVendorCategories.mockReturnValue(['VendorCategory1', 'VendorCategory2'])

      expect(() => gLib.CreateVendors()).toThrow('Script failed while creating the following vendor categories: VendorCategory1, VendorCategory2')
      expect(gLib._createVendors).not.toHaveBeenCalled()
    })
    it('alerts the user of failed rows and highlights them in red', () => {
      
    })
  })
})
