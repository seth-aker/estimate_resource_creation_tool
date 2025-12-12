interface IJobCostID {
  Description: string,
  Code: string,
  EstimateREF?: string,
  ObjectID?: string
}
function CreateJCIDS() {
  const {token, baseUrl} = authenticate() // from Authenticate.gs
  const data = getSpreadSheetData<IJobCostID>('Job Cost IDs')

    // Check if no data and quit
  if (!data || data.length === 0) {
    Logger.log("No data to send!");
    SpreadsheetApp.getUi().alert('No data to send!');
    return;
  }
  const headers = createHeaders(token)
  const url = baseUrl + '/Resource/JobCostID'
  const failedRows: number[] = [];
  const existingRows: number[] = []
  const batchOptions = data.map((row) => {
    const options = {
      url,
      method: 'post' as const,
      headers,
      payload: JSON.stringify(row),
      muteHttpExceptions: true
    }
    return options
  })

  try {
    const responses = batchFetch(batchOptions)
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode()
      if (responseCode === 409 || responseCode === 200) {
        Logger.log(`Row ${index + 2}: Already exists in the database.`)
        existingRows.push(index + 2)
      } else if (responseCode <= 400) {
        Logger.log(`Row ${index + 2}: Failed with status code ${responseCode}. Error: ${response.getContentText()}`);
        failedRows.push(index + 2) // Adding failed row to the list (i + 2 because of header row)
      } else {
        Logger.log(`Row ${index + 2}: Successfully created`);
      }
    })
  } catch (err) {
    Logger.log(`An unexpected error occured: ${err}`);
    throw err
  }

  // Show alerts based on the results
  if (failedRows.length === 0 && existingRows.length === 0) {
    SpreadsheetApp.getUi().alert('All records were created successfully!');
  } else {
    // Set the background of the failed rows to red
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
    existingRows.forEach((row) => {
      sheet.getRange(row, 1,1,sheet.getLastColumn()).setBackground('yellow')
    })
    failedRows.forEach((row) => {
        sheet.getRange(row, 1,1, sheet.getLastColumn()).setBackground('red')
    })
    SpreadsheetApp.getUi().alert(`Some records failed to create or already existed in the database.
      Pre-existing rows: [${existingRows.join(', ')}]
      Failed rows: [${failedRows.join(', ')}]`);
  }
}

