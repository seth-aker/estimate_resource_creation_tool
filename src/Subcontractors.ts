interface ISubcontractorRow {
    Name: string, 
    Address1?: string,
    Address2?: string,
    City: string,
    State?: string,
    Zip?: number,
    Country?: string,
    Phone?: string,
    WebAddress?: string,
    Fax?: string,
    JobCostIDCode?: string,
    "Subcontractor Category"?: string,
    "Work Types": string,
    Notes: string
}
interface ISubconWorkTypePayload {
    OrganizationREF: string,
    WorkTypeCategoryREF?: string
    WorkSubtypeCategoryREF?: string,
}
function CreateSubcontractors() {
    const {token, baseUrl} = authenticate()
    const subcontractorData = getSpreadSheetData<ISubcontractorRow>('Subcontractors');
    if (!subcontractorData || subcontractorData.length === 0) {
        Logger.log("No data to send!");
        SpreadsheetApp.getUi().alert('No data to send!');
        return;
  }
  _createSubcontractors(subcontractorData, token, baseUrl)
}

function _createSubcontractors(subcontractorData: ISubcontractorRow[], token: string, baseUrl: string) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const subcontractorCategories = new Set<string>()
    subcontractorData.forEach((row) => {
        if(row['Subcontractor Category']) {
            subcontractorCategories.add(row['Subcontractor Category'])
        }
    })

    const failedCategories = _createSubcontractorCategories(Array.from(subcontractorCategories), token, baseUrl)
    if(failedCategories.length > 0) {
        throw new Error(`Script failed while creating the following subcontractor categories: ${failedCategories.join(', ')}`)
    }
    const failedRows: number[] = [];
    subcontractorData.forEach((row, index) => {
        // Pull out the columns that shouldn't be sent when creating a subcontractor. These will be sent later
        const {['Subcontractor Category']: subcontractorCategory, ['Work Types']: workTypes, ...restOfRow} = row
        const url = baseUrl + '/Resource/Organization/Subcontractor'
        
        const payload = {
            ...restOfRow,
            Category: subcontractorCategory
        }
        const options = {
            method: 'post' as const,
            headers,
            payload: JSON.stringify(payload)
        }
        try {
            const response = UrlFetchApp.fetch(url, options)
            const responseCode = response.getResponseCode()
            if(responseCode !== 201) {
                throw new Error(`An error occured creating subcontractor at line ${index + 2}. Code: ${responseCode}`)
            }
            const data: ISubcontractorRow & {ObjectID: string} = JSON.parse(response.getContentText()).Item 
            // Data validation in google sheets allows multiple inputs, when the data is added, it is added with a ',' and space.
            // Added whitespace trimming as well.
            const workTypeArray = workTypes.split(', ').map((eachString) => eachString.trim())
            _addSubcontractorWorkTypes(workTypeArray, data.ObjectID, token, baseUrl)
        } catch (err) {
            Logger.log(err)
            failedRows.push(index + 2)
        }
    })
    if(failedRows.length > 0) {
        highlightRows(failedRows, 'red')
        SpreadsheetApp.getUi().alert(`Some rows failed to be created. Failed Rows: ${failedRows.join(', ')}`)
    } else {
        SpreadsheetApp.getUi().alert("All subcontractors successfully created.")
    }
  

}

function _createSubcontractorCategories(categories: string[], token: string, baseUrl: string) {
    const url = baseUrl + `/Resource/Category/SubcontractorCategory`
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const failedCategories: string[] = []

    const batchOptions = categories.map((categoryName) => {
        const payload = {
            Name: categoryName,
            EstimateREF: ESTIMATE_REF
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
            if(responseCode !== 201 && responseCode !== 200 && responseCode !== 409) {
                Logger.log(`Category: "${categories[index]}" failed to create with status code ${responseCode}`)
                failedCategories.push(categories[index])
            }
        })
    } catch (err) {
        Logger.log(err)
        throw err
    }
    return failedCategories
}

function _addSubcontractorWorkTypes(workTypeNames: string[], subcontractorREF: string, token: string, baseUrl: string) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const {workTypes, workSubtypes} = _getWorkTypes(token, baseUrl)

    const parentIDMap = new Map(workTypes.map((each) => [each.ObjectID, each.Name]))
    const subtypeParentMap = new Map(workSubtypes.map(each => [each.Name, each.CategoryREF!])) // CategoryREF should never be undefined here because a subtype in B2W will always have a category ref
     
    // Filter out all of the subtypes from the workTypeNames array
    const allSubtypeNames = workSubtypes.map(each => each.Name)
    const subtypeNames = workTypeNames.filter((each) => allSubtypeNames.includes(each))

    // Create a set that includes all of the required parents that need to exist in B2W in order to attach subtypes to the subcontractor
    const requiredParentsForSubtypes = new Set<string>()
    subtypeNames.forEach(subTypeName => {
        // Get the parent ref for the subtype
        const subtypeParentREF = subtypeParentMap.get(subTypeName)
        if(!subtypeParentREF) {
            throw new Error(`Could not find the parent ref for subtype: ${subTypeName}`)
        }
        // Get the parent name and add it to the required parents ref.
        const requiredParent = parentIDMap.get(subtypeParentREF)
        if(!requiredParent) {
            throw new Error(`Could not find the parent name for subtype: ${subTypeName}`)
        }
        requiredParentsForSubtypes.add(requiredParent)
    })
    // If workTypeNames does not include a required parent work type, add it to the list.
    requiredParentsForSubtypes.forEach((value) => {
        if(!workTypeNames.includes(value)) {
            workTypeNames.push(value)
        }
    })

    // Prepare to send the requests.
    const workTypeBatch: GoogleAppsScript.URL_Fetch.URLFetchRequest[] = []
    const subtypeBatch: GoogleAppsScript.URL_Fetch.URLFetchRequest[] = []
    
    // Create Work types Batch
    workTypeNames.forEach((workTypeName) => {
        const workType = workTypes.find((each) => each.Name === workTypeName)
        if(!workType) {
            return
        }
        const url = baseUrl + '/Resource/Organization/OrganizationWorkType'
        const payload: ISubconWorkTypePayload = {
            OrganizationREF: subcontractorREF,
            WorkTypeCategoryREF: workType.ObjectID
        }
        workTypeBatch.push({
            url,
            method: 'post' as const,
            headers,
            payload: JSON.stringify(payload)
        })
    })

    // Create work subtype batch
    workTypeNames.forEach((workTypeName) => {
        const subtype = workSubtypes.find((each) => each.Name === workTypeName)
        if(!subtype) {
            return
        }
        const url = baseUrl + '/Resource/Organization/OrganizationWorkSubtype'
        const payload: ISubconWorkTypePayload = {
            OrganizationREF: subcontractorREF,
            WorkSubtypeCategoryREF: subtype.ObjectID
        }
        subtypeBatch.push({
            url,
            method: 'post',
            headers,
            payload: JSON.stringify(payload)
        })

    })
    try {
        const workTypeResponses = UrlFetchApp.fetchAll(workTypeBatch)
        const workTypeErrors = workTypeResponses.filter((res) => res.getResponseCode() >= 400 && res.getResponseCode() !== 409) // Filter out all codes that are successes (200, 201)
        if(workTypeErrors.length > 0) {
            throw new Error(`The following worktypes returned with an error: \n${workTypeErrors.map((err) => {
                // Responses returns in the same order as they are sent, so we can use the index of the responses object to match to the work type name.
                const index = workTypeResponses.findIndex((each) => each === err) 
                // BatchOptions was created in the same order as workTypeNames obj, so we can assume this index references the correct worktype (or subtype)
                const worktype = workTypes.find(each => each.ObjectID === JSON.parse(workTypeBatch[index].payload as string).WorkTypeCategoryREF)?.Name
                return `{Work Type: ${worktype}, Error code: ${err.getResponseCode()}}\n`
            })}`)
        }
        
        // Do the same as above for work subtypes
        const subtypeResponses = UrlFetchApp.fetchAll(subtypeBatch)
        const subtypeErrors = subtypeResponses.filter((res) => res.getResponseCode() >= 400)
        if(subtypeErrors.length > 0) {
            throw new Error(`The following work subtypes returned with an error: \n${subtypeErrors.map((err) => {
                // Responses returns in the same order as they are sent, so we can use the index of the responses object to match to the work type name.
                const index = subtypeResponses.findIndex((each) => each === err) 
                // BatchOptions was created in the same order as workTypeNames obj, so we can assume this index references the correct worktype (or subtype)
                return `{Work Subtype: ${workSubtypes[index].Name}, Error code: ${err.getResponseCode()}}\n`
            })}`)
        }
    } catch (err) {
        throw new Error(`An error occured adding subcontractor work types. Error Message: ${err}`)
    }
}

function _getWorkTypes(token: string, baseUrl: string) {
    const workTypeUrl = baseUrl + `/Resources/Category/Worktype?$filter=EstimateREF eq ${ESTIMATE_REF}`
    const subtypeUrl = baseUrl + `/Resources/Subcategory/WorkSubtype?$filter=EstimateREF eq ${ESTIMATE_REF}`
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const workTypeOptions = {
        url: workTypeUrl,
        method: 'get' as const,
        headers
    }
    const subtypeOptions = {
        url: subtypeUrl, 
        method: 'get' as const,
        headers
    }
    try {
        const responses = UrlFetchApp.fetchAll([workTypeOptions, subtypeOptions])
        const responseCodes = responses.map((eachResponse) => eachResponse.getResponseCode())
        const workTypes: ICategoryItem[] = []
        const workSubtypes: ISubcategoryItem[] = []
        responseCodes.forEach((code) => {
            if(code !== 200) {
                throw new Error(`An error occured fetching worktypes object IDs`)
            }
        })
        const worktypeResponse: ICategoryGetResponse = JSON.parse(responses[0].getContentText())
        const subtypeResponse: ISubcategoryGetResponse = JSON.parse(responses[1].getContentText())
        worktypeResponse.Items.forEach((item) => {
            workTypes.push(item)
        })
        subtypeResponse.Items.forEach((item) => {
            workSubtypes.push(item)
        })
        return {workTypes, workSubtypes}
        
         
    } catch (err) {
        Logger.log(err)
        throw err
    }
}
