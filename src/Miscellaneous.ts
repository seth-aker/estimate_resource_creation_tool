interface IMiscRow {
  Name: string,
  UM: string,
  Notes?: string,
  JobCostIDCode?: string,
  MiscellaneousCategory?: string,
  UnitCost?: number,
}
interface IMiscDTO {
  Name: string,
  EstimateREF?: string,
  ObjectID?: string,
  Notes?: string,
  JobCostIDCode?: string,
  ImperialUnitOfMeasure: string,
  MetricUnitOfMeasure: string,
  MiscellaneousCategory?: string,
  UnitCost?: number,
  UnitCostSystemOfMeasure?: string
}
function AskForMiscSystemOfMeasure() {
   const html = HtmlService.createHtmlOutputFromFile('MiscSystemOfMeasureModal')
    SpreadsheetApp.getUi().showModalDialog(html, "Select System of Measure")
}
function CreateMiscellaneous(systemOfMeasure: TSystemOfMeasure) {
  const { token, baseUrl } = authenticate()
  const miscRows = getSpreadSheetData<IMiscRow>('Miscellaneous')

  if(!miscRows || miscRows.length === 0) {
    Logger.log("CreateMiscellaneous() failed to run because there was no data to send.");
    SpreadsheetApp.getUi().alert('No data to send!');
    return;
  }
  // const miscCategories = miscRows.map(row => row.MiscellaneousCategory)
  // const failedRows = _createMiscCategories(miscCategories, token, baseUrl)
  const dtos = miscRows.map(row => {
    return createMiscDTOFromRow(row, systemOfMeasure)
  })
  const failedRows = _createMiscellaneous(dtos, token, baseUrl)
  if(failedRows.length > 0) {
    highlightRows(failedRows, 'red')
    SpreadsheetApp.getUi().alert(`Some rows failed to be created: ${failedRows.join(", ")}`)
  } else {
    SpreadsheetApp.getUi().alert('All rows successfully created!')
  }
}
// function _createMiscCategories(categories: string[], token: string, baseUrl: string) {
//   const failedRows: number[] = []
//   if(categories.length === 0) {
//     return failedRows
//   }
//   const batchOptions = categories.map(category => ({
//     url: `${baseUrl}/Resources/`
//   }))
//   try {
//     const responses = 
//   } catch (err) {
//   }
// }
function _createMiscellaneous(miscellaneous: IMiscDTO[], token: string, baseUrl: string) {
  const failedRows: number[] = []
  const batchOptions = miscellaneous.map(misc => ({
    url: `${baseUrl}/Resource/Miscellaneous`,
    headers: createHeaders(token),
    method: 'post' as const,
    payload: JSON.stringify(misc),
    muteHttpExceptions: true
  }))
  try {
    const responses = UrlFetchApp.fetchAll(batchOptions)
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode()
      if(responseCode >= 400 && responseCode !== 409) {
        Logger.log(`Row ${index + 2}: Miscellaneous Item "${miscellaneous[index].Name}" failed to be created. Error: ${response.getContentText()}`)
        failedRows.push(index + 2)
      } else if (responseCode === 409 || responseCode === 200) {
        Logger.log(`Row ${index + 2}: Miscellaneous Item: "${miscellaneous[index].Name}" already existed in the database`)
      } else {
        Logger.log(`Row ${index + 2}: Miscellaneous Item: "${miscellaneous[index].Name}" created successfully`)
      }
    })
    return failedRows
  } catch (err) {
    Logger.log(err)
    throw new Error('An unexpected error occured creating miscellaneous items. See logs for more details.')
  }
}
function createMiscDTOFromRow(row: IMiscRow, systemOfMeasure: TSystemOfMeasure) {
  const {UM, ...rest} = row
  let impUM: string 
  let metricUM: string
  if(systemOfMeasure === 'Imperial') {
      impUM = UM
      // If the conversion object has the UM key from "material row", then return the abbreviation of the metric UM that is associated with the imperial unit
      // Else return the UM in the material row 
      metricUM = Object.keys(SYS_OF_MEASURE_CONVERSION.imp_to_metric).includes(UM) ? SYS_OF_MEASURE_CONVERSION.imp_to_metric[UM] : UM;
  } else {
      // Do the opposite as above
      metricUM = UM;
      impUM = Object.keys(SYS_OF_MEASURE_CONVERSION.metric_to_imp).includes(UM) ? SYS_OF_MEASURE_CONVERSION.metric_to_imp[UM] : UM
  }
  return {
    ImperialUnitOfMeasure: impUM,
    MetricUnitOfMeasure: metricUM,
    UnitCostSystemOfMeasure: systemOfMeasure,
    ...rest
  } as IMiscDTO
}
