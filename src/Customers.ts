interface ICustomerRow extends ISpreadsheetContact
  {
    Name: string, 
    Address1?: string,
    Address2?: string,
    City: string,
    State?: string,
    Country?: string,
    Zip?: string,
    Phone?: string,
    Fax?: string,
    WebAddress?: string,
    Category?: string,
    Notes?: string,
    JobCostIDCode?: string,
    AccountingNumber?: string
}

interface ICustomerDTO extends Omit<ICustomerRow, 
  "Contact Name" |
  "Contact Title" |
  "Contact Email" |
  "Contact Phone" |
  "Contact Notes" |
  "Is Default Contact?"   
  > {
  ObjectID?: string,
  Category?: string
}
function CreateCustomers() {

  const {token, baseUrl} = authenticate()
  const customerData = getSpreadSheetData<ICustomerRow>('Customers')

    // Check if no data and quit
  if (!customerData || customerData.length === 0) {
    Logger.log("CreateCustomers() failed to run because there was no data to send.");
    SpreadsheetApp.getUi().alert('No data to send!');
    return;
  }
  const customerCategories = new Set<string>()
  customerData.forEach((row) => {
    if(row.Category) {
      customerCategories.add(row.Category.toString())
    }
  })
  const failedCategories = _createCustomerCategories(Array.from(customerCategories), token, baseUrl)
  if(failedCategories.length > 0) {
    throw new Error(`Script failed while creating the following customer categories: ${failedCategories.join(', ')}`)
  }
  const {failedRows, createdCustomers} = _createCustomers(customerData, token, baseUrl)

  const contactDTOs = createContactDTOs(createdCustomers, customerData)
  if(contactDTOs.length > 0) {
    const failedContacts = createContacts(contactDTOs, token, baseUrl)
    if(failedContacts.length > 0) {
      throw new Error(`Some customer contacts failed to be created: ${failedContacts.map(idx => contactDTOs[idx].Name).join(', ')}`)
    }
  }
  if(failedRows.length > 0) {
    highlightRows(failedRows, 'red')
    SpreadsheetApp.getUi().alert(`Some rows failed to be created. Failed Rows: ${failedRows.join(', ')}`)
  } else {
    SpreadsheetApp.getUi().alert("All customers successfully created.")
  }
}
function _createCustomers(customerData: ICustomerRow[], token: string, baseUrl: string) {
  const headers = createHeaders(token)
  const url = baseUrl + '/Resource/Organization/Customer'
  const failedRows: number[] = [];
  const createdCustomers: ICustomerDTO[] = [];
  const seenCustsomers = new Set<string>()
  
  const uniqueCustomers: ICustomerRow[] = customerData.filter((row) => {
    const key = `${row.Name}|${row.City}`
    if(seenCustsomers.has(key)) {
      return false
    }
    seenCustsomers.add(key);
    return true
  })
 
  const batchOptions = uniqueCustomers.map((row) => {
    // Ensure all values are strings before sending to the server.
    Object.keys(row).forEach((key) => {
      if(row[key]) {
        row[key] = String(row[key])
      }
    })
    const {
      ['Contact Name']: contactName,
      ['Contact Title']: contactTitle,
      ['Contact Email']: contactEmail,
      ['Contact Phone']: contactPhone,
      ['Contact Notes']: contactNotes,
      ['Contact Fax']: contactFax,
      ['Contact Extension']: extension,
      ['Is Default Contact?']: isDefault,
      ...rest
    } = row
    return {
      url,
      headers,
      method: 'post' as const,
      payload: JSON.stringify(rest),
      muteHttpExceptions: true
    }
  })
  try {
    const responses = batchFetch(batchOptions, 0, "Creating Customers")
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode()
      if(responseCode >= 400 && responseCode !== 409) {
        Logger.log(`Row ${index + 2}: Customer "${customerData[index].Name}" failed with status code ${responseCode}. Error: ${response.getContentText()}`)
        failedRows.push(index + 2)
      } else if(responseCode === 409 || responseCode === 200) {
        Logger.log(`Row ${index +2}: Customer "${customerData[index].Name}" already existed in the database.`)
      } else {
        createdCustomers.push(JSON.parse(response.getContentText()).Item);
        Logger.log(`Customer: "${customerData[index].Name}" successfully created`)
      }
    })
  } catch (err) {
    Logger.log(err)
    throw new Error("An unexpected error occured creating customer categories. See logs for more details.")
  }
  return {failedRows, createdCustomers}
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
    const responses = batchFetch(batchOptions, 0, "Creating Customer Categories")
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode()
      if(responseCode >= 400 && responseCode !== 409) {
        Logger.log(`Customer Category: "${categories[index]}" failed to create with status code ${responseCode}. Error: ${response.getContentText()}`)
        failedCategories.push(categories[index])
      } else if (responseCode === 409 || responseCode === 200) {
        Logger.log(`Customer Category: "${categories[index]}" already existed in the database.`)
      } else {
        Logger.log(`Customer Category: "${categories[index]}" successfully created`)
      }
    })
  } catch (err) {
    Logger.log(err)
    throw new Error(`An unexpected error occured creating customer categories. See logs for more details.`)
  }
  return failedCategories
}
