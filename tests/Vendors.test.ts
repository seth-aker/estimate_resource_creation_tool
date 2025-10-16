import { vi, describe, it, beforeEach, expect} from 'vitest'
import gas from 'gas-local'
import { mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUrlFetchApp } from './mocks'

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
})
