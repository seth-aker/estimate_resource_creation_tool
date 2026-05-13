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
  setIsScriptFinished(false);
  clearScriptProgress()
  openProgressSidebar("Creating JCIDS")
  logEvent("Starting CreateJCIDS script")
  const {token, baseUrl} = authenticate() // from Authenticate.gs
  const data = getSpreadSheetData<IJobCostID>('Job Cost IDs')

    // Check if no data and quit
  if (!data || data.length === 0) {
    Logger.log("No data to send!");
    SpreadsheetApp.getUi().alert('No data to send!');
    clearScriptProgress()
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
    logEvent("Uploading Job Cost Ids...")
    const responses = batchFetch(batchOptions)
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode()
      if (responseCode === 409 || responseCode === 200) {
        Logger.log(`Row ${index + 2}: Already exists in the database. Status Code: ${responseCode}. ${response.getContentText()}`)
        existingRows.push(index)
      } else if (responseCode >= 400) {
        Logger.log(`Row ${index + 2}: Failed with status code ${responseCode}. Error: ${response.getContentText()}`);
        failedRows.push(index) // Adding failed row to the list (i + 2 because of header row)
      }
    })
    if(failedRows.length > 0) {
      highlightRows(failedRows.map(each => each + 2), 'red');
      const errorMessages = failedRows.map(idx => JSON.parse(responses[idx].getContentText())?.CustomMessage)
      const failedResults = errorMessages.map((message, idx) => `Row ${failedRows[idx] + 2}: ${message}`) 
      logEvent(`Some rows failed!\n${failedResults.join('\n')}`)
    }
  
    // Set the background of the failed rows to red
    if(existingRows.length !== 0) {
      highlightRows(existingRows.map(idx => idx + 2), 'yellow');
      const errorMessages = existingRows.map(idx => JSON.parse(responses[idx].getContentText())?.CustomMessage)
      const results = errorMessages.map((message, idx) => `Row ${existingRows[idx] + 2}: ${message}`) 
      logEvent(`Some rows already existed in the database!\n${results.join('\n')}`) 
    }

    logEvent("Script Complete!")
    SpreadsheetApp.getUi().alert("Script Complete!")
    setIsScriptFinished(true);
    } catch (err) {
      Logger.log(`An unexpected error occured: ${err}`);
      setIsScriptFinished(true)
      throw err
    }
}

function UpdateJCIDS(update: IUpdateType) {
  setIsScriptFinished(false);
  clearScriptProgress()
  openProgressSidebar("Updating JCIDS")
  logEvent("Starting UpdateJCIDS script")
  const {token, baseUrl} = authenticate() // from Authenticate.gs
  const data = getSpreadSheetData<IJobCostID>('Job Cost IDs')
  
  // Check if no data and quit
  if (!data || data.length === 0) {
    Logger.log("No data to send!");
    SpreadsheetApp.getUi().alert('No data to send!');
    clearScriptProgress()
    return;
  }

  const query = `/Resource/JobCostID?$filter=EstimateREF eq ${ESTIMATE_REF}`
  const failures: number[] = [];
  
  try {
    logEvent("Retrieving existing JCIDS...")
    const jcids = getJCIDS(baseUrl, query, token);
    
    // Optimize search for jcid maping
    const lookupMap = new Map();
    const isUpdateCode = (update === 'update-JCID-code');

    data.forEach(el => {
      const key = isUpdateCode ? el.Description : el.Code;
      const val = isUpdateCode ? el.Code : el.Description;
      lookupMap.set(key, val);    
    })
    jcids
      .filter(each => {
        data.some((row) => isUpdateCode ? row.Description === each.Description: row.Code === each.Code)
      })
      .forEach(item => {
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
    logEvent(`Updating JCID ${isUpdateCode ? "Codes": "Descriptions"}`)
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
      
      highlightRows(failures.map(each => each + 2), 'red');
      const errorMessages = failures.map(idx => JSON.parse(responses[idx].getContentText())?.CustomMessage)
      const failedResults = errorMessages.map((message, idx) => `Row ${failures[idx] + 2}: ${message}`) 
      logEvent(`Some rows failed!\n${failedResults.join('\n')}`)
    } 
    logEvent("Script Complete!")
    SpreadsheetApp.getUi().alert("Script Complete!")
    setIsScriptFinished(true)
  } catch  (err) {
    Logger.log(`[UpdateJCIDS]: ${err}`)
    setIsScriptFinished(true)
    throw err
  }
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
    Logger.log(`Error: ${responseCode}. An error occured fetching JCID resources: ${response.getContentText()}`)
    throw new Error(`Error: ${responseCode}. An error occured fetching JCID resources: ${response.getContentText()}`)
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