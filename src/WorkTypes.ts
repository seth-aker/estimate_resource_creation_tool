// Work types require a EstimateREF to be sent with the post, use this as a dummy ref
const ESTIMATE_REF = "00000000-0000-0000-0000-000000000000";
interface WorkTypeItem {
  AntiTamperToken: string,
  EstimateREF: string,
  Name: string,
  ObjectID: string
}

interface WorkTypeGetResponse {
  Items: WorkTypeItem[]
}
function CreateWorkTypes() {
  const {token, baseUrl} = authenticate()
  const workTypesData = getJsonFromSpreadsheet("Work Types")

  if(!workTypesData || workTypesData.length === 0) {
    Logger.log("No data to send!");
    SpreadsheetApp.getUi().alert('No data to send!');
    return;
  }
  _createWorkTypes(workTypesData, token, baseUrl);
  _createWorkSubTypes(workTypesData, token, baseUrl)
}

function _createWorkTypes(workTypesData: Row[], token: string, baseUrl: string) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const url = baseUrl + '/Resource/Category/WorkType'
  // To notify the user work types that failed to post.
  const failedWorkType: string[] = [];

  // Create a set of the unique values of work types from the "Work Type" column
  const workTypeSet = _getUniqueWorkTypes(workTypesData);

  // Post each work type to the api.
  workTypeSet.forEach((workType) => {
    const payload = {
      "EstimateREF": ESTIMATE_REF,
      "Name": workType
    }
    const options = {
      method: 'post' as const,
      headers,
      payload: JSON.stringify(payload)
    }
    try {
      const response = UrlFetchApp.fetch(url, options)
      const responseCode = response.getResponseCode()
      if(responseCode === 200) {
        Logger.log(`Work Type: ${workType} already existed in the database.`)
      } else if (responseCode !== 201) {
        throw new Error(`Work Type: ${workType} failed to create with status code ${responseCode}`)
      }
      Logger.log(`Work type: ${workType} successfully created.`)
    } catch (err) {
      Logger.log(`Error creating Work Type: ${workType}. Error: ${(err as Error).message}`)
      failedWorkType.push(workType)
    }
  })
}

function _getUniqueWorkTypes(rows: Row[]) {
  const workTypes = new Set<string>()
  rows.forEach((row) => {
    workTypes.add(row['Work Type'])
  })
  return workTypes
}

function _getWorkTypeObjects(token: string, baseUrl: string) {
  // Get only worktypes not attached to an Estimate.
  const query = `?$filter=EstimateREF eq ${ESTIMATE_REF}`;
  const url = `${baseUrl}/Resource/Category/WorkType${query}`
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const options = {
    method: 'get' as const,
    headers
  }
  try {
    const response = UrlFetchApp.fetch(url, options)
    const responseCode = response.getResponseCode()
    if(responseCode !== 200) {
      throw new Error(`Failed to fetch database work types with response code: ${responseCode}`)
    }
    const worktypes: WorkTypeGetResponse = JSON.parse(response.getContentText())
    return worktypes
  } catch (err) {
    Logger.log(`An error occured getting Work Type ObjectIds. Error: ${(err as Error).message}`)
    return undefined
  }
}

function _createWorkSubTypes(spreadsheetData: Row[], token: string, baseUrl: string) {
  const uniqueWorkTypes = _getUniqueWorkTypes(spreadsheetData)
  const workTypes = _getWorkTypeObjects(token, baseUrl)
  // Get the object ids for each Work Type in order to associate the subtype with the parent work type 
  const workTypeObjectIDMap: Row = {}
  uniqueWorkTypes.forEach((workTypeName) => {
    const workTypeItem = workTypes?.Items.find((workTypeItem) => {
      workTypeItem.Name === workTypeName
    })
    if(workTypeItem) {
      workTypeObjectIDMap[workTypeName] = workTypeItem.ObjectID
    }
  })

  const url = `${baseUrl}/Resource/Subcategory/WorkSubType`
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const failedWorkSubTypes: number[] = []; 
  spreadsheetData.forEach((row, index) => {
    const workSubType = row['Work Subtype']
    const payload = {
      EstimateREF: ESTIMATE_REF,
      Name: workSubType,
      CategoryREF: workTypeObjectIDMap[row['Work Type']]
    }
    const options = {
      method: 'post' as const,
      headers,
      payload: JSON.stringify(payload)
    }
    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode()
      if(responseCode === 200) {
        Logger.log(`Work Type: ${workSubType} already existed in the database.`)
      } else if (responseCode !== 201) {
        throw new Error(`Work Subtype: ${workSubType} failed to create with status code ${responseCode}`)
      }
      Logger.log(`WorkSubtype ${workSubType} successfully created.`)
    } catch (err) {
      Logger.log(`Error creating Work Type: ${workSubType}. Error: ${(err as Error).message}`)
      failedWorkSubTypes.push(index + 2)
    }
  })
}