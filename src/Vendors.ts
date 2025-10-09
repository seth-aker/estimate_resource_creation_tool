interface TVendorRow {
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

function CreateVendors() {

    const {token, baseUrl} = authenticate()
    const vendorData = getSpreadSheetData<TVendorRow>('Vendors');
    if (!vendorData || vendorData.length === 0) {
        Logger.log("No data to send!");
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
    const existingMaterialCategories = getDBCategoryList('MaterialCategory', token, baseUrl)
    const existingMaterialSubcategories = getDBSubcategoryList('MaterialSubcategory', token, baseUrl)
    
    const parentMaterialCategories: ICategoryItem[] = []
    const subMaterialCategories: ISubcategoryItem[] = []

    // For each unique category, search to see if it already exists in parent categories or subcategories.
    // If not, we will create them.
    materialCategories.forEach((category) => {
        const parentCat = existingMaterialCategories.find((each) => each.Name === category)
        if(parentCat) {
            parentMaterialCategories.push(parentCat)
            materialCategories.delete(category)
        } else {
            const subCat = existingMaterialSubcategories.find((each) => each.Name === category)
            if(subCat) {
                subMaterialCategories.push(subCat)
                materialCategories.delete(category)
            }
        }   
    })

    const failedVendorCategories = _createVendorCategories(Array.from(vendorCategories), token, baseUrl)
    if(failedVendorCategories.length > 0) {
        throw new Error(`Script failed while creating the following vendor categories: ${failedVendorCategories.join(', ')}`)
    }
    // If there are material categories that don't already exist in the database, we have to create them before creating the vendors and attaching the categories.
    // This should be done first because the result of "createModal" cannot be awaited and we would have to retrieve all the vendor ids from the db in another call. Prevents another db call.
    // if(materialCategories.size > 0) {
    //     createMaterialCategoryModal(Array.from(materialCategories), parentMaterialCategories.map(each => each.Name))
    // } else {
        // Skip the create material category step and go straight to creating vendors.

    // }
    // const {failedCategories: failedMaterialCategories, createdCategories: createdMaterialCategories} = _createMaterialCategories(Array.from(materialCategories), token, baseUrl)
    // if(failedMaterialCategories.length > 0) {
    //     throw new Error(`Script failed while creating the following material categories: ${createdMaterialCategories.join(', ')}`)
    // }


    
}
function _createVendorCategories(vendorCategories: string[], token: string, baseUrl: string) {
    const url = baseUrl + `/Resource/Category/VendorCategory`
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const failedCategories: string[] = []

    const batchOptions = vendorCategories.map((categoryName) => {
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
                Logger.log(`Category: "${vendorCategories[index]}" failed to create with status code ${responseCode}`)
                failedCategories.push(vendorCategories[index])
            }
        })
    } catch (err) {
        Logger.log(err)
        throw err
    }
    return failedCategories
}

function _createVendors(vendors: TVendorRow[], materialCategories: ICategoryItem[], materialSubcategories: ISubcategoryItem[], token: string, baseUrl: string) {
    const url = baseUrl + '/Resource/Organization/Vendor'
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const failedRows: number[] = [];
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
            payload: JSON.stringify(payload)
        }
        return options
    })
    try {
        const responses = UrlFetchApp.fetchAll(batchOptions)
        responses.forEach((response, index) => {
            const responseCode = response.getResponseCode()
            if(responseCode === 200 || responseCode === 409) {
                Logger.log(`Row ${index + 2}: Vendor with name "${vendors[index].Name}" and city "${vendors[index].City}" already exists`)
                highlightRows([index], 'yellow')
            }
            if(responseCode >= 400 && responseCode !== 409) {
                Logger.log(`Row ${index + 2}: Failed with status code ${responseCode}`)
                failedRows.push(index + 2)
            } else {
                const createdVendorREF = JSON.parse(response.getContentText()).Item.ObjectID as string
                const vendorMaterials = vendors[index]["Material Categories"]?.split(",").map(each => each.trim())
                if(vendorMaterials && vendorMaterials.length > 0) {
                    const parentCategories = materialCategories.filter(each => vendorMaterials.includes(each.Name))
                    _addVendorMaterialCategories(createdVendorREF, parentCategories, false, token, baseUrl)
                    const subCategories = materialSubcategories.filter(each => vendorMaterials.includes(each.Name))
                    _addVendorMaterialCategories(createdVendorREF, subCategories, true, token, baseUrl)
                }
            }
        })
    } catch (err) {
        Logger.log(err)
        throw err
    }
    if(failedRows.length > 0) {
        highlightRows(failedRows, 'red')
        SpreadsheetApp.getUi().alert(`The following rows threw an error. Failed rows: ${failedRows.join(", ")}`)
    } else {
        SpreadsheetApp.getUi().alert("All rows were created successfully.")
    }
}

function _addVendorMaterialCategories(vendorRef: string, categoriesToAdd: ICategoryItem[] | ISubcategoryItem[], isSubCat: boolean, token: string, baseUrl: string) {
    if(categoriesToAdd.length === 0) {
        return
    }
    const url = baseUrl + "/Resource/Organization" + isSubCat ? "/OrganizationMaterialSubcategory" : "/OrganizationMaterialCategory"
    const headers = createHeaders(token)
    const payloads = categoriesToAdd.map((category) => {
        return isSubCat ? {
            materialSubcategoryREF: category.ObjectID!,
            organizationREF: vendorRef
        } : {
            materialCategoryREF: category.ObjectID!,
            organizationREF: vendorRef
        }
    })
    const batchOptions = payloads.map(payload => ({
        url,
        headers,
        method: "post" as const,
        payload
    }))
    // No need to try catch because errors will be caught in _createVendors
    const responses = UrlFetchApp.fetchAll(batchOptions)
    const errorResponses = responses.filter(each => each.getResponseCode() >= 400 && each.getResponseCode() !== 409);
    if(errorResponses.length > 0) {
        throw new Error(`The following material categories failed to be added to vendor with ref "${vendorRef}": \n${errorResponses.map(errorResponse => {
            const index = responses.findIndex(each => errorResponse === each)
            return `{ Material: ${categoriesToAdd[index].Name}, ErrorCode: ${errorResponse.getResponseCode()} }`
        }).join("\n")}`)
    }
}


