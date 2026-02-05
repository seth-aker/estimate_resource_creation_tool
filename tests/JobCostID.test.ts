import { gasRequire } from 'tgas-local'
import { vi, beforeEach, expect, describe, it } from 'vitest'
import { mockSpreadsheetApp, mockUrlFetchApp, mockUi, mockLogger, mockAuthenticate, mockRange, mockSheet, mockPropertiesService, mockUtilities, mockHtmlService, mockCacheService } from './mocks';
const mockFetchWithRetries = vi.fn();
const mockBatchFetch = vi.fn();
const mockBuildUpdateQuery = vi.fn();
const mockGetSpreadSheetData = vi.fn();
const mockGetJCIDS = vi.fn();
const mockHighlightRows = vi.fn()

const mocks = {
  SpreadsheetApp: mockSpreadsheetApp,
  UrlFetchApp: mockUrlFetchApp,
  Logger: mockLogger,
  PropertiesService: mockPropertiesService,
  Utilities: mockUtilities,
  HtmlService: mockHtmlService,
  CacheService: mockCacheService
  // __proto__: gas.globalMockDefaults
}
const mockToken = "mockToken"
const mockBaseUrl = "https://mockUrl.com"
const mockQuery = "?mockQuery"
const glib = gasRequire('./src', mocks)
describe('JobCostID tests', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    glib.authenticate = mockAuthenticate
    glib.fetchWithRetries = mockFetchWithRetries
  })
  describe('CreateJCIDS', () => {

    it('exits early if getSpreadSheetData returns with no data', () => {
      glib.getSpreadSheetData = vi.fn(() => [])
      glib.CreateJCIDS()
      expect(glib.getSpreadSheetData).toHaveBeenCalledOnce();
      expect(mockAuthenticate).toHaveBeenCalledOnce();
      expect(mocks.Logger.log).toHaveBeenCalledOnce();
      expect(mocks.Logger.log).toHaveBeenCalledWith("No data to send!");
      expect(mockSpreadsheetApp.getUi).toHaveBeenCalled();
      expect(mockUi.alert).toHaveBeenCalledExactlyOnceWith("No data to send!");
      expect(mockUrlFetchApp.fetch).not.toHaveBeenCalled();
    })
    it('alerts the user all records were created when UrlFetchApp returns with no errors', () => {
      (glib.getSpreadSheetData as any) = vi.fn(() => [
        {Description: 'Dummy data1', Code: 'moreDummyData'},
        {Description: 'Dummy data2', Code: 'moreDummyData2'}
      ])
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 201, getContentText: () => '' },
        { getResponseCode: () => 201, getContentText: () => '' }
      ])
      glib.CreateJCIDS()
      
      expect(mocks.Logger.log).toHaveBeenCalledTimes(2)
      expect(mocks.Logger.log).nthCalledWith(1, 'Row 2: Successfully created')
      expect(mocks.Logger.log).nthCalledWith(2, 'Row 3: Successfully created')
      expect(mockUi.alert).toHaveBeenCalledWith('All records were created successfully!')
    })
    it('logs rows with error codes, modifies the row background color and alerts the user some rows failed', () => {
      (glib.getSpreadSheetData as any) = vi.fn(() => [
        {Description: 'Dummy data1', Code: 'moreDummyData'},
        {Description: 'Dummy data2', Code: 'moreDummyData2'}
      ])
      mockUrlFetchApp.fetchAll.mockReturnValue([
        { getResponseCode: () => 400, getContentText: () => 'Error' },
        { getResponseCode: () => 201, getContentText: () => '' }
      ])
      glib.CreateJCIDS()

      expect(mocks.Logger.log).toHaveBeenCalledTimes(2)
      expect(mocks.Logger.log).nthCalledWith(1, 'Row 2: Failed with status code 400. Error: Error')
      expect(mocks.Logger.log).nthCalledWith(2, 'Row 3: Successfully created')
      expect(mockSheet.getRange).toHaveBeenCalledWith(2, 1,1, undefined)
      expect(mockRange.setBackground).toHaveBeenCalledWith('red')
      expect(mockUi.alert).toHaveBeenCalledWith(`Some records failed to create or already existed in the database.
      Pre-existing rows: []
      Failed rows: [2]`)
    })
  })
  describe("buildUpdateQuery", () => {
    it("should return filter by Description when update-JCID-code is the update type", () => {
      const updateType = "update-JCID-code";
      const mockItems: IJobCostID[] = [
        {Description: "Desc1", Code: "Code1"},
        {Description: "Desc2", Code: "Code2"}
      ]
      const query = glib.buildUpdateQuery(updateType, mockItems);

      expect(query).toEqual(`?$filter=EstimateREF eq ${glib.ESTIMATE_REF} and (Name eq 'Desc1' or Name eq 'Desc2')`)
    })
    it("should return filter by Code when update-JCID-desc is the update type", () => {
      const updateType = "update-JCID-desc";
      const mockItems: IJobCostID[] = [
        {Description: "Desc1", Code: "Code1"},
        {Description: "Desc2", Code: "Code2"}
      ]
      const query = glib.buildUpdateQuery(updateType, mockItems);

      expect(query).toEqual(`?$filter=EstimateREF eq ${glib.ESTIMATE_REF} and (Code eq 'Code1' or Code eq 'Code2')`)
    })
  })
  describe("getJCIDS", () => {
    it('should throw an error if response code is not 200', () => {
      mockFetchWithRetries.mockReturnValue({
        getResponseCode: () => 400,
        getContentText: () => "mockError"
      })

      expect(() => glib.getJCIDS(mockBaseUrl, mockQuery, mockToken)).toThrow();
      expect(mockLogger.log).toHaveBeenCalledWith("An error occured fetching JCID resources: mockError")
    })
    it('should return correct amount of items when there is no pagination', () => {
      const responseItems: IJobCostID[] = [
          {Description: "Desc1", Code: "Code1"},
          {Description: "Desc2", Code: "Code2"},
          {Description: "Desc3", Code: "Code3"}
        ]
      const responseContent = {
        Items: responseItems,
        Pagination: {
          CurrentPage: 'page',
          ItemsOnPage: 3,
          PageSize: 100,
          TotalItems: 3
        }
      }
      const mockRes = {
        getContentText: () => JSON.stringify(responseContent),
        getResponseCode: () => 200
      }
      mockFetchWithRetries.mockReturnValue(mockRes)
      const response = glib.getJCIDS(mockBaseUrl, mockQuery, mockToken);
      expect(response.length === 3);
      expect(mockFetchWithRetries).toHaveBeenCalledOnce();
      expect(response).toEqual(responseItems)
    })
    it('should correctly call recursively call getJCIDS when Pagination.NextPage exists', () => {
      const page1 = {
        Items: [
          {Description: "Desc1", Code: "Code1"},
          {Description: "Desc2", Code: "Code2"}
        ],
        Pagination: {
          CurrentPage: "page1",
          ItemsOnPage: 2,
          NextPage: `${mockBaseUrl}?nextPage`,
          PageSize: 2,
          TotalItems: 4
        }
      }
      const page2 = {
        Items: [
          {Description: "Desc3", Code: "Code3"},
          {Description: "Desc4", Code: "Code4"}
        ],
        Pagination: {
          CurrentPage: "page2",
          ItemsOnPage: 2,
          PageSize: 2,
          TotalItems: 4
        }
      }
      mockFetchWithRetries.mockReturnValueOnce({getContentText: () => JSON.stringify(page1), getResponseCode: () => 200})
      mockFetchWithRetries.mockReturnValueOnce({getContentText: () => JSON.stringify(page2), getResponseCode: () => 200})
      const returnItems = glib.getJCIDS(mockBaseUrl, mockQuery, mockToken);
      expect(returnItems).toEqual([...page1.Items, ...page2.Items])
      expect(mockFetchWithRetries).toHaveBeenCalledTimes(2);
    })
  })
  describe("UpdateJCIDS", () => {
    beforeEach(() => {
      glib.getSpreadSheetData = mockGetSpreadSheetData;
      glib.batchFetch = mockBatchFetch;
      glib.getJCIDS = mockGetJCIDS;
      glib.buildUpdateQuery = mockBuildUpdateQuery;
      glib.highlightRows = mockHighlightRows
    })
    it("correctly modifies the code when 'update-JCID-code' is passed to UpdateJCIDS", () => {
      const updateData = [
        {Description: "Desc1", Code: "NewCode1"},
        {Description: "Desc2", Code: "NewCode2"},
        {Description: "Desc3", Code: "NewCode3"},
      ]
      mockGetSpreadSheetData.mockReturnValue(updateData)

      mockBuildUpdateQuery.mockReturnValue("?query")
      mockGetJCIDS.mockReturnValue([
        {Description: "Desc1", Code: "OldCode1"},
        {Description: "Desc2", Code: "OldCode2"},
        {Description: "Desc3", Code: "OldCode3"},
      ])
      mockBatchFetch.mockReturnValue([
        {getContentText: () => "No content", getResponseCode: () => 200 },
        {getContentText: () => "No content", getResponseCode: () => 200 },
        {getContentText: () => "No content", getResponseCode: () => 200 }
      ])
      const expectedBatchFetchArgs = updateData.map((each) => ({
        url: mockBaseUrl + "/Resource/JobCostID",
        headers: glib.createHeaders(mockToken),
        method: 'put' as const,
        payload: JSON.stringify(each),
        muteHttpExceptions: true
      }))
      glib.UpdateJCIDS('update-JCID-code');
      expect(mockBatchFetch).toHaveBeenCalledWith(expectedBatchFetchArgs);
      expect(mockLogger.log).toHaveBeenCalledTimes(3);
      expect(mockUi.alert).toHaveBeenCalledWith("All JCIDs updated successfully")
    })
    it("correctly modifies the description when 'update-JCID-Desc' is passed to UpdateJCIDS", () => {
      const updateData = [
        {Description: "NewDesc1", Code: "Code1"},
        {Description: "NewDesc2", Code: "Code2"},
        {Description: "NewDesc3", Code: "Code3"},
      ]
      mockGetSpreadSheetData.mockReturnValue(updateData)

      mockBuildUpdateQuery.mockReturnValue("?query")
      mockGetJCIDS.mockReturnValue([
        {Description: "OldDesc1", Code: "Code1"},
        {Description: "OldDesc2", Code: "Code2"},
        {Description: "OldDesc3", Code: "Code3"},
      ])
      mockBatchFetch.mockReturnValue([
        {getContentText: () => "No content", getResponseCode: () => 200 },
        {getContentText: () => "No content", getResponseCode: () => 200 },
        {getContentText: () => "No content", getResponseCode: () => 200 }
      ])
      const expectedBatchFetchArgs = updateData.map((each) => ({
        url: mockBaseUrl + "/Resource/JobCostID",
        headers: glib.createHeaders(mockToken),
        method: 'put' as const,
        payload: JSON.stringify(each),
        muteHttpExceptions: true
      }))
      glib.UpdateJCIDS('update-JCID-desc');
      expect(mockBatchFetch).toHaveBeenCalledWith(expectedBatchFetchArgs);
      expect(mockLogger.log).toHaveBeenCalledTimes(3);
      expect(mockUi.alert).toHaveBeenCalledWith("All JCIDs updated successfully")
    })
    it('correctly logs errors when rows fail', () => {
      const updateData = [
        {Description: "NewDesc1", Code: "Code1"},
        {Description: "NewDesc2", Code: "Code2"},
        {Description: "NewDesc3", Code: "Code3"},
      ]
      mockGetSpreadSheetData.mockReturnValue(updateData)
      mockBuildUpdateQuery.mockReturnValue("?query")
      mockGetJCIDS.mockReturnValue([
        {Description: "OldDesc1", Code: "Code1"},
        {Description: "OldDesc2", Code: "Code2"},
        {Description: "OldDesc3", Code: "Code3"},
      ])
      mockBatchFetch.mockReturnValue([
        {getContentText: () => "Error", getResponseCode: () => 400 },
        {getContentText: () => "Error", getResponseCode: () => 400 },
        {getContentText: () => "Error", getResponseCode: () => 400 }
      ])
      glib.UpdateJCIDS('update-JCID-desc')
      expect(mockHighlightRows).toHaveBeenCalledWith([2,3,4], 'red')
      expect(mockUi.alert).toHaveBeenCalledWith(`Some rows failed to update: [2, 3, 4]`)
    })
  })
})
  