type TSystemOfMeasure = "Imperial" | "Metric"
interface IMaterialRow {
    "UM System": TSystemOfMeasure
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
    TruckingCost?: number
}
interface IMaterialDTO extends Omit<IMaterialRow, 'UM System' & 'Unit of Measure'> {
    ObjectID?: string
    EstimateREF: string
    ImperialUnitOfMeasure: string | number,
    MetricUnitOfMeasure: string | number,
    BaseCostSystemOfMeasure?: TSystemOfMeasure
    TruckingCostSystemOfMeasure?: TSystemOfMeasure
    QuantityRoundingIncrementSystemOfMeasure?: TSystemOfMeasure
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

    const uniqueMaterialCategories = Array.from(new Set(materialCategories))

    const existingMaterialCategories = getDBCategoryList("MaterialCategory", TOKEN, BASE_URL, `?$filter=EstimateREF eq ${ESTIMATE_REF}`)
    const existingCategoryNames = existingMaterialCategories.map(each => each.Name)

    const categoriesToCreate = uniqueMaterialCategories.filter((category) => !existingCategoryNames.includes(category))
    const {failedCategories} = _createMaterialCategories(categoriesToCreate, TOKEN, BASE_URL)
    if(failedCategories.length > 0) {
        throw new Error(`The following categories failed to be created: ${failedCategories.join(', ')}. See logs for more details`)
    }

    const parentSubcategoryList: IParentSubcategoryMap[] = []
    // add all unique parent - subcat combinations
    materialData.forEach((row) => {
        if(row.Category && row.Subcategory && !deepIncludes(parentSubcategoryList, {parent: row.Category, sub: row.Subcategory})) {
           parentSubcategoryList.push({parent: row.Category, sub: row.Subcategory})
        }
    })
    const {failedSubcategories} = _createMaterialSubcategories(parentSubcategoryList, TOKEN, BASE_URL)
    if(failedSubcategories.length > 0) {
        throw new Error(`The following subcategories failed to be created: ${failedSubcategories.join(', ')}. See logs for more detail`)
    }
    const materialsToCreate = materialData.map((row) => createMaterialDTO(row))
    const {failedMaterials} = _createMaterials(materialsToCreate, TOKEN, BASE_URL)

    if(failedMaterials.length > 0) {
        highlightRows(failedMaterials, 'red')
        SpreadsheetApp.getUi().alert(`Some materials failed to be created at Rows: ${failedMaterials.join(", ")}`)
    } else {
        SpreadsheetApp.getUi().alert("All materials successfully created!")
    }
}

function _createMaterials(materials: IMaterialDTO[], token: string, baseUrl: string) {
    const url = baseUrl + `/Resource/Material`
    const headers = createHeaders(token)
    const batchOptions = materials.map((material) => ({
        url,
        headers,
        method: 'post' as const,
        payload: JSON.stringify(material)
    }))
    const failedMaterials: number[] = [] 
    const createdMaterials: IMaterialDTO[] = []
    try {
        const responses = UrlFetchApp.fetchAll(batchOptions)
        responses.forEach((response, index) => {
            const responseCode = response.getResponseCode()
            if(responseCode >= 400 && responseCode !== 409) {
                failedMaterials.push(index + 2)
                Logger.log(`Material "${materials[index].Name}" failed with status code: ${responseCode}. Error Message: ${response.getContentText()}`)
            } 
            else if(responseCode === 409 || responseCode === 200) {
                Logger.log(`Material "${materials[index].Name}" already existed in the database.`)
            }
            else {
                Logger.log(`Material "${materials[index].Name}" successfully created.`)
                createdMaterials.push(JSON.parse(response.getContentText()) as IMaterialDTO)
            }
        })
        return {failedMaterials, createdMaterials}
    } catch (err) {
        Logger.log(`An unexpected error occurred: Error: ${err}`)
        throw new Error(`An unexpected error occurred created materials. Please check the logs for more details`)
    }
}

function createMaterialDTO(materialRow: IMaterialRow) {
    const umSystem = materialRow["UM System"]
    let impUM: string | number
    let metricUM: string | number
    if(umSystem === 'Imperial') {
        impUM = UMS[umSystem][materialRow["Unit of Measure"]]
        // If the conversion object has the UM key from "material row", then return the abbreviation of the metric UM that is associated with the imperial unit
        // Else return the UM in the material row 
        metricUM = Object.keys(UMS['imp_to_metric']).includes(materialRow["Unit of Measure"]) ? UMS['Metric'][UMS['imp_to_metric'][materialRow["Unit of Measure"]]] : UMS['Imperial'][materialRow["Unit of Measure"]]
    } else {
        // Do the opposite as above
        impUM = Object.keys(UMS['metric_to_imp']).includes(materialRow["Unit of Measure"]) ? UMS['Imperial'][UMS['metric_to_imp'][materialRow["Unit of Measure"]]] : UMS['Metric'][materialRow['Unit of Measure']]
        metricUM = UMS[umSystem][materialRow["Unit of Measure"]]
    }
    return {
        EstimateREF: ESTIMATE_REF,
        Name: materialRow.Name,
        Category: materialRow.Category,
        Subcategory: materialRow.Subcategory,
        ImperialUnitOfMeasure: impUM,
        MetricUnitOfMeasure: metricUM,
        BaseCost: materialRow.BaseCost,
        BaseCostSystemOfMeasure: umSystem,
        IsTemporaryMaterial: materialRow.IsTemporaryMaterial,
        TaxPercent: materialRow.TaxPercent,
        WastePercent: materialRow.WastePercent,
        TruckingCost: materialRow.TruckingCost,
        TruckingCostSystemOfMeasure: umSystem,
        JobCostIDCode: materialRow.JobCostIDCode,
        Notes: materialRow.Notes,
        ShouldRoundQuantity: materialRow.ShouldRoundQuantity,
        QuantityRoundingIncrement: materialRow.QuantityRoundingIncrement,
        QuantityRoundingIncrementSystemOfMeasure: umSystem
    } as IMaterialDTO
}