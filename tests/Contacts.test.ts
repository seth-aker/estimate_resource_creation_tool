import { vi, describe, it, beforeEach, expect, beforeAll} from 'vitest'
import { gasRequire } from 'tgas-local'
import { mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUi, mockUrlFetchApp, mockUtilities } from './mocks'

const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger,
    PropertiesService: mockPropertiesService,
    Utilities: mockUtilities
}
const gLib = gasRequire('./src', mocks)

describe('Contacts', () => {
  const mockToken = 'mockToken'
  const mockBaseUrl = 'https://mock.com'
  const mockRow1 = {
    Name: 'mockContact1',
    Organization: 'mockOrg1, mockCity1',
    'Organization Type': 'Customer',
    Email: 'email1'
  }
  const mockRow2 = {
    Name: 'mockContact2',
    Organization: 'mockOrg2, mockCity2',
    "Organization Type": 'Subcontractor',
    Email: 'email2'
  }
  const mockRow3 = {
    Name: 'mockContact3',
    Organization: 'mockOrg3, mockCity3',
    'Organization Type': 'Vendor',
    Email: 'email3'
  }
  const mockOrg1 = {
    Name: 'mockOrg1',
    City: 'mockCity1',
    ObjectID: 'orgREF1',
    Type: 'Customer' as const
  }
  const mockOrg2 = {
    Name: 'mockOrg2',
    City: 'mockCity2',
    ObjectID: 'orgREF2',
    Type: 'Subcontractor' as const
  }
  const mockOrg3 = {
    Name: 'mockOrg3',
    City: 'mockCity3',
    ObjectID: 'orgREF3',
    Type: 'Vendor' as const
  }
  const mockContactDTO1 = {
    Name: 'mockContact1',
    OrganizationREF: 'orgREF1',
    Email: 'email1'
  }
  const mockContactDTO2 = {
    Name: 'mockContact2',
    OrganizationREF: 'orgREF2',
    Email: 'email2'
  }
  const mockContactDTO3 = {
    Name: 'mockContact3',
    OrganizationREF: 'orgREF3',
    Email: 'email3'
  }
  beforeEach(() => {
    vi.resetAllMocks()
  })
  describe('_createQuery', () => {
    it('correctly creates a query to find one org', () => {
      const expected = "?$filter=EstimateREF eq 00000000-0000-0000-0000-000000000000 and ((Name eq 'mockOrg1' and City eq 'mockCity1'))"
      const actual = gLib._createQuery([mockOrg1])
      expect(actual).toEqual(expected)
    })
    it('correctly creates a query for multiple orgs', () => {
      const expected = "?$filter=EstimateREF eq 00000000-0000-0000-0000-000000000000 and ((Name eq 'mockOrg1' and City eq 'mockCity1') or (Name eq 'mockOrg2' and City eq 'mockCity2'))"
      const actual = gLib._createQuery([mockOrg1, mockOrg2])
      expect(actual).toEqual(expected) 
    })
  })
  describe('_createContacts', () => {
    it('returns proper failed rows when UrlFetchApp returns 400 errors', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 400, getContentText: () => 'Error' },
        { getResponseCode: () => 500, getContentText: () => 'Error' },
        { getResponseCode: () => 404, getContentText: () => 'Error' }
      ])

      const failedRows = gLib._createContacts([mockContactDTO1, mockContactDTO2, mockContactDTO3], mockToken, mockBaseUrl)
      expect(failedRows).toEqual([2,3,4])
      expect(mockLogger.log).nthCalledWith(1, 'An error occured creating contact: "mockContact1". Error: Error')
      expect(mockLogger.log).nthCalledWith(2, 'An error occured creating contact: "mockContact2". Error: Error')
      expect(mockLogger.log).nthCalledWith(3, 'An error occured creating contact: "mockContact3". Error: Error')
    })
    it('returns no failures when the UrlFetchApp does not return with error code', () => {
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 409, getContentText: () => 'Error' },
        { getResponseCode: () => 201, getContentText: () => 'Error' },
        { getResponseCode: () => 200, getContentText: () => 'Error' }
      ])
      const failedRows = gLib._createContacts([mockContactDTO1, mockContactDTO2, mockContactDTO3], mockToken, mockBaseUrl)
      expect(failedRows).toEqual([])
      expect(mockLogger.log).nthCalledWith(1, 'Contact "mockContact1" already exists on resource with id: "orgREF1"')
      expect(mockLogger.log).nthCalledWith(2, 'Contact "mockContact2" created successfully')
      expect(mockLogger.log).nthCalledWith(3, 'Contact "mockContact3" already exists on resource with id: "orgREF3"')
    })
  })
  describe('CreateContacts', () => {
    const mockAuthenticate = vi.fn(() => ({ token: mockToken, baseUrl: mockBaseUrl}))
    const mockGetSpreadSheetData = vi.fn()
    const mockGetOrganization = vi.fn((orgType: string, ..._: any) => {
      switch (orgType) {
        case 'Customer':
          return [mockOrg1]
        case 'Subcontractor':
          return [mockOrg2]
        default:
          return [mockOrg3]
      }
    })
    const mockHighlightRows = vi.fn()
    const mockCreateContacts = vi.fn(() => [] as any[])
    beforeAll(() => {
      gLib.authenticate = mockAuthenticate
      gLib.getSpreadSheetData = mockGetSpreadSheetData
      gLib.getOrganization = mockGetOrganization
      gLib.highlightRows = mockHighlightRows
      gLib._createContacts = mockCreateContacts
    })
    it('exits early when there are no rows returned from getSpreadSheetData', () => {
      mockGetSpreadSheetData.mockReturnValue([])
      gLib.CreateContacts()
      expect(mockLogger.log).toHaveBeenCalledWith("CreateContacts() failed to run because there was no data to send.")
      expect(mockUi.alert).toHaveBeenCalledWith('No data to send!')
      expect(gLib.getOrganization).not.toHaveBeenCalled()
    })
    it('correctly calls getOrganziation with the correct queries.', () => {
      mockGetSpreadSheetData.mockReturnValue([mockRow1])
      const expectedGetOrgQuery = "?$filter=EstimateREF eq 00000000-0000-0000-0000-000000000000 and ((Name eq 'mockOrg1' and City eq 'mockCity1'))"
      gLib.CreateContacts()
      expect(gLib.getOrganization).nthCalledWith(1, 'Customer', mockToken, mockBaseUrl, expectedGetOrgQuery)
      expect(gLib._createContacts).toHaveBeenCalledWith([mockContactDTO1], mockToken, mockBaseUrl)
      expect(mockUi.alert).toHaveBeenCalledWith('All contacts created successfully')
    })
    it('correctly calls getOrganization the correct number of times', () => {
      mockGetSpreadSheetData.mockReturnValue([mockRow1, mockRow2, mockRow3])
      const expectedQuery1 = "?$filter=EstimateREF eq 00000000-0000-0000-0000-000000000000 and ((Name eq 'mockOrg1' and City eq 'mockCity1'))"
      const expectedQuery2 = "?$filter=EstimateREF eq 00000000-0000-0000-0000-000000000000 and ((Name eq 'mockOrg2' and City eq 'mockCity2'))"
      const expectedQuery3 = "?$filter=EstimateREF eq 00000000-0000-0000-0000-000000000000 and ((Name eq 'mockOrg3' and City eq 'mockCity3'))"
      gLib.CreateContacts()
      expect(gLib.getOrganization).nthCalledWith(1, 'Customer', mockToken, mockBaseUrl, expectedQuery1)
      expect(gLib.getOrganization).nthCalledWith(2, 'Subcontractor', mockToken, mockBaseUrl, expectedQuery2)
      expect(gLib.getOrganization).nthCalledWith(3, 'Vendor', mockToken, mockBaseUrl, expectedQuery3)
      expect(gLib._createContacts).toHaveBeenCalledWith([mockContactDTO1, mockContactDTO2, mockContactDTO3], mockToken, mockBaseUrl)
    })
    it('correctly logs errors from _createContacts when rows fail.', () => {
      mockGetSpreadSheetData.mockReturnValue([mockRow1, mockRow2, mockRow3])
      mockCreateContacts.mockReturnValue([2,3,4])
      gLib.CreateContacts()
      expect(gLib.highlightRows).toHaveBeenCalledWith([2,3,4], 'red')
      expect(mockUi.alert).toHaveBeenCalledWith('Some contacts failed to be created at rows: 2, 3, 4')
    })
  })
})
