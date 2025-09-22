function onEdit(e: GoogleAppsScript.Events.SheetsOnEdit) {
    // Map of sheet names and the column this function watches
    const SHEET_COLUMN_MAP = new Map([['Subcontractors', 13]])
    const range = e.range
    const editedSheet = range.getSheet()

    if(!SHEET_COLUMN_MAP.has(editedSheet.getName()) || range.getColumn() !== SHEET_COLUMN_MAP.get(editedSheet.getName())) {
        return
    }
    const cellValue = e.value
    if(!cellValue) return

    // Build a lookup map of {subtype: parent}
    const workTypesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Work Types')
    const workTypes = workTypesSheet?.getRange(`A2:B${workTypesSheet.getLastRow()}`).getValues();
    const lookupMap = new Map(workTypes?.map(row => [row[1], row[0]]))
    
    let selectedWorkTypes = new Set(cellValue.split(',').map((item => item.trim())))
    let workTypesToAdd = new Set<string>();

    selectedWorkTypes.forEach(item => {
        if(lookupMap.has(item)) {
            workTypesToAdd.add(lookupMap.get(item))
        }
    });
    if(workTypesToAdd.size === 0) {
        return
    }
    workTypesToAdd.forEach(workType => selectedWorkTypes.add(workType))
    const finalValue = Array.from(selectedWorkTypes).sort().join(', ')

    // Prevent infinite loops
    if(finalValue !== range.getValue()) {
        range.setValue(finalValue)
    }
}