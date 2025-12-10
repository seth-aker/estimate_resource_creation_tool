import { vi, describe, it, beforeEach, expect, beforeAll} from 'vitest'
import { gasRequire } from 'tgas-local'
import { mockCacheService, mockHtmlService, mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUi, mockUrlFetchApp, mockUtilities } from './mocks'

// const mockGetDBCategoryList = vi.fn()
// const mockGetDBSubcategoryList = vi.fn()
// const mockGetOrganization = vi.fn()
const mockToken = 'mockToken'
const mockBaseUrl = 'https://mock.com'
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
        { getResponseCode: () => 201, getContentText: () => '' }
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
        { getResponseCode: () => 409, getContentText: () => '' },
        { getResponseCode: () => 200, getContentText: () => '' },
        { getResponseCode: () => 201, getContentText: () => '' }
      ])
      const failedCategories = gLib._addVendorMaterialCategories(mockPayloads, false, mockToken, mockBaseUrl)
      expect(failedCategories).toEqual([])
      expect(mockLogger.log).nthCalledWith(1, 'Vendor with id: mockOrgREF already has material category with id: matREF1 attached.')
      expect(mockLogger.log).nthCalledWith(2, 'Vendor with id: mockOrgREF already has material category with id: matREF2 attached.')
    })
    it('correctly logs categories added to vendor', () => {
        mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 201, getContentText: () => '' },
        { getResponseCode: () => 201, getContentText: () => '' },
        { getResponseCode: () => 201, getContentText: () => '' }
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
        { getResponseCode: () => 409, getContentText: () => '' },
        { getResponseCode: () => 201, getContentText: () => '' }
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
        {Name: 'mockVendor1', City: 'mockCity1'},
        {Name: 'mockVendor2', City: 'MockCity'},
      ])
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 409, getContentText: () => '' },
        { getResponseCode: () => 200, getContentText: () => '' },
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({Item: {Name: 'mockVendor3', City: 'mockCity', Category: 'VendorCategory2'}}))}
      ])
      const expectedQuery = `?$filter=EstimateREF eq 00000000-0000-0000-0000-000000000000 and ((Name eq 'mockVendor1' and City eq 'mockCity') or (Name eq 'mockVendor2' and City eq 'mockCity'))`
      
      const {failedRows, createdVendors} = gLib._createVendors(mockVendorRows, mockToken, mockBaseUrl)
      
      expect(failedRows).toEqual([])
      expect(createdVendors).toContainEqual(
        {Name: 'mockVendor1', City: "mockCity1"}
      )
      expect(mockLogger.log).nthCalledWith(1, 'Row 2: Vendor with name "mockVendor1" already exists')
      expect(mockLogger.log).nthCalledWith(2, 'Row 3: Vendor with name "mockVendor2" already exists')
      expect(mockLogger.log).nthCalledWith(3, 'Row 4: Vendor with name "mockVendor3" successfully created')
      expect(gLib.getOrganization).toHaveBeenCalledWith('Vendor', mockToken, mockBaseUrl, expectedQuery)
    })
  })
  describe('_createVendorCategories', () => {
    const mockGetDBCategoryList = vi.fn()
    beforeAll(() => {
      gLib.getDBCategoryList = mockGetDBCategoryList
    })
    const mockVendorCategories = ['cat1', 'cat2', 'cat3']
    it('returns empty categories when an empty array is passed to it', () => {
      const {failedVendorCategories, createdVendorCategories} = gLib._createVendorCategories([], mockToken, mockBaseUrl)
      expect(failedVendorCategories).toEqual([])
      expect(createdVendorCategories).toEqual([])
      expect(mockUrlFetchApp.fetchAll).not.toHaveBeenCalled()
    })
    it('returns failed categories when response codes are errors and logs the errors properly', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 400, getContentText: () => "Error"},
        { getResponseCode: () => 500, getContentText: () => 'Error'},
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({ Item: 'Cat3Response Object'}))}
      ])
      const {failedVendorCategories, createdVendorCategories} = gLib._createVendorCategories(mockVendorCategories, mockToken, mockBaseUrl)

      expect(failedVendorCategories).toEqual(['cat1', 'cat2'])
      expect(createdVendorCategories).toEqual(['Cat3Response Object'])
      expect(mockLogger.log).nthCalledWith(1, 'Vendor Category: "cat1" failed to create with status code 400. Error: Error')
      expect(mockLogger.log).nthCalledWith(2, 'Vendor Category: "cat2" failed to create with status code 500. Error: Error')
      expect(mockLogger.log).nthCalledWith(3, 'Vendor Category: "cat3" successfully created')
    })
    it('returns no failed categories when response is 409 and fetches pre-existing categories', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 409, getContentText: () => '' },
        { getResponseCode: () => 200, getContentText: () => '' },
        { getResponseCode: () => 201, getContentText: () => (JSON.stringify({ Item: 'Cat3Response Object'}))}
      ])
      
     mockGetDBCategoryList.mockReturnValue(['Cat1Response Object', 'Cat2Response Object'])
      
      const {failedVendorCategories, createdVendorCategories} = gLib._createVendorCategories(mockVendorCategories, mockToken, mockBaseUrl)

      expect(failedVendorCategories).toEqual([])
      expect(createdVendorCategories).toEqual(['Cat3Response Object', 'Cat1Response Object', 'Cat2Response Object'])
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
      const {failedVendorCategories, createdVendorCategories } = gLib._createVendorCategories(mockVendorCategories, mockToken, mockBaseUrl)

      expect(failedVendorCategories).toEqual([])
      expect(createdVendorCategories).toEqual(['Cat1Response Object', 'Cat2Response Object', 'Cat3Response Object'])
      expect(mockLogger.log).nthCalledWith(1, 'Vendor Category: "cat1" successfully created')
      expect(mockLogger.log).nthCalledWith(2, 'Vendor Category: "cat2" successfully created')
      expect(mockLogger.log).nthCalledWith(3, 'Vendor Category: "cat3" successfully created')
    })
  })
  describe('CreateVendors', () => {
    const mockAuthenticate = vi.fn(() => ({token: mockToken, baseUrl: mockBaseUrl}))
    const mockGetSpreadSheetData = vi.fn()
    const mockCreateVendorCategories =  vi.fn(() => ({failedVendorCategories: [] as string[], createdVendorCategories: [] as ICategoryItem[]}))
    const mockCreateVendors = vi.fn()
    const mockGetDBCategoryList = vi.fn(() => [] as any[])
    const mockGetDBSubcategoryList = vi.fn(() => [] as any[])
    const mockAddVendorMaterialCategories = vi.fn(() => [] as any[])
    const mockHighlightRows = vi.fn()
    beforeAll(() => {
      gLib.authenticate = mockAuthenticate
      gLib.getSpreadSheetData = mockGetSpreadSheetData
      gLib._createVendorCategories = mockCreateVendorCategories
      gLib._createVendors = mockCreateVendors
      gLib.getDBCategoryList = mockGetDBCategoryList
      gLib.getDBSubcategoryList = mockGetDBSubcategoryList
      gLib._addVendorMaterialCategories = mockAddVendorMaterialCategories
      gLib.highlightRows = mockHighlightRows
    })
    it('exits early when there is no data to send', () => {
      mockGetSpreadSheetData.mockReturnValue([])

      gLib.CreateVendors()
      expect(mockLogger.log).toHaveBeenCalledWith("CreateVendors() failed to run because there was no data to send.")
      expect(mockUi.alert).toHaveBeenCalledWith('No data to send!')
      expect(gLib._createVendorCategories).not.toHaveBeenCalled()
    })
    it('correctly calls _createVendorCategories when there are vendor categories to create', () => {
      mockGetSpreadSheetData.mockReturnValue([
        {Name: 'mockVendor1',City: 'mockCity1', 'Vendor Category': 'VendorCategory1'},
        { Name: 'mockVendor2', City: 'mockCity2', 'Vendor Category': 'VendorCategory2'},
        { Name: 'mockVendor3', City: 'mockCity3', 'Vendor Category': 'VendorCategory1'}  ])
      mockCreateVendors.mockReturnValue({ failedRows: [], createdVendors: []})
      gLib.CreateVendors()
      expect(gLib._createVendorCategories).toHaveBeenCalledWith(['VendorCategory1', 'VendorCategory2'], mockToken, mockBaseUrl)
      expect(mockUi.alert).toHaveBeenCalledWith('All rows were created successfully.')
    })
    it('throws an error when _createVendorCategories returns with failed categories', () => {
      mockGetSpreadSheetData.mockReturnValue([
        { Name: 'mockVendor1', City: 'mockCity1', 'Vendor Category': 'VendorCategory1'},
        { Name: 'mockVendor2', City: 'mockCity2', 'Vendor Category': 'VendorCategory2'},
        { Name: 'mockVendor3', City: 'mockCity3', 'Vendor Category': 'VendorCategory1'}  ])
      mockCreateVendorCategories.mockReturnValue({failedVendorCategories: ['VendorCategory1', 'VendorCategory2'], createdVendorCategories: []})

      expect(() => gLib.CreateVendors()).toThrow('Script failed while creating the following vendor categories: VendorCategory1, VendorCategory2')
      expect(gLib._createVendors).not.toHaveBeenCalled()
    })
    it('throws an error when there are failed rows and highlights them in red', () => {
      mockGetSpreadSheetData.mockReturnValue([
        { Name: 'mockVendor1', City: 'mockCity1', 'Vendor Category': 'VendorCategory1'},
        { Name: 'mockVendor2', City: 'mockCity2', 'Vendor Category': 'VendorCategory2'},
        { Name: 'mockVendor3', City: 'mockCity3', 'Vendor Category': 'VendorCategory1'}  
      ])
      mockCreateVendors.mockReturnValue({failedRows: [2,3,4], createdVendors: []})
      expect(() => gLib.CreateVendors()).toThrow('The following vendors failed to be created. Failed rows: 2, 3, 4')
      expect(gLib.highlightRows).toHaveBeenCalledWith([2,3,4], 'red')
      expect(gLib.getDBCategoryList).not.toHaveBeenCalled()
    })
    it('correctly sorts vendor material categories into their respective parent and sub categories.', () => {
      mockGetSpreadSheetData.mockReturnValue([
        { Name: 'mockVendor1', City: 'mockCity1', 'Material Categories': 'parentcat1, parentcat2, subcat1, subcat2'},
        { Name: 'mockVendor2', City: 'mockCity2', 'Material Categories': 'parentcat1, subcat3'},
        { Name: 'mockVendor3', City: 'mockCity3', 'Material Categories': 'parentcat3, parentcat4, subcat4'}  
      ])
      mockCreateVendors.mockReturnValue({failedRows: [], createdVendors: [
        { ObjectID: 'vendor1REF', Name: 'mockVendor1', City: 'mockCity1'},
        { ObjectID: 'vendor2REF', Name: 'mockVendor2', City: 'mockCity2'},
        { ObjectID: 'vendor3REF', Name: 'mockVendor3', City: 'mockCity3'},
      ]})
      mockGetDBCategoryList.mockReturnValue([
        { Name: 'parentcat1', ObjectID: 'parentCat1REF'},
        { Name: 'parentcat2', ObjectID: 'parentCat2REF'},
        { Name: 'parentcat3', ObjectID: 'parentCat3REF'},
        { Name: 'parentcat4', ObjectID: 'parentCat4REF'}
      ])
      mockGetDBSubcategoryList.mockReturnValue([
        { Name: 'subcat1', ObjectID: 'subcat1REF' },
        { Name: 'subcat2', ObjectID: 'subcat2REF' },
        { Name: 'subcat3', ObjectID: 'subcat3REF' },
        { Name: 'subcat4', ObjectID: 'subcat4REF' }
      ])
      gLib.CreateVendors()

      expect(gLib._addVendorMaterialCategories).nthCalledWith(1, [
          { OrganizationREF: 'vendor1REF', MaterialCategoryREF: 'parentCat1REF'},
          { OrganizationREF: 'vendor1REF', MaterialCategoryREF: 'parentCat2REF'},
          { OrganizationREF: 'vendor2REF', MaterialCategoryREF: 'parentCat1REF'},
          { OrganizationREF: 'vendor3REF', MaterialCategoryREF: 'parentCat3REF'},
          { OrganizationREF: 'vendor3REF', MaterialCategoryREF: 'parentCat4REF'},
        ],
        false, mockToken, mockBaseUrl  
      )
      expect(gLib._addVendorMaterialCategories).nthCalledWith(2, [
          { OrganizationREF: 'vendor1REF', MaterialSubcategoryREF: 'subcat1REF'},
          { OrganizationREF: 'vendor1REF', MaterialSubcategoryREF: 'subcat2REF'},
          { OrganizationREF: 'vendor2REF', MaterialSubcategoryREF: 'subcat3REF'},
          { OrganizationREF: 'vendor3REF', MaterialSubcategoryREF: 'subcat4REF'},
        ],
        true, mockToken, mockBaseUrl
      )
      expect(mockUi.alert).toHaveBeenCalledWith("All rows were created successfully.")
    })
    it('throws an error when _addVendorMaterialCategories returns with failed categories', () => {
      mockGetSpreadSheetData.mockReturnValue([
        { Name: 'mockVendor1', City: 'mockCity1', 'Material Categories': 'parentcat1, parentcat2, subcat1, subcat2'},
        { Name: 'mockVendor2', City: 'mockCity2', 'Material Categories': 'parentcat1, subcat3'},
        { Name: 'mockVendor3', City: 'mockCity3', 'Material Categories': 'parentcat3, parentcat4, subcat4'}  
      ])
      mockCreateVendors.mockReturnValue({failedRows: [], createdVendors: [
        { ObjectID: 'vendor1REF', Name: 'mockVendor1', City: 'mockCity1'},
        { ObjectID: 'vendor2REF', Name: 'mockVendor2', City: 'mockCity2'},
        { ObjectID: 'vendor3REF', Name: 'mockVendor3', City: 'mockCity3'},
      ]})
      mockGetDBCategoryList.mockReturnValue([
        { Name: 'parentcat1', ObjectID: 'parentCat1REF'},
        { Name: 'parentcat2', ObjectID: 'parentCat2REF'},
        { Name: 'parentcat3', ObjectID: 'parentCat3REF'},
        { Name: 'parentcat4', ObjectID: 'parentCat4REF'}
      ])
      mockAddVendorMaterialCategories.mockReturnValue([
        {OrganizationREF: 'vendor1REF', MaterialCategoryREF: 'parentCat1REF'}, 
        {OrganizationREF: 'vendor1REF', MaterialCategoryREF: 'parentCat2REF'}
      ])
      expect(() => gLib.CreateVendors()).toThrow(`The following vendors and material categories failed to be connected.\nVendor: "mockVendor1", MaterialCategory: "parentcat1"\nVendor: "mockVendor1", MaterialCategory: "parentcat2"`)
      expect(mockUi.alert).not.toHaveBeenCalled()
    })
    it('throws an error when _addVendorMaterialCategories returns with failed subcategories', () => {
      mockGetSpreadSheetData.mockReturnValue([
        { Name: 'mockVendor1', City: 'mockCity1', 'Material Categories': 'parentcat1, parentcat2, subcat1, subcat2'},
        { Name: 'mockVendor2', City: 'mockCity2', 'Material Categories': 'parentcat1, subcat3'},
        { Name: 'mockVendor3', City: 'mockCity3', 'Material Categories': 'parentcat3, parentcat4, subcat4'}  
      ])
      mockCreateVendors.mockReturnValue({failedRows: [], createdVendors: [
        { ObjectID: 'vendor1REF', Name: 'mockVendor1', City: 'mockCity1'},
        { ObjectID: 'vendor2REF', Name: 'mockVendor2', City: 'mockCity2'},
        { ObjectID: 'vendor3REF', Name: 'mockVendor3', City: 'mockCity3'},
      ]})
      mockGetDBCategoryList.mockReturnValue([
        { Name: 'parentcat1', ObjectID: 'parentCat1REF'},
        { Name: 'parentcat2', ObjectID: 'parentCat2REF'},
        { Name: 'parentcat3', ObjectID: 'parentCat3REF'},
        { Name: 'parentcat4', ObjectID: 'parentCat4REF'}
      ])
      mockGetDBSubcategoryList.mockReturnValue([
        { Name: 'subcat1', ObjectID: 'subcat1REF' },
        { Name: 'subcat2', ObjectID: 'subcat2REF' },
        { Name: 'subcat3', ObjectID: 'subcat3REF' },
        { Name: 'subcat4', ObjectID: 'subcat4REF' }
      ])
  
      mockAddVendorMaterialCategories.mockReturnValueOnce([])
      mockAddVendorMaterialCategories.mockReturnValueOnce([
        {OrganizationREF: 'vendor1REF', MaterialSubcategoryREF: 'subcat1REF'}, 
        {OrganizationREF: 'vendor1REF', MaterialSubcategoryREF: 'subcat2REF'}
      ])
      expect(() => gLib.CreateVendors()).toThrow(`The following vendors and material subcategories failed to be connected.\nVendor: "mockVendor1", MaterialSubcategory: "subcat1"\nVendor: "mockVendor1", MaterialSubcategory: "subcat2"`)
      expect(mockUi.alert).not.toHaveBeenCalled()
    })
  })
})
