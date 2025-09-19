function CreateSubcontractors() {
    const {token, baseUrl} = authenticate()
    const subcontractorData = getSpreadSheetData('Subcontractors');
    if (!subcontractorData || subcontractorData.length === 0) {
        Logger.log("No data to send!");
        SpreadsheetApp.getUi().alert('No data to send!');
        return;
  }
  _createSubcontractors(subcontractorData, token, baseUrl)
}

function _createSubcontractors(subcontractorData: Row[], token: string, baseUrl: string) {
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
    const existingSubcontractorCategories = _getSubcontractorCategories(token, baseUrl)
    const existingCategoryNames = existingSubcontractorCategories.map(each => each.Name)
    const categoriesInSpreadsheet = subcontractorData.map((row) => row['Subcontractor Category'] as string);
    const categoriesToCreate = categoriesInSpreadsheet.filter((each) => !existingCategoryNames.includes(each))

  

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
            
        } catch (err) {

        }
    })
}