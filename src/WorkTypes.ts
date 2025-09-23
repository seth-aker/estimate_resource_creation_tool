type TWorkType = {
  "Work Type": string,
  "Work Subtype": string
}
interface ICategoryItem {
  AntiTamperToken: string,
  EstimateREF: string,
  Name: string,
  ObjectID: string,
  CategoryREF?: string
}

interface ICategoryGetResponse {
  Items: ICategoryItem[]
}
function CreateWorkTypes() {
  const {token, baseUrl} = authenticate()
  const workTypesData = getSpreadSheetData<TWorkType>("Work Types")

  if(!workTypesData || workTypesData.length === 0) {
    Logger.log("No data to send!");
    SpreadsheetApp.getUi().alert('No data to send!');
    return;
  }
  _createWorkTypes(workTypesData, token, baseUrl);
}

function _createWorkTypes(workTypesData: TWorkType[], token: string, baseUrl: string) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const url = baseUrl + '/Resource/Category/WorkType'
  // To notify the user work types that failed to post.
  const failedWorkTypes: string[] = [];
  const failedSubtypes: {workType: string, workSubtype: string}[] = []
  // Create a set of the unique values of work types from the "Work Type" column
  const workTypeSet = _getUniqueWorkTypes(workTypesData);

  // Post each work type to the api.
  workTypeSet.forEach((workType) => {
    const payload = {
      "EstimateREF": gESTIMATE_REF,
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
      const responseData = JSON.parse(response.getContentText())
      // Once the parent work type is created, we call createWorkSubtypes to create all of the subtypes for the parent (if any)
      failedSubtypes.push(..._createWorkSubtypes(workTypesData, responseData.Item, token, baseUrl))
    } catch (err) {
      Logger.log(`Error creating Work Type: ${workType}. Error: ${(err as Error).message}`)
      failedWorkTypes.push(workType)
    }
  })

  if(failedWorkTypes.length === 0 && failedSubtypes.length === 0) {
    SpreadsheetApp.getUi().alert("All worktypes created successfully!")
    return
  }
  if(failedWorkTypes.length > 0) {
    SpreadsheetApp.getUi().alert(`The following worktype(s) failed to be created. \n${failedWorkTypes.join(",\n")}`)
  } 
  if(failedSubtypes.length > 0) {
    SpreadsheetApp.getUi().alert(`The following work Subtypes failed to be created \n${failedSubtypes.map(each => `Work Type: ${each.workType}, Work Subtype: ${each.workSubtype}`).join("\n")}`)
  } 
}

function _getUniqueWorkTypes(rows: TWorkType[]) {
  const workTypes = new Set<string>()
  rows.forEach((row) => {
    const workTypeName = row['Work Type'] as string
    workTypes.add(workTypeName)
  })
  return workTypes
}

function _createWorkSubtypes(workTypesData: TWorkType[], workType: ICategoryItem, token: string, baseUrl: string ) {
  const workTypeName = workType.Name
  const workTypeId = workType.ObjectID
  const workSubTypes = workTypesData
    .filter((row) => {
      // Include only worktypes in the table that match the parent and have a subtype that exists
      return row["Work Type"] === workTypeName && (row["Work Subtype"] !== "" && row["Work Subtype"] !== undefined)
    })
    .map((row) => {
      return {
        EstimateREF: gESTIMATE_REF,
        Name: row['Work Subtype'],
        CategoryREF: workTypeId
      }
  })
  const url = `${baseUrl}/Resource/Subcategory/WorkSubType`
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
  const failedWorkSubTypes: {workType: string, workSubtype: string}[] = []; 

  workSubTypes.forEach((workSubType) => {
    const options = {
      method: 'post' as const,
      headers,
      payload: JSON.stringify(workSubType)
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
      failedWorkSubTypes.push({workType: workType.Name, workSubtype: workSubType.Name as string})
    }
  })
  return failedWorkSubTypes
}
