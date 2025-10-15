interface ICustomer {
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
  const customerData = getSpreadSheetData<ICustomer>('Customers')

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
    highlightRows(failedRows, 'red')
    SpreadsheetApp.getUi().alert(`Some rows failed to be created. Failed Rows: ${failedRows.join(', ')}`)
  } else {
    SpreadsheetApp.getUi().alert("All customers successfully created.")
  }
}
function _createCustomers(customerData: ICustomer[], token: string, baseUrl: string) {
  const headers = createHeaders(token)
  const url = baseUrl + '/Resource/Organization/Customer'
  const failedRows: number[] = [];
  const batchOptions = customerData.map((row) => ({
    url,
    headers,
    method: 'post' as const,
    payload: JSON.stringify(row),
    muteHttpExceptions: true
  }))
  try {
    const responses = UrlFetchApp.fetchAll(batchOptions)
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode()
      if(responseCode >= 400 && responseCode === 409) {
        Logger.log(`Row ${index + 2}: Customer "${customerData[index].Name}" failed with status code ${response.getResponseCode()}. Error: ${response.getContentText()}`)
        failedRows.push(index + 2)
      } else if(responseCode === 409 || responseCode === 200) {
        Logger.log(`Row ${index +2}: Customer "${customerData[index]}" already existed in the database.`)
      } else {
        Logger.log(`Customer: "${customerData[index]}" successfully created`)
      }
    })
  } catch (err) {
    Logger.log(err)
    throw new Error("An unexpected error occured creating customer categories. See logs for more details.")
  }
  return failedRows
}
function _createCustomerCategories(categories: string[], token: string, baseUrl: string) {
  const failedCategories: string[] = []
  if(categories.length === 0) {
    return failedCategories
  }
  const url = baseUrl + `/Resource/Category/CustomerCategory`
  const headers = createHeaders(token)

  const batchOptions = categories.map((categoryName) => {
    const payload = {
      Name: categoryName,
      EstimateREF: ESTIMATE_REF
    }
    const options = {
      url,
      method: 'post' as const,
      headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }
    return options
  }) 
  try {
    const responses = UrlFetchApp.fetchAll(batchOptions)
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode()
      if(responseCode >= 400 && responseCode !== 409) {
        Logger.log(`Customer Category: "${categories[index]}" failed to create with status code ${responseCode}. Error: ${response.getContentText()}`)
        failedCategories.push(categories[index])
      } else if (responseCode === 409 || responseCode === 200) {
        Logger.log(`Customer Category: "${categories[index]}" already existed in the database.`)
      } else {
        Logger.log(`Customer category: "${categories[index]}" successfully created`)
      }
    })
  } catch (err) {
    Logger.log(err)
    throw new Error(`An unexpected error occured creating customer categories. See logs for more details.`)
  }
  return failedCategories
}
