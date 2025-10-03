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
                delete row['Material Categories']
            })
        }
    })
    const existingMaterialCategories = getDBCategoryList('MaterialCategory', token, baseUrl)
    const existingMaterialSubcategories = getDBSubcategoryList('MaterialSubcategory', token, baseUrl)
    
    const parentMaterialCategories: string[] = []
    const subMaterialCategories: string[] = []
    materialCategories.forEach((category) => {
        if(existingMaterialCategories.find((each) => each.Name === category)) {
            parentMaterialCategories.push(category)
            materialCategories.delete(category)
        } else if(existingMaterialSubcategories.find((each) => each.Name === category)) {
            subMaterialCategories.push(category)
            materialCategories.delete(category)
        }
    })

    const failedCategories = _createVendorCategories(Array.from(vendorCategories), token, baseUrl)
    if(failedCategories.length > 0) {
        throw new Error(`Script failed while creating the following vendor categories: ${failedCategories.join(', ')}`)
    }
    // const createdVendors = _createVendors(vendorData, token, baseUrl)
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

function _createVendors(vendors: Omit<TVendorRow, "Material Categories">[], token: string, baseUrl: string) {
    const url = baseUrl + '/Resource/Organization/Vendor'
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const failedRows: number[] = [];
    const batchOptions = vendors.map((vendor) => {
        const {['Vendor Category']: vendorCategory, ...restOfVendor} = vendor
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
            if(responseCode !== 201) {
                Logger.log(`Row ${index + 2}: Failed with status code ${responseCode}`)
                failedRows.push(index + 2)
            }
        })
        return responses.map((response) => {
            return JSON.parse(response.getContentText()).Item as TVendorRow & {ObjectID: string}
        })
    } catch (err) {
        Logger.log(err)
        throw err
    }
}



