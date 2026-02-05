interface IJobCostID {
  Description: string,
  Code: string,
  EstimateREF?: string,
  ObjectID?: string
}
type IUpdateType = "update-JCID-code" | "update-JCID-desc";
function GetJCIDOptions() {
  const html = HtmlService.createHtmlOutputFromFile("JCIDOptionsModal");
  SpreadsheetApp.getUi().showModalDialog(html, "Create or Update JCIDS?")
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
        Logger.log(`Row ${index + 2}: Already exists in the database. Status Code: ${responseCode}. Error: ${response.getContentText()}`)
        existingRows.push(index + 2)
      } else if (responseCode >= 400) {
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

function UpdateJCIDS(update: IUpdateType) {
  const {token, baseUrl} = authenticate() // from Authenticate.gs
  const data = getSpreadSheetData<IJobCostID>('Job Cost IDs')
  
  // Check if no data and quit
  if (!data || data.length === 0) {
    Logger.log("No data to send!");
    SpreadsheetApp.getUi().alert('No data to send!');
    return;
  }

  const query = buildUpdateQuery(update, data);
  const failures: number[] = [];
  
  try {
    const jcids = getJCIDS(baseUrl, query, token);
    
    // Optimize search for jcid maping
    const lookupMap = new Map();
    const isUpdateCode = (update === 'update-JCID-code');

    data.forEach(el => {
      const key = isUpdateCode ? el.Description : el.Code;
      const val = isUpdateCode ? el.Code : el.Description;
      lookupMap.set(key, val);    
    })
    jcids.forEach(item => {
      if(isUpdateCode) {
        item.Code = lookupMap.get(item.Description) ?? item.Code;
      } else {
        item.Description = lookupMap.get(item.Code) ?? item.Description;
      }
    })

    const headers = createHeaders(token)
    const batchOptions = jcids.map(jcid => ({
      url: baseUrl + "/Resource/JobCostID",
      headers,
      method: "put" as const,
      payload: JSON.stringify(jcid),
      muteHttpExceptions: true
    }));

    const responses = batchFetch(batchOptions);
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode();
      if(responseCode !== 200) {
        Logger.log(`JCID with code: ${jcids[index].Code} and description: ${jcids[index].Description} failed to update with error code: ${responseCode}, ${response.getContentText()}`)
        failures.push(index)
      } else {
        Logger.log(`JCID with code:  ${jcids[index].Code} and description: ${jcids[index].Description} successfully updated`)
      }
    })

    if(failures.length > 0) {
      const failedRows = failures.map(i => {
        return data.findIndex((row) => {
          if(isUpdateCode) {
            return row.Description === jcids[i].Description
          } else {
            return row.Code === jcids[i].Code
          }
        }) + 2
      })
      highlightRows(failedRows, 'red');
      SpreadsheetApp.getUi().alert(`Some rows failed to update: [${failedRows.join(", ")}]`)
    } else {
      SpreadsheetApp.getUi().alert(`All JCIDs updated successfully`)
    }
  } catch  (err) {
    Logger.log(`[UpdateJCIDS]: ${err}`)
    throw err
  }
}

function buildUpdateQuery(update: IUpdateType, items: IJobCostID[]) {
  const searchElements = items.map((each) => {
    if(update === 'update-JCID-code') {
      return `Name eq '${each.Description}'`
    } else {
      return `Code eq '${each.Code}'`
    }
  })
  return `?$filter=EstimateREF eq ${ESTIMATE_REF} and (${searchElements.join(" or ")})`
}

function getJCIDS(baseUrl: string, query: string, token: string) {
  const url = baseUrl + query;
  const headers = createHeaders(token);
  const getOptions = {
    headers,
    method: 'get' as const,
    muteHttpExceptions: true
  }
  const response = fetchWithRetries(url, getOptions);
  const responseCode = response.getResponseCode();
  if(responseCode !== 200) {
    Logger.log(`An error occured fetching JCID resources: ${response.getContentText()}`)
    throw new Error(`An error occured fetching JCID resources: ${response.getContentText()}`)
  }
  const data: IGetResponse<IJobCostID> = JSON.parse(response.getContentText());
  const items = [...data.Items];
  if(data.Pagination.NextPage) {
    const qIndex = data.Pagination.NextPage.indexOf("?");
    const query = data.Pagination.NextPage.substring(qIndex);
    const nextPageItems = getJCIDS(baseUrl, query, token);
    items.push(...nextPageItems)
  }
  return items;
}