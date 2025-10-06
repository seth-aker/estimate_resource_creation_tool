interface IMaterialRow {
    "UM System": "Imperial" | "Metric"
    Name: string,
    Category?: string,
    Subcategory?: string,
    "Unit of Measure": string,
    BaseCost?: number,
    IsTemporaryMaterial?: boolean,
    TaxPercent?: number,
    WastePercent?: number,
    JobCostIDCode?: string,
    Notes?: string,
    ShouldRoundQuantity?: boolean,
    QuantityRoundingIncrement?: number,
}
function CreateMaterials() {
    authenticate()
    const materialData = getSpreadSheetData<IMaterialRow>("Materials")
    if(!materialData || materialData.length === 0) {
        Logger.log("No data to send!");
        SpreadsheetApp.getUi().alert('No data to send!');
        return;
    }
    const materialCategories = materialData.map(each => each.Category?.trim()).filter(each => each !== undefined)
    const materialSubcategories = materialData.map(each => each.Subcategory?.trim()).filter(each => each !== undefined)

    const uniqueMaterialCategories = Array.from(new Set(materialCategories))
    const uniqueMaterialSubcategories = Array.from(new Set(materialSubcategories))

    const existingMaterialCategories = getDBCategoryList("MaterialCategory", TOKEN, BASE_URL, `?$filter=EstimateREF eq ${ESTIMATE_REF}`)
    const existingCategoryNames = existingMaterialCategories.map(each => each.Name)
    const existingMaterialSubcategories = getDBSubcategoryList("MaterialSubcategory", TOKEN, BASE_URL, `?$filter=EstimateREF eq ${ESTIMATE_REF}`)
    const existingMaterialSubcategorNames = existingMaterialSubcategories.map(each => each.Name)
   
    const categoriesToCreate = uniqueMaterialCategories.filter((category) => existingCategoryNames.includes(category))
    const {failedCategories, createdCategories} = _createMaterialCategories(categoriesToCreate, TOKEN, BASE_URL)
    if(failedCategories.length > 0) {
        throw new Error(`The following categories failed to be created: ${failedCategories.join(', ')}`)
    }

    const subParentRefMap = new Map<string, string>()
    const parentCategories = [...existingMaterialCategories, ...createdCategories]
    
    const subCategoriesToCreate = uniqueMaterialSubcategories.filter((subcategory) => existingMaterialSubcategorNames.includes(subcategory))
    subCategoriesToCreate.forEach((category) => {
        const parentRef = 
    })


}