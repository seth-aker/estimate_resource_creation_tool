interface IVendorRow {
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
    "Vendor Category"?: string,
    "Material Categories"?: string,
    Notes?: string,
    IsOwned?: boolean
}
interface IVendorDTO extends Omit<IVendorRow, "Vendor Category" | "Material Categories"> {
    ObjectID?: string,
    Category?: string
}
interface IVendorMaterialPayload {
    OrganizationREF: string,
    MaterialCategoryREF?: string,
    MaterialSubcategoryREF?: string
}
function CreateVendors() {
    const {token, baseUrl} = authenticate()
    const vendorData = getSpreadSheetData<IVendorRow>('Vendors');
    
    if (!vendorData || vendorData.length === 0) {
        Logger.log("CreateVendors() failed to run because there was no data to send.");
        SpreadsheetApp.getUi().alert('No data to send!');
        return;
    }
    const vendorCategories = new Set<string>()
    vendorData.forEach((row) => {
        if(row['Vendor Category']) {
            vendorCategories.add(row['Vendor Category'])
        }
    })
    const materialCategories = new Set<string>()
    vendorData.forEach((row) => {
        if(row['Material Categories']) {
            row['Material Categories'].split(',').forEach((each) => {
                materialCategories.add(each.trim())
            })
        }
    })

    const {failedVendorCategories} = _createVendorCategories(Array.from(vendorCategories), token, baseUrl)
    if(failedVendorCategories.length > 0) {
        throw new Error(`Script failed while creating the following vendor categories: ${failedVendorCategories.join(', ')}`)
    }

    const {failedRows, createdVendors} = _createVendors(vendorData, token, baseUrl)
    if(failedRows.length > 0) {
        highlightRows(failedRows, 'red')
        throw new Error(`The following vendors failed to be created. Failed rows: ${failedRows.join(", ")}`)
    }

    const allMaterialCategories = getDBCategoryList('MaterialCategory', token, baseUrl)
    const allMaterialSubcategories = getDBSubcategoryList('MaterialSubcategory', token, baseUrl)
    
    const parentMaterialCategories: IVendorMaterialPayload[] = []
    const subMaterialCategories: IVendorMaterialPayload[] = []

    vendorData.forEach((row) => {
        if(!row['Material Categories']){
            return
        }
        const vendorMaterialCategories = row['Material Categories'].split(',').map(each => each.trim())
        const orgRef = createdVendors.find((each) => each.Name === row.Name)?.ObjectID
        if(!orgRef) {
            throw new Error("An unexpected error occured matching vendor rows to created vendors. This shouldn't have happened and is 100% a bug. Please report this to seth_aker@trimble.com")
        }

        vendorMaterialCategories.forEach((matCat) => {
            const materialCategoryData = allMaterialCategories.find((each) => each.Name === matCat)
            if(materialCategoryData) {
                parentMaterialCategories.push({
                    OrganizationREF: orgRef,
                    MaterialCategoryREF: materialCategoryData.ObjectID
                })
                return
            }
            const materialSubcategoryData = allMaterialSubcategories.filter((subcat) => subcat.Name === matCat)
            if(materialSubcategoryData.length > 0) {
                subMaterialCategories.push(...materialSubcategoryData.map((each) => ({
                    OrganizationREF: orgRef,
                    MaterialSubcategoryREF: each.ObjectID
                })))
            }
        })
    })
    const failedMaterialCategories = _addVendorMaterialCategories(parentMaterialCategories, false, token, baseUrl)
    if(failedMaterialCategories.length > 0) {
        throw new Error(`The following vendors and material categories failed to be connected.\n${failedMaterialCategories.map(each => {
                return `Vendor: "${createdVendors.find(vend => vend.ObjectID === each.OrganizationREF)?.Name}", MaterialCategory: "${allMaterialCategories.find(matCat => each.MaterialCategoryREF === matCat.ObjectID)?.Name}"`
            }).join('\n')}`)
    }
        
    const failedMaterialSubcategories = _addVendorMaterialCategories(subMaterialCategories, true, token, baseUrl)
    if(failedMaterialSubcategories.length > 0) {
        throw new Error(`The following vendors and material subcategories failed to be connected.\n${failedMaterialSubcategories.map(each => {
                return `Vendor: "${createdVendors.find(vend => vend.ObjectID === each.OrganizationREF)?.Name}", MaterialSubcategory: "${allMaterialSubcategories.find(matCat => each.MaterialSubcategoryREF === matCat.ObjectID)?.Name}"`
            }).join('\n')}`)
    }
    SpreadsheetApp.getUi().alert("All rows were created successfully.")
}
function _createVendorCategories(vendorCategories: string[], token: string, baseUrl: string) {
    const failedCategories: string[] = []
    const createdCategories: ICategoryItem[] = []
    if(vendorCategories.length === 0) {
        return {
            failedVendorCategories: failedCategories, 
            createdVendorCategores: createdCategories
        }
    }
    const url = baseUrl + `/Resource/Category/VendorCategory`
    const headers = createHeaders(token)
    const categoriesToGet: string[] = []
    const batchOptions = vendorCategories.map((categoryName) => {
        const payload = {
            Name: categoryName,
            EstimateREF: ESTIMATE_REF
        }
        const options = {
            url,
            method: 'post' as const,
            headers,
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        }
        return options
    }) 
    try {
        const responses = UrlFetchApp.fetchAll(batchOptions)
        responses.forEach((response, index) => {
            const responseCode = response.getResponseCode()
            if(responseCode >= 400 && responseCode !== 409) {
                Logger.log(`Vendor Category: "${vendorCategories[index]}" failed to create with status code ${responseCode}. Error: ${response.getContentText()}`)
                failedCategories.push(vendorCategories[index])
            } else if (responseCode === 409 || responseCode === 200) {
                Logger.log(`Vendor Category: "${vendorCategories[index]}" already existed in the database.`)
                categoriesToGet.push(vendorCategories[index])
            } else {
                Logger.log(`Vendor Category: "${vendorCategories[index]}" successfully created`)
                createdCategories.push(JSON.parse(response.getContentText()).Item)
            }
        })
        if(categoriesToGet.length > 0) {
            const query = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (Name eq '${categoriesToGet.join("' or Name eq '")}')`
            const existingVendorCategories = getDBCategoryList('VendorCategory', token, baseUrl, query)
            createdCategories.push(...existingVendorCategories)
        }
    } catch (err) {
        Logger.log(`An unexpected error occured creating vendor categories. Error: ${err}`)
        throw new Error('An unexpected error occured creating vendor categories. Check the logs for more details.')
    }
    return {failedVendorCategories: failedCategories, createdVendorCategores: createdCategories}
}

function _createVendors(vendors: IVendorRow[], token: string, baseUrl: string) {
    const url = baseUrl + '/Resource/Organization/Vendor'
    const headers = createHeaders(token)

    const failedRows: number[] = [];
    const vendorsToGet: {Name: string, City: string}[] = []
    const createdVendors: IVendorDTO[] = []
    const batchOptions = vendors.map((vendor) => {
        const {['Vendor Category']: vendorCategory, ["Material Categories"]: vendorMaterials, ...restOfVendor} = vendor
        const payload = {
            ...restOfVendor,
            Category: vendorCategory
        }
        const options = {
            url,
            method: 'post' as const,
            headers,
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        }
        return options
    })
    try {
        const responses = UrlFetchApp.fetchAll(batchOptions)
        responses.forEach((response, index) => {
            const responseCode = response.getResponseCode()
            if(responseCode >= 400 && responseCode !== 409) {
                Logger.log(`Row ${index + 2}: Vendor "${vendors[index].Name}" failed with status code ${responseCode}. Error: ${response.getContentText()}`)
                failedRows.push(index + 2)
            } else if(responseCode === 200 || responseCode === 409) {
                Logger.log(`Row ${index + 2}: Vendor with name "${vendors[index].Name}" already exists`)
                vendorsToGet.push({Name: vendors[index].Name, City: vendors[index].City})
            } else {
                Logger.log(`Row ${index + 2}: Vendor with name "${vendors[index].Name}" successfully created`)
                createdVendors.push(JSON.parse(response.getContentText()).Item)
            }
        })
        if(vendorsToGet.length > 0) {
            const query = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (${vendorsToGet.map((each) => `(Name eq '${each.Name}' and City eq '${each.City}')`).join(' or ')})`
            const existingVendors = getOrganization('Vendor', token, baseUrl, query)
            createdVendors.push(...existingVendors)
        }
        return {failedRows, createdVendors}
    } catch (err) {
        Logger.log(`An unexpected error occured creating vendors. Error: ${err}`)
        throw new Error(`An unexpected error occured creating vendors. See logs for more details.`)
    }
}

function _addVendorMaterialCategories(payloads: IVendorMaterialPayload[], isSubCat: boolean, token: string, baseUrl: string) {
    const failedMaterialCategories: IVendorMaterialPayload[] = []
    if(payloads.length === 0) {
        return failedMaterialCategories
    }
    const url = `${baseUrl}/Resource/Organization${isSubCat ? "/OrganizationMaterialSubcategory" : "/OrganizationMaterialCategory"}`
    const headers = createHeaders(token)
    const batchOptions = payloads.map(payload => ({
        url,
        headers,
        method: "post" as const,
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    }))
    try {
        const responses = UrlFetchApp.fetchAll(batchOptions)
        responses.forEach((response, index) => {
            const responseCode = response.getResponseCode()
            if(responseCode >= 400 && responseCode !== 409) {
                Logger.log(`An error occured adding material ${isSubCat ? 'subcategory': 'category'} with id: ${isSubCat ? payloads[index].MaterialSubcategoryREF: payloads[index].MaterialCategoryREF} to organization with id: ${payloads[index].OrganizationREF}. Error: ${response.getContentText()}`)
                failedMaterialCategories.push(payloads[index])
            } else if (responseCode === 409 || responseCode === 200) {
                Logger.log(`Vendor with id: ${payloads[index].OrganizationREF} already has material ${isSubCat ? 'subcategory': 'category'} with id: ${isSubCat ? payloads[index].MaterialSubcategoryREF : payloads[index].MaterialCategoryREF} attached.`)
            } else {
                Logger.log(`Material ${isSubCat ? 'subcategory': 'category'} with id: ${isSubCat ? payloads[index].MaterialSubcategoryREF : payloads[index].MaterialCategoryREF} successfully added to vendor with id: ${payloads[index].OrganizationREF}`)
            }
            
        })
        return failedMaterialCategories
    } catch (err) {
        Logger.log(`An unexpected error occured adding material ${isSubCat ? 'subcategory': 'category'} to vendors. Error: ${err}`)
        throw new Error(`An unexpected error occured adding material ${isSubCat ? 'subcategory': 'category'} to vendors. See logs for details.`)
    }
}


