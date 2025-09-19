function CreateJCIDS() {
  const {token, baseUrl} = authenticate() // from Authenticate.gs
  const data = getSpreadSheetData('Job Cost IDs')

    // Check if no data and quit
  if (!data || data.length === 0) {
    Logger.log("No data to send!");
    SpreadsheetApp.getUi().alert('No data to send!');
    return;
  }
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const url = baseUrl + '/Resource/JobCostID'
  const failedRows: number[] = [];

  data.forEach((row, index) => {
    const options = {
      method: 'post' as const,
      headers,
      payload: JSON.stringify(row)
    }

    try {
      const response = UrlFetchApp.fetch(url, options)
      const responseCode = response.getResponseCode()

      if(responseCode === 201) {
        Logger.log(`Row ${index + 2}: Successfully created`);
      } else {
        Logger.log(`Row ${index + 2}: Failed with status code ${responseCode}`);
        failedRows.push(index + 2) // Adding failed row to the list (i + 2 because of header row)
      }
    } catch (err) {
      Logger.log(`Error at row ${index + 2}: ${(err as Error).message}`);
      failedRows.push(index + 2); // Adding failed row to the list
    }
  })

  // Show alerts based on the results
  if (failedRows.length === 0) {
    SpreadsheetApp.getUi().alert('All records were created successfully!');
  } else {
    SpreadsheetApp.getUi().alert('Some records failed to create. Failed rows: ' + failedRows.join(', '));
  }
}

