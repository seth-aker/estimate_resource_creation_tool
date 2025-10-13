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
interface ISubcontractorDTO extends Omit<ISubcontractorRow, "Subcontractor Category" | "Work Types"> {
    ObjectID?: string
    Category?: string
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
    const subcontractorCategories = new Set<string>()
    subcontractorData.forEach((row) => {
        if(row['Subcontractor Category']) {
            subcontractorCategories.add(row['Subcontractor Category'])
        }
    })
    // Create subcontractor categories before creating the subcontractors
    const {failedCategories} = _createSubcontractorCategories(Array.from(subcontractorCategories), token, baseUrl)
    if(failedCategories.length > 0) {
        throw new Error(`Script failed while creating the following subcontractor categories: ${failedCategories.join(', ')}`)
    }
    
    // Create the subcontractors
    const {failedRows, createdSubcontractors} = _createSubcontractors(subcontractorData, token, baseUrl)
    if(failedRows.length > 0) {
        highlightRows(failedRows, 'red')
        throw new Error(`Some rows failed to be created. Failed Rows: ${failedRows.join(', ')}`)
    }

    // Setup payloads for adding work types and work subtypes to subcontractors
    const subcontractorWorkTypePayloads: ISubconWorkTypePayload[] = []
    const subcontractorWorkSubTypePayloads: ISubconWorkTypePayload[] = []
    const allWorkTypes = getDBCategoryList("WorkType", token, baseUrl)
    const allWorkSubtypes = getDBSubcategoryList("WorkSubtype", token, baseUrl)
    // cycle through the rows and map the work types and sub types 
    subcontractorData.forEach((row) => {
        if(!row['Work Types']) {
            return
        }
        // Data validation in google sheets allows multiple inputs, when the data is added, it is added with a ',' and space.
        // Added whitespace trimming as well.
        const subcontractorWorkTypes = row['Work Types'].split(",").map(each => each.trim())
        const orgRef = createdSubcontractors.find((each) => each.Name === row.Name)?.ObjectID
        if(!orgRef) {
            throw new Error("An unexpected error occured matching subcontractor rows to created subcontractors. This shouldn't have happened and is 100% a bug. Please report this to seth_aker@trimble.com")
        }
        //For each of the work types in the list of worktypes.
        subcontractorWorkTypes.forEach((workType) => {
            // Get the object id from the list of all worktypes.
            const workTypeData = allWorkTypes.find(each => each.Name === workType)
            if(workTypeData) {
                // Get the object id of 
                subcontractorWorkTypePayloads.push({
                    OrganizationREF: orgRef,
                    WorkTypeCategoryREF: workTypeData.ObjectID
                })
            } 
            const workSubtypeData = allWorkSubtypes.filter((subtype) => subtype.Name === workType)
            if(workSubtypeData.length > 0) {
                subcontractorWorkSubTypePayloads.push(...workSubtypeData.map(each => ({
                    OrganizationREF: orgRef,
                    WorkSubtypeCategoryREF: each.ObjectID
                })))
            }
        })
    })
    const failedSubcontractorWorkTypes = _addSubcontractorWorkTypes(subcontractorWorkTypePayloads, token, baseUrl)
    if(failedSubcontractorWorkTypes.length > 0) {
        throw new Error(`An error occured adding the following work types to subcontractors: 
            ${failedSubcontractorWorkTypes.map(each => {
                return `Subcontractor: "${createdSubcontractors.find(sub => sub.ObjectID === each.OrganizationREF)}", Work Type: "${allWorkTypes.find(wt => wt.ObjectID === each.WorkTypeCategoryREF)}"`
            }).join('\n')}`
        )
    }
    const failedSubcontractorWorkSubTypes = _addSubcontractorSubWorkTypes(subcontractorWorkSubTypePayloads, token, baseUrl)
    if(failedSubcontractorWorkSubTypes.length > 0) {
        throw new Error(`An error occured adding the following work subtypes to subcontractors: 
            ${failedSubcontractorWorkSubTypes.map(each => {
                return `Subcontractor: "${createdSubcontractors.find(sub => sub.ObjectID === each.OrganizationREF)}", Work Subtype: "${allWorkSubtypes.find(st => st.ObjectID === each.WorkSubtypeCategoryREF)}`
            }).join('\n')}`)
    }
    SpreadsheetApp.getUi().alert('All subcontractors created successfully!')
}

function _createSubcontractors(subcontractorData: ISubcontractorRow[], token: string, baseUrl: string) {
    const headers = createHeaders(token)
    const failedRows: number[] = [];
    const createdSubcontractors: ISubcontractorDTO[] = []
    const subcontractorsToGet: string[] = []
    const batchOptions = subcontractorData.map((row) => {
        // Pull out the columns that shouldn't be sent when creating a subcontractor. These will be sent later
        const {['Subcontractor Category']: subcontractorCategory, ['Work Types']: workTypes, ...restOfRow} = row
        const url = baseUrl + '/Resource/Organization/Subcontractor'
        
        const payload = {
            ...restOfRow,
            Category: subcontractorCategory
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
            if(responseCode >= 400 && responseCode !== 409) {
                Logger.log(`An error with code ${responseCode} occured creating subcontractor at line ${index + 2}. Error: ${response.getContentText()} `)
                failedRows.push(index + 2)
            } else if(responseCode === 409 || responseCode === 200) {
                Logger.log(`Subcontractor "${subcontractorData[index].Name}" already exists in the database.`)
                subcontractorsToGet.push(subcontractorData[index].Name)
            } else {
                createdSubcontractors.push(JSON.parse(response.getContentText()).Item)
                Logger.log(`Subcontractor "${subcontractorData[index].Name}" successfully created`)
            }
        })
        if(subcontractorsToGet.length > 0) {
            const query = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (${subcontractorsToGet.map(each => `Name eq ${each}`).join(" or ")})`
            const existingSubcontractors = getOrganization('Subcontractor', token, baseUrl, query) as ISubcontractorDTO[]
            createdSubcontractors.push(...existingSubcontractors)
        }
        return {failedRows, createdSubcontractors}   
    } catch (err) {
        Logger.log(`Error creating subcontractors: ${err}`)
        throw new Error('An unexpected error occured creating subcontractors. See logs for more details')
    }
}

function _createSubcontractorCategories(categories: string[], token: string, baseUrl: string) {
    const url = baseUrl + `/Resource/Category/SubcontractorCategory`
    const headers = createHeaders(token)
    const failedCategories: string[] = []
    const categoriesToGet: string[] = []
    const createdCategories: ICategoryItem[] = []
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
            if(responseCode >= 400 && responseCode !== 409) {
                Logger.log(`Subcontractor Category: "${categories[index]}" failed to create with status code ${responseCode}. Error: ${response.getContentText()}`)
                failedCategories.push(categories[index])
            } else if(responseCode === 200 || responseCode === 409) {
                Logger.log(`Subcontractor Category: "${categories[index]}" already existed in the database.`)
                categoriesToGet.push(categories[index])
            } else {
                Logger.log(`Subcontractor Category: "${categories[index]}" successfully created`)
                createdCategories.push(JSON.parse(response.getContentText()).Item)
            }
        })
        if(categoriesToGet.length > 0) {
            const query = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (${categoriesToGet.map((each) => `Name eq '${each}'`).join(' or ')})`
            const existingCategories = getDBCategoryList('SubcontractorCategory', token, baseUrl, query)
            createdCategories.push(...existingCategories)
        }
    } catch (err) {
        Logger.log(err)
        throw new Error("An unexpected error occured creating subcontractor categories. See logs for more detail.")
    }
    return {failedCategories, createdCategories}
}

function _addSubcontractorWorkTypes(workTypePayloads: ISubconWorkTypePayload[], token: string, baseUrl: string) {
    const headers = createHeaders(token)
    const url = baseUrl + '/Resource/Organization/OrganizationWorkType'
    const batchOptions = workTypePayloads.map((payload) => ({
        url,
        headers,
        method: 'post' as const,
        payload: JSON.stringify(payload)
    }))
    const failedSubcontractorWorkTypes: ISubconWorkTypePayload[] = []
    try {
        const responses = UrlFetchApp.fetchAll(batchOptions)
        responses.forEach((response, index) => {
            const responseCode = response.getResponseCode()
            if(responseCode >= 400 && responseCode !== 409) {
                Logger.log(`An error occured adding work type with id: ${workTypePayloads[index].WorkTypeCategoryREF} to subcontractor with id ${workTypePayloads[index].OrganizationREF}. Code: ${responseCode}. Error: ${response.getContentText()}`)
                failedSubcontractorWorkTypes.push(workTypePayloads[index])
            } else if (responseCode === 409 || responseCode === 200) {
                Logger.log(`Work type with id: ${workTypePayloads[index].WorkTypeCategoryREF} already added to organization with id: ${workTypePayloads[index].OrganizationREF}`)
            } else {
                Logger.log(`Work type with id: ${workTypePayloads[index].WorkTypeCategoryREF} added to organization with id: ${workTypePayloads[index].OrganizationREF}`)
            }
        })
        return failedSubcontractorWorkTypes
    } catch (err) {
        Logger.log(`An unexpected error occured adding work types to subcontractors. Error: ${err}`)
        throw new Error(`An unexpected error occured adding work types to subcontractors. See logs for details.`)
    }
}
function _addSubcontractorSubWorkTypes(workTypePayloads: ISubconWorkTypePayload[], token: string, baseUrl: string) {
    const headers = createHeaders(token)
    const url = baseUrl + '/Resource/Organization/OrganizationWorkSubType'
    const batchOptions = workTypePayloads.map((payload) => ({
        url,
        headers,
        method: 'post' as const,
        payload: JSON.stringify(payload)
    }))
    const failedSubcontractorWorkSubTypes: ISubconWorkTypePayload[] = []
    try {
        const responses = UrlFetchApp.fetchAll(batchOptions)
        responses.forEach((response, index) => {
            const responseCode = response.getResponseCode()
            if(responseCode >= 400 && responseCode !== 409) {
                Logger.log(`An error occured adding work subtype with id: ${workTypePayloads[index].WorkSubtypeCategoryREF} to subcontractor with id ${workTypePayloads[index].OrganizationREF}. Code: ${responseCode}. Error: ${response.getContentText()}`)
                failedSubcontractorWorkSubTypes.push(workTypePayloads[index])
            } else if (responseCode === 409 || responseCode === 200) {
                Logger.log(`Work subtype with id: ${workTypePayloads[index].WorkSubtypeCategoryREF} already added to organization with id: ${workTypePayloads[index].OrganizationREF}`)
            } else {
                Logger.log(`Work subtype with id: ${workTypePayloads[index].WorkSubtypeCategoryREF} successfully added to organization with id: ${workTypePayloads[index].OrganizationREF}`)
            }
        })
        return failedSubcontractorWorkSubTypes
    } catch (err) {
        Logger.log(`An unexpected error occured adding work types to subcontractors. Error: ${err}`)
        throw new Error(`An unexpected error occured adding work types to subcontractors. See logs for details.`)
    }
}
