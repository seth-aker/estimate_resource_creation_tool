type TCustomer = {
    Name: string, 
    Address1?: string,
    Address2?: string,
    City: string,
    State?: string,
    Zip?: number,
    Phone?: string,
    Fax?: string,
    "Subcontractor Category"?: string,
    JobCostID?: string,
    // TODO: Fill this with the rest of the rows
}
function CreateCustomers() {

  const {token, baseUrl} = authenticate()
  const customerData = getSpreadSheetData<TCustomer>('Customers')

    // Check if no data and quit
  if (!customerData || customerData.length === 0) {
    Logger.log("No data to send!");
    SpreadsheetApp.getUi().alert('No data to send!');
    return;
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const url = baseUrl + '/Resource/Organization/Customer'
  const failedRows = [];

  customerData.forEach((row, index) => {
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
}
