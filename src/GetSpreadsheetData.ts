type ISpreadsheetValues = Number | Boolean | Date | String

function getSpreadSheetData<T>(spreadsheetName: string): T[] {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(spreadsheetName);
  if(!sheet) throw new Error(`Could not find spreadsheet: "${spreadsheetName}"`)
  const dataRange = sheet.getDataRange(); // Get data
  const data = dataRange.getValues(); // create 2D array
  
  // Process data (e.g., converting to JSON format for API)
  const headers = data[0]; 
  const jsonData = [];

  for(let i = 1; i < data.length; i++) {
    const row: Record<string, ISpreadsheetValues> = {}
    for(let j = 0; j < headers.length; j++) {
      const value = data[i][j] as ISpreadsheetValues;
      // Trim whitespace if the value is a string
      if(typeof value === 'string') {
        value.trim()
      }
      row[headers[j]] = value;
    }
    jsonData.push(row);
  }
  return jsonData as T[];
}
