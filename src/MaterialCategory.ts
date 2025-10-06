// Creates a modal that the user can interact with to sort material categories into parent and sub categories
function createMaterialCategoryModal(newMaterialCategories: string[], existingParents: string[]) {
    const html = HtmlService.createTemplateFromFile('MaterialCategoryModalHTML')
    html.matCats = newMaterialCategories
    html.parentCatOptions = existingParents.concat(newMaterialCategories)
    SpreadsheetApp.getUi().showModalDialog(html.evaluate(), 'Material Categories')
}
interface IMaterialCategoryFormObject {
    name: string,
    isSubCat: boolean,
    parentCategoryName?: string
}

function onSubmitMaterialCategories(formData: IMaterialCategoryFormObject[]) {
    const parentCategories = formData.filter((eachCat) => !eachCat.isSubCat)
    const subCategories = formData.filter((eachCat) => eachCat.isSubCat)
    const { failedCategories, createdCategories } = _createMaterialCategories(parentCategories.map(each => each.name), TOKEN, BASE_URL)
    if(failedCategories.length > 0) {
        throw new Error(`An error occured created the following material categories: ${failedCategories.join(', ')}. Check the logs to view specific error codes`)
    }
    const subcategoryParentMap = new Map<string, string>();

    subCategories.forEach(subCategory => {
        subcategoryParentMap.set(subCategory.name, subCategory.parentCategoryName!)
    })
    const {failedSubcategories, createdSubcategories} = _createMaterialSubcategories(subcategoryParentMap, TOKEN, BASE_URL)
    if(failedSubcategories.length > 0) {
        throw new Error(`An error occured created the following material subcategories: ${failedSubcategories.join(', ')}. Check the logs to view specific error codes`)
    }

    const currentSpreadsheet = SpreadsheetApp.getActiveSheet().getName()
    if(currentSpreadsheet === "Vendors") {
        const vendors = getSpreadSheetData<TVendorRow>("Vendors")
        _createVendors(vendors, createdCategories, createdSubcategories, TOKEN, BASE_URL)
    }
}
function TestModal() {
    const newMaterialCategories = ['demolition', 'paving', 'chicken', "cones", "pipe", "RCP", "HDPE", "Water"]
    const parentCategories = ['asphalt', 'grading', 'other',]
    createMaterialCategoryModal(newMaterialCategories, parentCategories)
}

function _createMaterialCategories(materialCategories: string[], token: string, baseUrl: string) {
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
            if(responseCode !== 201 && responseCode !== 200 && responseCode !== 409) {
                Logger.log(`Category: "${materialCategories[index]}" failed to create with status code ${responseCode}`)
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
            const getUrl = url + `?filter=EstimateREF eq ${ESTIMATE_REF} and (Name eq '${categoriesToGet.join(' or Name eq ')}')`
            const options = {
                method: 'get' as const,
                headers,
            }
            const response = UrlFetchApp.fetch(getUrl, options);
            if(response.getResponseCode() !== 200) {
                throw new Error(`An error occured searching for Material Category IDs. Error code: ${response.getResponseCode()}`)
            }
            const responseItems = JSON.parse(response.getContentText()).Items as ICategoryItem[]
            createdCategories.push(...responseItems)
        }
    } catch (err) {
        Logger.log(err)
        throw err
    }

    return {failedCategories, createdCategories}
}

function _createMaterialSubcategories(subcategoryParentMap: Map<string,string>, token: string, baseUrl: string) {
    const url = baseUrl + "/Resources/Subcategory/MaterialSubcategory"
    const headers = createHeaders(token)
    const parentCategories = getDBCategoryList('MaterialCategory', token, baseUrl)
    const payloads: ISubcategoryItem[] = []
    const failedSubcategories: string[] = [] 
    subcategoryParentMap.forEach((value,key) => {
        const parentRef = parentCategories.find(parent => parent.Name === value)?.ObjectID
        if(!parentRef) {
            failedSubcategories.push(key)
            return
        }
        payloads.push({
            EstimateREF: ESTIMATE_REF,
            Name: key,
            CategoryREF: parentRef
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
        const responseCodes = responses.map(each => each.getResponseCode())
        
        responseCodes.forEach((code, index) => {
            if(code === 409 || code === 200) {
                Logger.log(`Material Subcategory "${payloads[index].Name}" already existed in the database.`)
            } else if (code !== 201) {
                failedSubcategories.push(payloads[index].Name)
                Logger.log(`Material Subcategory: "${payloads[index].Name}" failed to create with status code ${code}`)
            } else {
                Logger.log(`Material Subcategory: "${payloads[index].Name} successfully created`)
            }
        })
        const createdSubcategories: ISubcategoryItem[] = responses.map(response => JSON.parse(response.getContentText()).Item)
        return {failedSubcategories, createdSubcategories}
    } catch (err) {
        Logger.log(`An unexpected error occured creating material subcategories. Error: ${err}`)
        throw err
    }
}