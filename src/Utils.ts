// Work types require a EstimateREF to be sent with the post, use this as a dummy ref
const ESTIMATE_REF = "00000000-0000-0000-0000-000000000000";
const DEFAULT_BATCH_SIZE = 50;
const MAX_RETRIES = 6;

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
  NextPage?: string,
  PageSize: number,
  PreviousPage?: string,
  TotalItems: number
}
interface IGetResponse<T> {
  Items: T[],
  Pagination: IPagination
}
type TSpreadsheetValues = Number | Boolean | Date | string

interface IBatchProgress {
  totalItems: number,
  completedItems: number,
  totalBatches: number,
  completedBatches: number,
  failedCount: number
}

function getSpreadSheetData<T>(spreadsheetName: string): T[] {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(spreadsheetName);
  if(!sheet) throw new Error(`Could not find spreadsheet: "${spreadsheetName}"`)
  const dataRange = sheet.getDataRange(); // Get data
  const data = dataRange.getValues(); // create 2D array
  
  // Process data (e.g., converting to JSON format for API)
  const headers = data[0]; 
  if(!headers) throw new Error(`No headers found in row`)
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
    const sqlListener = PropertiesService.getUserProperties().getProperty('sqlListener')
    const clientID = PropertiesService.getUserProperties().getProperty('clientID')
    const clientSecret = PropertiesService.getUserProperties().getProperty('clientSecret')
    const dbName = PropertiesService.getUserProperties().getProperty('dbName')
    if(!baseUrl || !userName || !sqlListener || !dbName || !clientID || !clientSecret) {
      throw new Error('Missing required user properties')
    }
    const connectionString = `Server=${sqlListener};Database=${dbName};MultipleActiveResultSets=true;Integrated Security=SSPI;`
    
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'ConnectionString': connectionString,
        'ClientID': clientID,
        'ClientSecret': clientSecret,
        ...additionalHeaders
    }
}

function setProgress(batchNumber: number, totalBatches: number, failedResCount: number, retryCount: number) {
  const batchProgress = {
    batchNumber,
    totalBatches,
    failedResCount,
    retryCount
  }
  CacheService.getUserCache().put("BatchProgress", JSON.stringify(batchProgress))
}

function getProgressFromServer() {
  const batchProgress: IBatchProgress = JSON.parse(CacheService.getUserCache().get('BatchProgress') ?? "") ?? {batchNumber: 0, totalBatches: 0, failedResCount: 0};
  return batchProgress;
}

function openProgressSidebar(sidebarTitle?: string) {
  const html = HtmlService.createHtmlOutputFromFile('ScriptProgressSidebar')
    .setTitle(sidebarTitle ?? "Script Progress")
  SpreadsheetApp.getUi().showSidebar(html);
}

// function batchFetch(batchOptions: (string | GoogleAppsScript.URL_Fetch.URLFetchRequest)[], retryCount: number = 0, processName?: string) {
//   Utilities.sleep(retryCount * 1000);
//   if(retryCount === 0) {
//     openProgressSidebar(processName)
//   }

//   const sliceCount = Math.ceil(batchOptions.length / DEFAULT_BATCH_SIZE)
//   const responses: GoogleAppsScript.URL_Fetch.HTTPResponse[] = []
//   const retries: (string | GoogleAppsScript.URL_Fetch.URLFetchRequest)[] = [];
//   const responseIndices: number[] = []; 

//   for(let i = 0; i < sliceCount; i++) {
//     setProgress(i, sliceCount, 0, retryCount)
//     const batchResponses = UrlFetchApp.fetchAll(batchOptions.slice(i * DEFAULT_BATCH_SIZE, (i + 1) * DEFAULT_BATCH_SIZE)) // passing a value greater than the length of the array will include all values to the end of the array.
//     batchResponses.forEach((response, index) => {
//       const responseCode = response.getResponseCode()
//       if(responseCode === 500) {
//         retries.push(batchOptions[index])
//         responseIndices.push(index);
//       }
//     })
//     responses.push(...batchResponses)
//     // if only one call is being made or on the last call, don't sleep
//     if(sliceCount > 1 && i < sliceCount - 1) {
//       Utilities.sleep(1000)
//     }
//     setProgress(i+1, sliceCount, retries.length, retryCount);
//   }

//   if(retryCount < MAX_RETRIES && retries.length > 0) {
//     Logger.log(`${retries.length} entries failed due to connection timeout, retrying...`)
//     const retryResponses = batchFetch(retries, retryCount + 1);
//     retryResponses.forEach((response, index) => {
//       responses[responseIndices[index]] = response;
//     })
//   }
//   setProgress(sliceCount, sliceCount, 0, retryCount); // Sets the "isCompleted flag and closes the sidebar"
//   return responses
// }
function batchFetch(batchOptions: (string | GoogleAppsScript.URL_Fetch.URLFetchRequest)[]) {
  const sliceCount = Math.ceil(batchOptions.length / DEFAULT_BATCH_SIZE)
  const responses: GoogleAppsScript.URL_Fetch.HTTPResponse[] = []
  
  logBatchProgress({
    failedCount: 0,
    totalItems: batchOptions.length,
    completedItems: 0,
    totalBatches: sliceCount,
    completedBatches: 0
  })

  let failedCount = 0;
  for(let i = 0; i < sliceCount; i++) {
    logEvent(`Starting batch ${i + 1} of ${sliceCount}`)
    const batchRes = _fetchAllWithRetries(batchOptions.slice(i * DEFAULT_BATCH_SIZE, (i + 1) * DEFAULT_BATCH_SIZE));
    batchRes.forEach((res) => {
      if(res.getResponseCode() > 299) {
        failedCount++
      }
      responses.push(...batchRes)
    })
    logBatchProgress({
      failedCount,
      completedItems: responses.length - failedCount,
      completedBatches: i + 1
    })
    logEvent(`Batch ${i+1} complete`)
  }
  return responses;
}

function _fetchAllWithRetries(batchOptions: (string | GoogleAppsScript.URL_Fetch.URLFetchRequest)[], retryCount = 0) {
  const retries: (string | GoogleAppsScript.URL_Fetch.URLFetchRequest)[] = [];
  const responses = UrlFetchApp.fetchAll(batchOptions);
  const retryIdxs: number[] = []
  responses.forEach((res, idx) => {
    const code = res.getResponseCode()
    if(code === 500) {
      retries.push(batchOptions[idx]);
      retryIdxs.push(idx)
    }
  })

  if(retryCount <= MAX_RETRIES && retries.length > 0) {
    const batchProgress = getBatchProgress()
    logEvent(`${retries.length} items timed out in batch ${batchProgress.completedBatches + 1}. Retrying...`)
    const retryResponses = _fetchAllWithRetries(retries, retryCount + 1);
    retryResponses.forEach((res, idx) => {
      responses[retryIdxs[idx]] = res
    })
  }

  return responses;
}

function logEvent(message: string) {
  const userService = PropertiesService.getUserProperties()
  const raw = userService.getProperty('scriptEvents')
  const events: string[] = raw ? JSON.parse(raw) : []
  events.push(message);
  userService.setProperty('scriptEvents', JSON.stringify(events))
}
function getBatchProgress() {
  const userService = PropertiesService.getUserProperties()
  const raw: string | null = userService.getProperty('batchProgress');
  const current = raw ? JSON.parse(raw) : {} as IBatchProgress; 
  return current as IBatchProgress
}
function logBatchProgress(progress: Partial<IBatchProgress>) {
  const userService = PropertiesService.getUserProperties()
  const raw: string | null = userService.getProperty('batchProgress');
  const current: IBatchProgress = raw ? JSON.parse(raw) : {} ;
  userService.setProperty('batchProgress', JSON.stringify({...current, ...progress}))
}

function getScriptProgress() {
  const userService = PropertiesService.getUserProperties()
  const properties = userService.getProperties();
  const batchProgress: IBatchProgress = properties.batchProgress ? JSON.parse(properties.batchProgress) : {} as IBatchProgress
  const scriptEvents: string[] = properties.scriptEvents ? JSON.parse(properties.scriptEvents): []
  const scriptFinished: boolean = properties.scriptFinished ? JSON.parse(properties.scriptFinished) : false;
  return {
    batchProgress,
    scriptEvents,
    scriptFinished
  }
}
function clearScriptProgress() {
  const userService = PropertiesService.getUserProperties()
  userService.deleteProperty('batchProgress')
  userService.deleteProperty('scriptEvents')
}

function fetchWithRetries(url: string, options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions, retryCount: number = 0) {
  Utilities.sleep(retryCount * 1000);

  let response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  if(responseCode === 500 && retryCount < MAX_RETRIES) {
    response = fetchWithRetries(url, options, retryCount + 1);
  }
  return response;
}

function getOrganization(orgType: string, token: string, baseUrl: string, query: string = `?$filter=EstimateREF eq ${ESTIMATE_REF}`) {
  const url = baseUrl + `/Resource/Organization/${orgType}${query}`
  const headers = createHeaders(token)
  const options = {
    headers,
    method: 'get' as const,
    muteHttpExceptions: true
  }
  const response = fetchWithRetries(url, options)
  const responseCode = response.getResponseCode()
  if(responseCode !== 200) {
    throw new Error(`An error occured fetching organization type: "${orgType}" with code: ${responseCode}. Error: ${response.getContentText()}`)
  }
  const data: IGetResponse<TOrganizationDTO> = JSON.parse(response.getContentText())
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
      const response = fetchWithRetries(url, options)
      const responseCode = response.getResponseCode()
      if(responseCode !== 200) {
        throw new Error(`An error occured fetching category: "${categoryName}" Code: ${responseCode}. Error: ${response.getContentText()}`)
      }
      const data: IGetResponse<ICategoryItem> = JSON.parse(response.getContentText())
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
      const response = fetchWithRetries(url, options)
      const responseCode = response.getResponseCode()
      if(responseCode !== 200) {
        if(responseCode === 404) {
          Logger.log("404: Material Subcategory not found!");
          return [] as ISubcategoryItem[];
        }
        throw new Error(`An error occured fetching subcategory: "${subcategoryName}" Code: ${responseCode}`)
      }
      const data: IGetResponse<ISubcategoryItem> = JSON.parse(response.getContentText())
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
  const lastColumn = sheet.getLastColumn()
  const rowGroups = new Map<number, number>();
  let groupStart = rowIndices[0];
  let groupEnd = rowIndices[rowIndices.length - 1];
  rowGroups.set(groupStart, groupEnd);
  for(let i = 0; i < rowIndices.length - 1; i++) {
    if(rowIndices[i + 1] !== rowIndices[i] + 1) { // if there are entries between rows that did not fail
      groupEnd = rowIndices[i];
      rowGroups.set(groupStart, groupEnd);
      groupStart = rowIndices[i + 1];
    }
  }
  // set the last group
  rowGroups.set(groupStart, rowIndices[rowIndices.length - 1])

  const groupStarts = Array.from(rowGroups.keys()).sort((a,b) => a - b);
  groupStarts.forEach(rowStart => {
    if(rowStart >= 0) {
      const groupSize = rowGroups.get(rowStart)! - rowStart + 1;
      sheet.getRange(rowStart, 1, groupSize, lastColumn).setBackground(color);
    }
  })
}

function setIsScriptFinished(isFinished: boolean) {
  PropertiesService.getUserProperties().setProperty('scriptFinished', JSON.stringify(isFinished))
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
