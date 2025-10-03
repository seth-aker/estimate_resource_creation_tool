type TCustomer = {
    Name: string, 
    Address1?: string,
    Address2?: string,
    City: string,
    State?: string,
    Country?: string,
    Zip?: number,
    Phone?: string,
    Fax?: string,
    WebAddress?: string,
    Category?: string,
    Notes?: string,
    JobCostIDCode?: string,
    AccountingNumber?: string
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
  const customerCategories = new Set<string>()
  customerData.forEach((row) => {
    if(row.Category) {
      customerCategories.add(row.Category)
    }
  })
  const failedCategories = _createCustomerCategories(Array.from(customerCategories), token, baseUrl)
  if(failedCategories.length > 0) {
    throw new Error(`Script failed while creating the following customer categories: ${failedCategories.join(', ')}`)
  }
  const failedRows = _createCustomers(customerData, token, baseUrl)
  if(failedRows.length > 0) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
    failedRows.forEach((row) => {
      sheet.getRange(row, 1,1, sheet.getLastColumn()).setBackground('yellow')
    })
    SpreadsheetApp.getUi().alert(`Some rows failed to be created. Failed Rows: ${failedRows.join(', ')}`)
  } else {
    SpreadsheetApp.getUi().alert("All customers successfully created.")
  }
}
function _createCustomers(customerData: TCustomer[], token: string, baseUrl: string) {
   const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const url = baseUrl + '/Resource/Organization/Customer'
  const failedRows: number[] = [];
  const batchOptions = customerData.map((row) => ({
    url,
    headers,
    method: 'post' as const,
    payload: JSON.stringify(row)
  }))
  try {
    const responses = UrlFetchApp.fetchAll(batchOptions)
    responses.forEach((response, index) => {
      if(response.getResponseCode() !== 201) {
        Logger.log(`Row ${index + 2}: Failed with status code ${response.getResponseCode()}`)
        failedRows.push(index + 2)
      }
    })
  } catch (err) {
    Logger.log(err)
    throw err
  }
  return failedRows
}
function _createCustomerCategories(categories: string[], token: string, baseUrl: string) {
  const url = baseUrl + `/Resource/Category/CustomerCategory`
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const failedCategories: string[] = []

  const batchOptions = categories.map((categoryName) => {
    const payload = {
      Name: categoryName,
      EstimateREF: ESTIMATE_REF
    }
    const options = {
      url,
      method: 'post' as const,
      headers,
      payload: JSON.stringify(payload)
    }
    return options
  }) 
  try {
    const responses = UrlFetchApp.fetchAll(batchOptions)
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode()
      if(responseCode !== 201 && responseCode !== 200 && responseCode !== 409) {
        Logger.log(`Category: "${categories[index]}" failed to create with status code ${responseCode}`)
        failedCategories.push(categories[index])
      }
    })
  } catch (err) {
    Logger.log(err)
    throw err
  }
  return failedCategories
}