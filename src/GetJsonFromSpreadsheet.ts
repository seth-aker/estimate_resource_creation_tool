type Row = { [key: string]: any }

function getJsonFromSpreadsheet(spreadsheetName: string) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(spreadsheetName);
  if(!sheet) throw new Error(`An error occured getting "${spreadsheetName}"`)
  const dataRange = sheet.getDataRange(); // Get data
  const data = dataRange.getValues(); // create 2D array
  
  // Process data (e.g., converting to JSON format for API)
  const headers: string[] = data[0]; 
  const jsonData: Row[] = [];

  for(let i = 1; i < data.length; i++) {
    const row: Row = {};
    for(let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    jsonData.push(row);
  }
  Logger.log(JSON.stringify(jsonData, null, 2))
  return jsonData;
}
