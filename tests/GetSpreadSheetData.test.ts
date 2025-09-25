import gas from 'gas-local';
import { vi, beforeEach, expect, describe, it } from 'vitest'
import { mockSpreadsheetApp, mockUrlFetchApp, mockLogger, mockSpreadsheet, mockRange} from './mocks';

const mocks = {
  SpreadsheetApp: mockSpreadsheetApp,
  UrlFetchApp: mockUrlFetchApp,
  Logger: mockLogger,
  // __proto__: gas.globalMockDefaults
}

const glib = gas.require('./dist', mocks)

describe("GetSpreadSheetData", () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })
    it('throws and error if spreadsheetName could not be found', () => {
      mockSpreadsheet.getSheetByName.mockImplementation(() => null)
      expect(() => glib.getSpreadSheetData("Test")).toThrow(/^Could not find spreadsheet: "Test"$/)
    })
    it('returns properly formatted data for JCIDS', () => {
      const mockData = [
        ['Description', 'Code'],
        ['Desc1', 'Code1'],
        ['Desc2', 'Code2'],
        ['Desc3', 'Code3'],
        ['Desc4', 'Code4']
      ]
      const expectedData = [
        {Description: 'Desc1', Code: 'Code1'},
        {Description: 'Desc2', Code: 'Code2'},
        {Description: 'Desc3', Code: 'Code3'},
        {Description: 'Desc4', Code: 'Code4'},
      ]
      mockRange.getValues.mockReturnValue(mockData)
      const returnData = glib.getSpreadSheetData('Test')
      expect(returnData).toEqual(expectedData)
    })
    it('returns properly formatted data for Customers (with empty columns)', () => {
      const mockData = [
        ['Name', 'Address1', 'Address2', 'City', 'State', 'Zip', 'Category'],
        ['Cust1', 'Cust1Address1', '', 'Cust1City', 'Cust1State', '', ''],
        ['Cust2', '','', 'Cust2City', 'Cust2State', '', 'Cust2Category'],
        ['Cust3', 'Cust3Address1', 'Cust3Address2', 'Cust3City', 'Cust3State', 'Cust3Zip', 'Cust3Category']
      ]
      const expectedData = [
        { Name: 'Cust1', Address1: 'Cust1Address1', Address2: '', City: 'Cust1City', State: 'Cust1State', Zip: '', Category: ''},
        { Name: 'Cust2', Address1: '', Address2: '', City: 'Cust2City', State: 'Cust2State', Zip: '', Category: 'Cust2Category'},
        { Name: 'Cust3', Address1: 'Cust3Address1', Address2: 'Cust3Address2', City: 'Cust3City', State: 'Cust3State', Zip: 'Cust3Zip', Category: 'Cust3Category'}
      ]
      mockRange.getValues.mockReturnValue(mockData)
      const returnData = glib.getSpreadSheetData('Test')
      expect(returnData).toEqual(expectedData)
    })
    it('trimp whitespace for strings', () => {
      const mockData = [
        ['Description', 'Code'],
        ['Desc1', 'Code1      '],
        ['       Desc2', 1234]
      ]
      const expectedData = [
        {Description: "Desc1", Code: 'Code1'},
        {Description: 'Desc2', Code: 1234}
      ]
      mockRange.getValues.mockReturnValue(mockData)
      const returnData = glib.getSpreadSheetData("Test")
      expect(returnData).toEqual(expectedData)
    })
})
