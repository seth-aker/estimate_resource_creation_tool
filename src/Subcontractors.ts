interface TSubcontractorRow {
    Name: string, 
    Address1?: string,
    Address2?: string,
    City: string,
    State?: string,
    Zip?: number,
    Phone?: string,
    Fax?: string,
    JobCostID?: string,
    "Subcontractor Category"?: string,
    "Work Types": string,
    // TODO: Fill this with the rest of the rows
}
interface ISubconWorkTypePayload {
    OrganizationREF: string,
    WorkTypeCategoryREF?: string
    WorkSubtypeCategoryREF?: string,
}
function CreateSubcontractors() {
    const {token, baseUrl} = authenticate()
    const subcontractorData = getSpreadSheetData<TSubcontractorRow>('Subcontractors');
    if (!subcontractorData || subcontractorData.length === 0) {
        Logger.log("No data to send!");
        SpreadsheetApp.getUi().alert('No data to send!');
        return;
  }
  _createSubcontractors(subcontractorData, token, baseUrl)
}

function _createSubcontractors(subcontractorData: TSubcontractorRow[], token: string, baseUrl: string) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const existingSubcontractorCategories = _getSubcontractorCategories(token, baseUrl)
    const existingCategoryNames = existingSubcontractorCategories.map(each => each.Name)
    const categoriesInSpreadsheet = subcontractorData.map((row) => row['Subcontractor Category'] as string);
    const categoriesToCreate = categoriesInSpreadsheet.filter((each) => !existingCategoryNames.includes(each))
    const {createdCategories, failedCategories} = _createSubcontractorCategories(categoriesToCreate, token, baseUrl)
    if(failedCategories.length > 0) {
        throw new Error(`Script failed while creating the following subcontractor categories: ${failedCategories.join(', ')}`)
    }
    const failedRows: number[] = [];
    subcontractorData.forEach((row, index) => {
        // Pull out the columns that shouldn't be sent when creating a subcontractor. These will be sent later
        const {['Subcontractor Category']: subcontractorCategory, ['Work Types']: workTypes, ...restOfRow} = row
        const url = baseUrl + '/Resource/Organization/Subcontractor'
        const subcontractorCategories: ICategoryItem[] = existingSubcontractorCategories.concat(createdCategories)
        const payload = {
            ...restOfRow, 
            Category: subcontractorCategories.find((each) => each.Name === subcontractorCategory)?.Name
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
            const data: TSubcontractorRow & {ObjectID: string} = JSON.parse(response.getContentText()).Item 
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
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet()
        failedRows.forEach((row) => {
            sheet.getRange(row, 1,1, sheet.getLastColumn()).setBackground('yellow')
        })
        SpreadsheetApp.getUi().alert(`Some rows failed to be created. Failed Rows: ${failedRows.join(', ')}`)
    } else {
        SpreadsheetApp.getUi().alert("All subcontractors successfully created.")
    }
  

}

function _getSubcontractorCategories(token: string, baseUrl: string) {
    const url = baseUrl + `/Resource/Category/SubcontractorsCategory?$filter=EstimateREF eq ${gESTIMATE_REF}`
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
            throw new Error(`An error occured fetching subcontractor categories. Error code ${responseCode}`)
        }
        const responseData: ICategoryGetResponse = JSON.parse(response.getContentText())
        return responseData.Items
    } catch (err) {
        Logger.log(err)
        throw err
    }
}

function _createSubcontractorCategories(categories: string[], token: string, baseUrl: string) {
    const url = baseUrl + `/Resource/Category/SubcontractorCategory`
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const failedCategories: string[] = []
    const createdCategories: ICategoryItem[] = []
    categories.forEach((categoryName) => {
        const payload = {
            Name: categoryName,
            EstimateREF: gESTIMATE_REF
        }
        const options = {
            method: 'post' as const,
            headers,
            payload: JSON.stringify(payload)
        }
        try {
            const response = UrlFetchApp.fetch(url, options);
            const responseCode = response.getResponseCode();
            if(responseCode === 200) {
                Logger.log(`SubcontractorCategory ${categoryName} already exists`)
            } else if (responseCode !== 201) {
                throw new Error(`An error occured creating SubcontractorCategory: ${categoryName}`)
            }
            const responseData = JSON.parse(response.getContentText())
            createdCategories.push(responseData.Item)
        } catch (err) {
            Logger.log(`An error occured while creating subcontractor category: ${categoryName}. Error: ${err}`)
            failedCategories.push(categoryName);
        }
    })
    return { createdCategories, failedCategories }
}

function _addSubcontractorWorkTypes(workTypeNames: string[], subcontractorREF: string, token: string, baseUrl: string) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const {workTypes, workSubtypes} = _getWorkTypes(token, baseUrl)
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
        const workTypeErrors = workTypeResponses.filter((res) => res.getResponseCode() >= 400) // Filter out all codes that are successes (200, 201)
        if(workTypeErrors.length > 0) {
            throw new Error(`The following worktypes returned with an error: \n${workTypeErrors.map((err) => {
                // Responses returns in the same order as they are sent, so we can use the index of the responses object to match to the work type name.
                const index = workTypeResponses.findIndex((each) => each === err) 
                // BatchOptions was created in the same order as workTypeNames obj, so we can assume this index references the correct worktype (or subtype)
                return `{Work Type: ${workTypes[index].Name}, Error code: ${err.getResponseCode()}}\n`
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
    const workTypeUrl = baseUrl + `/Resources/Category/Worktype?$filter=EstimateREF eq ${gESTIMATE_REF}`
    const subtypeUrl = baseUrl + `/Resources/Subcategory/WorkSubtype?$filter=EstimateREF eq ${gESTIMATE_REF}`
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
        const workSubtypes: ICategoryItem[] = []
        responseCodes.forEach((code) => {
            if(code !== 200) {
                throw new Error(`An error occured fetching worktypes object IDs`)
            }
        })
        const worktypeResponse: ICategoryGetResponse = JSON.parse(responses[0].getContentText())
        const subtypeResponse: ICategoryGetResponse = JSON.parse(responses[1].getContentText())
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
