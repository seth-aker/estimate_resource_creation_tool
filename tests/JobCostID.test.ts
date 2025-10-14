import gas from 'gas-local';
import { vi, beforeEach, expect, describe, it } from 'vitest'
import { mockSpreadsheetApp, mockUrlFetchApp, mockUi, mockLogger, mockAuthenticate, mockRange, mockSheet, mockPropertiesService } from './mocks';

const mocks = {
  SpreadsheetApp: mockSpreadsheetApp,
  UrlFetchApp: mockUrlFetchApp,
  Logger: mockLogger,
  PropertiesService: mockPropertiesService
  // __proto__: gas.globalMockDefaults
}

const glib = gas.require('./dist', mocks)
describe('CreateJCIDS', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    glib.authenticate = mockAuthenticate
  })

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
    expect(mockAuthenticate).toHaveBeenCalledOnce()
    expect(mocks.Logger.log).toHaveBeenCalledExactlyOnceWith("No data to send!")
  })
  it('alerts the user all records were created when UrlFetchApp returns with no errors', () => {
    glib.getSpreadSheetData = vi.fn(() => [
      {Description: 'Dummy data1', Code: 'moreDummyData'},
      {Description: 'Dummy data2', Code: 'moreDummyData2'}
    ])
    mockUrlFetchApp.fetchAll.mockReturnValue([
      { getResponseCode: () => 201 },
      { getResponseCode: () => 201 }
    ])
    glib.CreateJCIDS()
    
    expect(mocks.Logger.log).toHaveBeenCalledTimes(2)
    expect(mocks.Logger.log).nthCalledWith(1, 'Row 2: Successfully created')
    expect(mocks.Logger.log).nthCalledWith(2, 'Row 3: Successfully created')
    expect(mockUi.alert).toHaveBeenCalledWith('All records were created successfully!')
  })
  it('logs rows with error codes, modifies the row background color and alerts the user some rows failed', () => {
    glib.getSpreadSheetData = vi.fn(() => [
      {Description: 'Dummy data1', Code: 'moreDummyData'},
      {Description: 'Dummy data2', Code: 'moreDummyData2'}
    ])
    mockUrlFetchApp.fetchAll.mockReturnValue([
      { getResponseCode: () => 400, getContentText: () => 'Error' },
      { getResponseCode: () => 201 }
    ])
    glib.CreateJCIDS()

    expect(mocks.Logger.log).toHaveBeenCalledTimes(2)
    expect(mocks.Logger.log).nthCalledWith(1, 'Row 2: Failed with status code 400. Error: Error')
    expect(mocks.Logger.log).nthCalledWith(2, 'Row 3: Successfully created')
    expect(mockSheet.getRange).toHaveBeenCalledWith(2, 1,1, undefined)
    expect(mockRange.setBackground).toHaveBeenCalledWith('red')
    expect(mockUi.alert).toHaveBeenCalledWith(`Some records failed to create or already existed in the database.
      Pre-existingRows: []
      Failed rows: [2]`)
  })
})
  