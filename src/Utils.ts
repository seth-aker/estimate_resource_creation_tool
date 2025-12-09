// Work types require a EstimateREF to be sent with the post, use this as a dummy ref
const ESTIMATE_REF = "00000000-0000-0000-0000-000000000000";
const DEFAULT_BATCH_SIZE = 50;

type TOrganizationDTO = ISubcontractorDTO | ICustomerRow | IVendorDTO
interface ICategoryItem {
  EstimateREF: string,
  Name: string,
  ObjectID?: string,
}
interface ISubcategoryItem extends ICategoryItem {
  CategoryREF: string
}
interface IPagination {
  CurrentPage: string,
  ItemsOnPage: number,
  NextPage: string,
  PageSize: number,
  PreviousPage: string,
  TotalItems: number
}
interface ICategoryGetResponse {
  Items: ICategoryItem[],
  Pagination: IPagination
}
interface ISubcategoryGetResponse {
  Items: ISubcategoryItem[],
  Pagination: IPagination
}
interface IOrganizationGetResponse {
  Items: ISubcontractorDTO[],
  Pagination: IPagination
}
type TSpreadsheetValues = Number | Boolean | Date | String

function getSpreadSheetData<T>(spreadsheetName: string): T[] {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(spreadsheetName);
  if(!sheet) throw new Error(`Could not find spreadsheet: "${spreadsheetName}"`)
  const dataRange = sheet.getDataRange(); // Get data
  const data = dataRange.getValues(); // create 2D array
  
  // Process data (e.g., converting to JSON format for API)
  const headers = data[0]; 
  const jsonData = [];

  for(let rowIndex = 1; rowIndex < data.length; rowIndex++) {
    const row: Record<string, TSpreadsheetValues> = {}
    for(let colIndex = 0; colIndex < headers.length; colIndex++) {
      let value = data[rowIndex][colIndex] as TSpreadsheetValues;
      // Trim whitespace if the value is a string
      if(typeof value === 'string') {
        value = value.trim()
      }
      row[headers[colIndex]] = value;
    }
    jsonData.push(row);
  }
  return jsonData as T[];
}

function createHeaders(token: string, additionalHeaders?: Record<string, string>) {
    const baseUrl = PropertiesService.getUserProperties().getProperty('baseUrl')
    const userName = PropertiesService.getUserProperties().getProperty('userName')
    const serverName = PropertiesService.getUserProperties().getProperty('serverName')
    const clientID = PropertiesService.getUserProperties().getProperty('clientID')
    const clientSecret = PropertiesService.getUserProperties().getProperty('clientSecret')
    const dbName = PropertiesService.getUserProperties().getProperty('dbName')
    if(!baseUrl || !userName || !serverName || !dbName || !clientID || !clientSecret) {
      throw new Error('Missing required user properties')
    }
    const connectionString = `Server=${serverName};Database=${dbName};MultipleActiveResultSets=true;Integrated Security=SSPI;`
    
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ConnectionString': connectionString,
        'ClientID': clientID,
        'ClientSecret': clientSecret,
        ...additionalHeaders
    }
}
function batchFetch(batchOptions: (string | GoogleAppsScript.URL_Fetch.URLFetchRequest)[], retryCount: number = 0) {
  Utilities.sleep(retryCount * retryCount * 1000); // Exponential Backoff

  const sliceCount = Math.ceil(batchOptions.length / DEFAULT_BATCH_SIZE)
  const responses: GoogleAppsScript.URL_Fetch.HTTPResponse[] = []
  
  for(let i = 0; i < sliceCount; i++) {
    if(retryCount === 0) {
      SpreadsheetApp.getUi().alert(`Posting batch ${i + 1} of ${sliceCount}`)
    }
    responses.push(...UrlFetchApp.fetchAll(batchOptions.slice(i * DEFAULT_BATCH_SIZE, (i + 1) * DEFAULT_BATCH_SIZE))) // passing a value greater than the length of the array will include all values to the end of the array.
    // if only one call is being made or on the last call, don't sleep
    if(sliceCount > 1 && i < sliceCount - 1) {
      Utilities.sleep(1000)
    }
  }
  const retries: (string | GoogleAppsScript.URL_Fetch.URLFetchRequest)[] = [];
  const responseIndices: number[] = []; 
  responses.forEach((response, index) => {
    const responseCode = response.getResponseCode()
    const responseMessage = response.getContentText();
    if(responseCode === 500 && responseMessage.includes("Connection Timeout Expired.")) {
      retries.push(batchOptions[index])
      responseIndices.push(index);
    }
  })
  if(retryCount < 5 && retries.length > 0) {
    Logger.log(`${retries.length} entries failed due to connection timeout, retrying...`)
    SpreadsheetApp.getUi().alert(`${retries.length} entries failed due to connection timeout, retrying...`)
    const retryResponses = batchFetch(retries, retryCount + 1);
    retryResponses.forEach((response, index) => {
      responses[responseIndices[index]] = response;
    })
  }
  return responses
}
function getOrganization(orgType: string, token: string, baseUrl: string, query: string = `?$filter=EstimateREF eq ${ESTIMATE_REF}`) {
  const url = baseUrl + `/Resource/Organization/${orgType}${query}`
  const headers = createHeaders(token)
  const options = {
    headers,
    method: 'get' as const,
    muteHttpExceptions: true
  }
  const response = UrlFetchApp.fetch(url, options)
  const responseCode = response.getResponseCode()
  if(responseCode !== 200) {
    throw new Error(`An error occured fetching organization type: "${orgType}" with code: ${responseCode}. Error: ${response.getContentText()}`)
  }
  const data: IOrganizationGetResponse = JSON.parse(response.getContentText())
  const items: TOrganizationDTO[] = [...data.Items]

  if(data.Pagination.NextPage) {
    const qIndex = data.Pagination.NextPage.indexOf('?')
    const query = data.Pagination.NextPage.substring(qIndex)
    const nextPageItems = getOrganization(orgType, token, baseUrl, query)
    items.push(...nextPageItems)
  }
  return items
}
/**
 * @param categoryName Name of the category, ie MaterialCategory or Worktype
 * @param token The access token
 * @param baseUrl The db base url
 * @param query A OData query to pass to the database. Defaults to `?$fitler=EstimateREF eq ${ESTIMATE_REF}`
 * @returns ICategoryItem[]
 */
function getDBCategoryList(categoryName: string, token: string, baseUrl: string, query: string = `?$filter=EstimateREF eq ${ESTIMATE_REF}`) {
    const url = baseUrl + `/Resource/Category/${categoryName}${query}`
    const headers = createHeaders(token)
    const options = {
      headers,
      method: 'get' as const,
      muteHttpExceptions: true
    }
    try {
      const response = UrlFetchApp.fetch(url, options)
      const responseCode = response.getResponseCode()
      if(responseCode !== 200) {
        throw new Error(`An error occured fetching category: "${categoryName}" Code: ${responseCode}. Error: ${response.getContentText()}`)
      }
      const data: ICategoryGetResponse = JSON.parse(response.getContentText())
      const items: ICategoryItem[] = [...data.Items]
      
      // Recursively cycle through the pages if there is a NextPage entry in the pagination object
      if(data.Pagination.NextPage) {
        const qIndex = data.Pagination.NextPage.indexOf('?')
        const query = data.Pagination.NextPage.substring(qIndex)
        const nextPageItems = getDBCategoryList(categoryName, token, baseUrl, query)
        items.push(...nextPageItems)
      }
      return items
    } catch (err) {
      Logger.log(err)
      throw err
    }
}
function getDBSubcategoryList(subcategoryName: string, token: string, baseUrl: string, query: string = `?$filter=EstimateREF eq ${ESTIMATE_REF}` ) {
  const url = baseUrl + `/Resource/Subcategory/${subcategoryName}${query}`
    const headers = createHeaders(token)
    const options = {
      headers,
      method: 'get' as const,
      muteHttpExceptions: true
    }
    try {
      const response = UrlFetchApp.fetch(url, options)
      const responseCode = response.getResponseCode()
      if(responseCode !== 200) {
        throw new Error(`An error occured fetching subcategory: "${subcategoryName}" Code: ${responseCode}`)
      }
      const data: ISubcategoryGetResponse = JSON.parse(response.getContentText())
      const items: ISubcategoryItem[] = [...data.Items]
      
      // Recursively cycle through the pages if there is a NextPage entry in the pagination object
      if(data.Pagination.NextPage) {
        const qIndex = data.Pagination.NextPage.indexOf('?')
        const query = data.Pagination.NextPage.substring(qIndex)
        const nextPageItems = getDBSubcategoryList(subcategoryName, token, baseUrl, query)
        items.push(...nextPageItems)
      }
      return items
    } catch (err) {
      Logger.log(err)
      throw err
    }
}

function highlightRows(rowIndices: number[], color: string) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
    rowIndices.forEach((row) => {
      sheet.getRange(row, 1,1, sheet.getLastColumn()).setBackground(color)
    })
}

function deepIncludes(array: any[], searchElement: any) {
  for(const item of array) {
    if(deepEquals(item, searchElement)) {
      return true
    }
  }
  return false
}
function deepEquals(x: any, y: any, seen = new Map()) {
  // If they are the same object or are primatives
  if(x === y) {
    return true;
  }
  // make sure they are objects and are not null.
  if(typeof x !== 'object' || x === null || typeof y !== 'object' || y === null) {
    return false
  }

  // This handles self referencing properties in objects
  if(seen.has(x) && seen.get(x) === y) {
    return true
  }
  seen.set(x,y);

  // If they have different constructors, exit early.
  if(x.constructor !== y.constructor) {
    return false
  }
  // Handle arrays
  if(Array.isArray(x)) {
    if(x.length !== y.length) {
      for (let index in x) {
        if(!deepEquals(x[index], y[index], seen)) {
          return false
        }
      }
      return true
    }
  }
  // if (x.constructor === Date.prototype.constructor) { // Handle Dates
  //     return x.getTime() === y.getTime();
  // }
  // Return false if they don't have the same number of properties
  if(Object.keys(x).length !== Object.keys(y).length) {
    return false
  }
  for(let key of Object.keys(x)) {
    // if y doesn't have the same properties as x
    if(!Object.prototype.hasOwnProperty.call(y, key) || !deepEquals(x[key], y[key], seen)) {
      return false;
    } 
  }
  // If we have looped through each property of x and have determined they are equal to y, return true
  return true
}
