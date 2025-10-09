type TSystemOfMeasure = "imperial" | "metric"
interface IMaterialRow {
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
function AskForSystemUM() {
    const html = HtmlService.createTemplateFromFile('MaterialSettingsModal')
    SpreadsheetApp.getUi().showModalDialog(html.evaluate(), "Select System of Measure")
}
function CreateMaterials(systemOfMeasure: TSystemOfMeasure) {
    authenticate()
    const materialData = getSpreadSheetData<IMaterialRow>("Materials")
    if(!materialData || materialData.length === 0) {
        Logger.log("No data to send!");
        SpreadsheetApp.getUi().alert('No data to send!');
        return;
    }
    const materialsToCreate = materialData.map((row) => createMaterialDTO(row, systemOfMeasure))
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

function createMaterialDTO(materialRow: IMaterialRow, systemOfMeasure: TSystemOfMeasure) {
    const um = materialRow["Unit of Measure"]
    let impUM: string 
    let metricUM: string
    if(systemOfMeasure === 'imperial') {
        impUM = um
        // If the conversion object has the UM key from "material row", then return the abbreviation of the metric UM that is associated with the imperial unit
        // Else return the UM in the material row 
        metricUM = Object.keys(SYS_OF_MEASURE_CONVERSION.imp_to_metric).includes(um) ? SYS_OF_MEASURE_CONVERSION.imp_to_metric[um] : um;
    } else {
        // Do the opposite as above
        metricUM = um;
        impUM = Object.keys(SYS_OF_MEASURE_CONVERSION.metric_to_imp).includes(um) ? SYS_OF_MEASURE_CONVERSION.metric_to_imp[um] : um
    }
    return {
        EstimateREF: ESTIMATE_REF,
        Name: materialRow.Name,
        Category: materialRow.Category,
        Subcategory: materialRow.Subcategory,
        ImperialUnitOfMeasure: impUM,
        MetricUnitOfMeasure: metricUM,
        BaseCost: materialRow.BaseCost,
        BaseCostSystemOfMeasure: systemOfMeasure,
        IsTemporaryMaterial: materialRow.IsTemporaryMaterial,
        TaxPercent: materialRow.TaxPercent,
        WastePercent: materialRow.WastePercent,
        TruckingCost: materialRow.TruckingCost,
        TruckingCostSystemOfMeasure: systemOfMeasure,
        JobCostIDCode: materialRow.JobCostIDCode,
        Notes: materialRow.Notes,
        ShouldRoundQuantity: materialRow.ShouldRoundQuantity,
        QuantityRoundingIncrement: materialRow.QuantityRoundingIncrement,
        QuantityRoundingIncrementSystemOfMeasure: systemOfMeasure
    } as IMaterialDTO
}