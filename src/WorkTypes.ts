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
  const workTypeArray = Array.from(workTypeSet)
  // Post each work type to the api.
  const batchOptions = workTypeArray.map((workType) => {
    const payload = {
      "EstimateREF": gESTIMATE_REF,
      "Name": workType
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
      let responseData = {} as ICategoryItem
      // If the entity already exists will recieve a code of 409 so make sure to only capture real errors
      if (responseCode >= 400 && responseCode !== 409) {
        failedWorkTypes.push(workTypeArray[index])
        Logger.log(`Work Type: ${workTypeArray[index]} failed to create with status code ${responseCode}`)
        return
      }

      // If the entity already exists, the server does not send it, so we have to get the data ourselves.
      if(responseCode === 200 || responseCode === 409) {
        Logger.log(`Work Type: ${workTypeArray[index]} already existed in the database.`)
        // This should find only one result
        const getUrl = url + `/?filter=EstimateREF eq ${gESTIMATE_REF} and Name eq '${workTypeArray[index]}'`
        const options = {
          method: 'get' as const,
          headers,
        }
        const createResponse = UrlFetchApp.fetch(getUrl, options);
        // Handle errors
        if(createResponse.getResponseCode() >= 400) {
          throw new Error(`Could not find Work Type: ${workTypeArray[index]} in the database even though it was expected to be there.`)
        }
        // Set responseData
        responseData = JSON.parse(createResponse.getContentText()).Items[0]
      } else {
        // This is the expected case 90% of the time
        Logger.log(`Work type: ${workTypeArray[index]} successfully created.`)
        responseData = JSON.parse(response.getContentText()).Item
      } 
      // Once the parent work type is created, we call createWorkSubtypes to create all of the subtypes for the parent (if any)
      const createSubtypesResult = _createWorkSubtypes(workTypesData, responseData, token, baseUrl)
      failedSubtypes.push(...createSubtypesResult)
    })
  } catch (err) {
    Logger.log(`Error creating Work Types. Error: ${(err as Error).message}`)
    throw err
  }


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
  if(workTypesData.length === 0) {
    return [] // Return an empty array if there are no subtypes to create
  }
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

  const batchOptions = workSubTypes.map((workSubType) => {
    const options = {
      url,
      method: 'post' as const,
      headers,
      payload: JSON.stringify(workSubType)
    }
    return options
  })
  try {
    const responses = UrlFetchApp.fetchAll(batchOptions);
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode()
      if(responseCode === 200 || responseCode === 409) {
        Logger.log(`Work Type: ${workSubTypes[index].Name} already existed in the database.`)
      } else if (responseCode !== 201) {
        failedWorkSubTypes.push({workType: workType.Name, workSubtype: workSubTypes[index].Name as string})
        Logger.log(`Work Subtype: ${workSubTypes[index].Name} failed to create with status code ${responseCode}`)
      }
      Logger.log(`WorkSubtype ${workSubTypes[index].Name} successfully created.`)
    })
  } catch (err) {
    throw new Error(`An unexpected error occured creating work subtypes. Error: ${err}`)
  }
  return failedWorkSubTypes
}
