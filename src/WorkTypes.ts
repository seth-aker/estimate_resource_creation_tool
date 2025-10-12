interface IWorkType {
  "Work Type": TSpreadsheetValues,
  "Work Subtype": TSpreadsheetValues
}
interface IWorkTypeSubtypeMap {
  parentRef: string,
  subtype: string
}
function CreateWorkTypes() {
  const {token, baseUrl} = authenticate()
  const workTypesData = getSpreadSheetData<IWorkType>("Work Types")

  if(!workTypesData || workTypesData.length === 0) {
    Logger.log("No data to send!");
    SpreadsheetApp.getUi().alert('No data to send!');
    return;
  }
  const parentWorkTypes = workTypesData.map((row) => row["Work Type"].toString())
  const uniqueWorkTypes = Array.from(new Set(parentWorkTypes))
  const {failedWorkTypes, createdWorkTypes} = _createWorkTypes(uniqueWorkTypes, token, baseUrl)
  if(failedWorkTypes.length > 0) {
    throw new Error(`The following worktype(s) failed to be created. \n${failedWorkTypes.join(", ")}`)
  } 
  const workTypeSubTypeMap: IWorkTypeSubtypeMap[] = []
  workTypesData.forEach((row) => {
    const parentRef = createdWorkTypes.find((each) => each.Name === row["Work Type"])?.ObjectID
    const subtype = row["Work Subtype"].toString()
    if(!parentRef || !subtype) {
      return
    }
    const map = {
      parentRef,
      subtype
    }
    if(!deepIncludes(workTypeSubTypeMap, map)) {
      workTypeSubTypeMap.push(map)
    }
  })
  const {failedWorkSubtypes} = _createWorkSubtypes(workTypeSubTypeMap, token, baseUrl)
  if(failedWorkSubtypes.length > 0) {
    throw new Error(`The following work Subtypes failed to be created: ${failedWorkSubtypes.join(", ")}`)
  } else {
    SpreadsheetApp.getUi().alert("All worktypes created successfully!")
  }
}

function _createWorkTypes(workTypes: string[], token: string, baseUrl: string) {
  if(!workTypes || workTypes.length === 0) {
    return {failedWorkTypes: [], createdWorkTypes: []}
  }

  const headers = createHeaders(token)
  const url = baseUrl + '/Resource/Category/WorkType'
  
  // Post each work type to the api.
  const batchOptions = workTypes.map((workType) => {
    const payload = {
      "EstimateREF": ESTIMATE_REF,
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
    // To notify the user work types that failed to post.
    const failedWorkTypes: string[] = [];
    const createdWorkTypes: ICategoryItem[] = []
    const workTypesToGet: string[] = []
    const responses = UrlFetchApp.fetchAll(batchOptions)
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode()
      // If the entity already exists will recieve a code of 409 so make sure to only capture real errors
      if (responseCode >= 400 && responseCode !== 409) {
        failedWorkTypes.push(workTypes[index])
        Logger.log(`Work Type: "${workTypes[index]}" failed to create with status code ${responseCode}. Error: ${response.getContentText()}`)
  
      // If the entity already exists, the server does not send it, so we have to get the data ourselves.
      } else if(responseCode === 200 || responseCode === 409) {
        Logger.log(`Work Type: "${workTypes[index]}" already exists in the database`)
        workTypesToGet.push(workTypes[index])
      } else {
        Logger.log(`Work Type: "${workTypes[index]}" successfully created`)
        createdWorkTypes.push(JSON.parse(response.getContentText()).Item)
      }
    })
    if(workTypesToGet.length > 0) {
      const query = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (${workTypesToGet.map(each => `Name eq '${each}'`).join(' or ')})`
      const existingWorkTypes = getDBCategoryList('WorkType', token, baseUrl, query)
      createdWorkTypes.push(...existingWorkTypes)
    }
    return {failedWorkTypes, createdWorkTypes}
  } catch (err) {
    throw new Error(`An unexpected error occured creating Work Types. Error: ${(err as Error).message}`)
  }
}

function _createWorkSubtypes(workTypeSubTypeMap: IWorkTypeSubtypeMap[], token: string, baseUrl: string ) {
  if(workTypeSubTypeMap.length === 0) {
    return {failedWorkSubtypes: [], createdWorkSubtypes: []} // Return an empty array if there are no subtypes to create
  }
  const payloads = workTypeSubTypeMap.map((each) => {
    return {
      EstimateREF: ESTIMATE_REF,
      Name: each.subtype,
      CategoryREF: each.parentRef
    }
  })
  const url = `${baseUrl}/Resource/Subcategory/WorkSubType`
  const headers = createHeaders(token)
  const failedWorkSubtypes: string[] = []; 
  const createdWorkSubtypes: ISubcategoryItem[] = []
  const batchOptions = payloads.map((payload) => {
    const options = {
      url,
      method: 'post' as const,
      headers,
      payload: JSON.stringify(payload)
    }
    return options
  })
  try {
    const subtypesToGet: ISubcategoryItem[] = []
    const responses = UrlFetchApp.fetchAll(batchOptions);
    responses.forEach((response, index) => {
    const responseCode = response.getResponseCode()
      if(responseCode === 200 || responseCode === 409) {
        Logger.log(`Work Subtype: "${payloads[index].Name}" already existed in the database.`)
        subtypesToGet.push(payloads[index])
      } else if (responseCode !== 201) {
        failedWorkSubtypes.push(payloads[index].Name)
        Logger.log(`Work Subtype: "${payloads[index].Name}" failed to create with status code ${responseCode}. Error: ${response.getContentText()}`)
      } else {
        Logger.log(`Work Subtype "${payloads[index].Name}" successfully created.`)
        createdWorkSubtypes.push(JSON.parse(response.getContentText()).Item)
      }
    })
    if(subtypesToGet.length > 0) {
      const query = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (${subtypesToGet.map(each => `(Name eq '${each.Name}' and CategoryREF eq ${each.CategoryREF})`).join(" or ")})`
      const response = getDBSubcategoryList('WorkSubType', token, baseUrl, query)
      createdWorkSubtypes.push(...response)
    }
  } catch (err) {
    throw new Error(`An unexpected error occured creating work subtypes. Error: ${err}`)
  }
  return {failedWorkSubtypes, createdWorkSubtypes}
}
