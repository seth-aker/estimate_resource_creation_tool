interface IParentSubcategoryMap {
    parentRef: string,
    subcategory: string
}
interface IMaterialCategoryRow {
    'Material Category': TSpreadsheetValues,
    'Material Subcategory': TSpreadsheetValues
}

function CreateMaterialCategories() {
    authenticate();
    const materialData = getSpreadSheetData<IMaterialCategoryRow>('Material Categories')
    if(!materialData || materialData.length === 0) {
        Logger.log("No data to send!");
        SpreadsheetApp.getUi().alert('No data to send!');
        return;
    }
    const parentCategories = materialData.map((row) => row["Material Category"].toString())
   
    const {failedCategories, createdCategories} = _createMaterialCategories(parentCategories, TOKEN, BASE_URL)
    if(failedCategories.length > 0) {
        throw new Error(`The following material categories failed to be created: "${failedCategories.join(`", "`)}"`)
    }
    const parentSubcategoryMap: IParentSubcategoryMap[] = []
     materialData.forEach((row => {
        const parentRef = createdCategories.find((category) => category.Name === row["Material Category"])?.ObjectID as string
        const subcategory = row["Material Subcategory"].toString();
        if(!parentRef || !subcategory) {
            return
        }
        const map = {
            parentRef,
            subcategory 
        }
        if(!deepIncludes(parentSubcategoryMap, map)) {
            parentSubcategoryMap.push(map)
        }
    }))
    const {failedSubcategories} = _createMaterialSubcategories(parentSubcategoryMap, TOKEN, BASE_URL)
    if(failedSubcategories.length > 0) {
        throw new Error(`The following material subcategories failed to be created: "${failedSubcategories.join('", "')}"`)
    } else {
        SpreadsheetApp.getUi().alert(`All Material Categories created successfully!`)
    }
}
function _createMaterialCategories(materialCategories: string[], token: string, baseUrl: string) {
    if(materialCategories.length === 0) {
        return {failedCategories: [], createdCategories: []}
    }
    const url = baseUrl + '/Resource/Category/MaterialCategory'
    const headers = createHeaders(token)
    const failedCategories: string[] = []
    const createdCategories: ICategoryItem[] = []
    const categoriesToGet: string[] = []

    const batchOptions = materialCategories.map((categoryName) => {
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
                Logger.log(`Category: "${materialCategories[index]}" failed to create with status code ${responseCode}. Error: ${response.getContentText()}`)
                failedCategories.push(materialCategories[index])

                // If entity already exists, we will need to fetch its information
            } else if (responseCode === 200 || responseCode === 409) {
                Logger.log(`Category: "${materialCategories[index]}" already existed in the database.`)
                categoriesToGet.push(materialCategories[index])
            } else {
                Logger.log(`Category: "${materialCategories[index]}" successfully created.`)
                createdCategories.push(JSON.parse(response.getContentText()).Item)
            }
        })
        if(categoriesToGet.length > 0) {
            const query = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (Name eq '${categoriesToGet.join("' or Name eq '")}')`
            const responseItems = getDBCategoryList('MaterialCategory', token, baseUrl, query)
            createdCategories.push(...responseItems)
        }
    } catch (err) {
        Logger.log(err)
        throw new Error(`An unexpected error occured, please try again.`)
    }

    return {failedCategories, createdCategories}
}

function _createMaterialSubcategories(subcategoryParentMap: IParentSubcategoryMap[], token: string, baseUrl: string) {
    if(subcategoryParentMap.length === 0) {
        return {failedSubcategories: [], createdSubcategories: []}
    }
    const url = baseUrl + "/Resource/Subcategory/MaterialSubcategory"
    const headers = createHeaders(token)
    const payloads: ISubcategoryItem[] = []
    const failedSubcategories: string[] = [] 
    subcategoryParentMap.forEach((each) => {
        payloads.push({
            EstimateREF: ESTIMATE_REF,
            Name: each.subcategory,
            CategoryREF: each.parentRef
        })
    })
    const batchOptions = payloads.map(payload => ({
        url,
        headers,
        method: 'post' as const,
        payload: JSON.stringify(payload)
    }))

    try {
        const responses = UrlFetchApp.fetchAll(batchOptions)
        const materialSubcategoriesToFetch: ISubcategoryItem[] = []
        const createdSubcategories: ISubcategoryItem[] = [];
        responses.forEach((response, index) => {
            const code = response.getResponseCode()
            if(code === 409 || code === 200) {
                materialSubcategoriesToFetch.push(payloads[index])
                Logger.log(`Material Subcategory "${payloads[index].Name}" already existed in the database.`)
            } else if (code !== 201) {
                failedSubcategories.push(payloads[index].Name)
                Logger.log(`Material Subcategory: "${payloads[index].Name}" failed to create with status code ${code}`)
            } else {
                createdSubcategories.push(JSON.parse(response.getContentText()).Item)
                Logger.log(`Material Subcategory: "${payloads[index].Name}" successfully created`)
            }
        })
        if(materialSubcategoriesToFetch.length > 0) {
            const query = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (${materialSubcategoriesToFetch.map(each => `(Name eq '${each.Name}' and CategoryREF eq ${each.CategoryREF})`).join(" or ")})`
            const responses = getDBSubcategoryList('MaterialSubcategory', token, baseUrl, query)
            createdSubcategories.push(...responses)
        }
        return {failedSubcategories, createdSubcategories}
    } catch (err) {
        Logger.log(`An unexpected error occured creating material subcategories. Error: ${err}`)
        throw err
    }
}