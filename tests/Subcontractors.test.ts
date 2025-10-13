import { vi, describe, it, beforeEach, expect, beforeAll } from 'vitest'
import gas from 'gas-local'
import { mockLogger, mockSpreadsheetApp, mockUi, mockUrlFetchApp } from './mocks'

const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger
}
const gLib = gas.require('./dist', mocks)

// --- MOCK CONSTANTS ---
const ESTIMATE_REF = "00000000-0000-0000-0000-000000000000"
const mockBaseUrl = 'https://mock.com'
const mockToken = 'mockToken'
const mockHeader = {
    'Authorization': `Bearer ${mockToken}`,
    'Content-Type': 'application/json',
}

// --- MOCK DATA ---
const mockSubcontractorRow: ISubcontractorRow = {
    Name: 'Sub One',
    City: 'Cityville',
    "Subcontractor Category": "Plumbing",
    "Work Types": "Rough-in, Finishing",
    Notes: 'Notes here'
}

const mockSubcontractorRow2: ISubcontractorRow = {
    Name: 'Sub Two',
    City: 'Townsburgh',
    "Subcontractor Category": "Electrical",
    "Work Types": "Wiring",
    Notes: 'More notes'
}

const mockCreatedSub1: ISubcontractorDTO = {
    ObjectID: 'sub-obj-id-1',
    Name: 'Sub One',
    City: 'Cityville',
    Category: 'Plumbing',
    Notes: 'Notes here'
}

const mockCreatedSub2: ISubcontractorDTO = {
    ObjectID: 'sub-obj-id-2',
    Name: 'Sub Two',
    City: 'Townsburgh',
    Category: 'Electrical',
    Notes: 'More notes'
}


describe('Subcontractors', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('_createSubcontractorCategories', () => {
        const mockCategories = ['Plumbing', 'Electrical']
        const expectedUrl = `${mockBaseUrl}/Resource/Category/SubcontractorCategory`
        const expectedBatchOptions = mockCategories.map(cat => ({
            url: expectedUrl,
            headers: mockHeader,
            method: 'post' as const,
            payload: JSON.stringify({ Name: cat, EstimateREF: ESTIMATE_REF })
        }))

        it('successfully creates categories and returns them', () => {
            mockUrlFetchApp.fetchAll.mockReturnValue([
                { getResponseCode: () => 201, getContentText: () => JSON.stringify({ Item: { Name: 'Plumbing', ObjectID: 'cat1' } }) },
                { getResponseCode: () => 201, getContentText: () => JSON.stringify({ Item: { Name: 'Electrical', ObjectID: 'cat2' } }) }
            ])

            const { failedCategories, createdCategories } = gLib._createSubcontractorCategories(mockCategories, mockToken, mockBaseUrl)

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
            expect(failedCategories).toHaveLength(0)
            expect(createdCategories).toEqual([{ Name: 'Plumbing', ObjectID: 'cat1' }, { Name: 'Electrical', ObjectID: 'cat2' }])
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor Category: "Plumbing" successfully created')
        })

        it('handles failures and returns the failed category names', () => {
            mockUrlFetchApp.fetchAll.mockReturnValue([
                { getResponseCode: () => 500, getContentText: () => 'Server Error' },
                { getResponseCode: () => 201, getContentText: () => JSON.stringify({ Item: { Name: 'Electrical', ObjectID: 'cat2' } }) }
            ])

            const { failedCategories, createdCategories } = gLib._createSubcontractorCategories(mockCategories, mockToken, mockBaseUrl)

            expect(failedCategories).toEqual(['Plumbing'])
            expect(createdCategories).toEqual([{ Name: 'Electrical', ObjectID: 'cat2' }])
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor Category: "Plumbing" failed to create with status code 500. Error: Server Error')
        })

        it('handles existing categories (409) and fetches them', () => {
            gLib.getDBCategoryList = vi.fn().mockReturnValue([{ Name: 'Plumbing', ObjectID: 'existing-cat1' }])
            mockUrlFetchApp.fetchAll.mockReturnValue([
                { getResponseCode: () => 409, getContentText: () => 'Conflict' },
                { getResponseCode: () => 201, getContentText: () => JSON.stringify({ Item: { Name: 'Electrical', ObjectID: 'cat2' } }) }
            ])

            const { failedCategories, createdCategories } = gLib._createSubcontractorCategories(mockCategories, mockToken, mockBaseUrl)

            const expectedQuery = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (Name eq 'Plumbing')`
            expect(gLib.getDBCategoryList).toHaveBeenCalledWith('SubcontractorCategory', mockToken, mockBaseUrl, expectedQuery)
            expect(failedCategories).toHaveLength(0)
            expect(createdCategories).toContainEqual({ Name: 'Plumbing', ObjectID: 'existing-cat1' })
            expect(createdCategories).toContainEqual({ Name: 'Electrical', ObjectID: 'cat2' })
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor Category: "Plumbing" already existed in the database.')
        })
    })

    describe('_createSubcontractors', () => {
        const subcontractorData = [mockSubcontractorRow, mockSubcontractorRow2]        
        it('successfully creates subcontractors', () => {
            mockUrlFetchApp.fetchAll.mockReturnValue([
                { getResponseCode: () => 201, getContentText: () => JSON.stringify({ Item: mockCreatedSub1 }) },
                { getResponseCode: () => 201, getContentText: () => JSON.stringify({ Item: mockCreatedSub2 }) }
            ])

            const { failedRows, createdSubcontractors } = gLib._createSubcontractors(subcontractorData, mockToken, mockBaseUrl)

            expect(failedRows).toHaveLength(0)
            expect(createdSubcontractors).toEqual([mockCreatedSub1, mockCreatedSub2])
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor "Sub One" successfully created')
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor "Sub Two" successfully created')
        })

        it('handles errors and returns failed row numbers', () => {
            mockUrlFetchApp.fetchAll.mockReturnValue([
                { getResponseCode: () => 400, getContentText: () => 'Bad Request' },
                { getResponseCode: () => 201, getContentText: () => JSON.stringify({ Item: mockCreatedSub2 }) }
            ])

            const { failedRows, createdSubcontractors } = gLib._createSubcontractors(subcontractorData, mockToken, mockBaseUrl)
            
            expect(failedRows).toEqual([2]) // Index 0 + 2
            expect(createdSubcontractors).toEqual([mockCreatedSub2])
            expect(mockLogger.log).toHaveBeenCalledWith('An error with code 400 occured creating subcontractor at line 2. Error: Bad Request ')
        })

        it('handles existing subcontractors (200/409) and fetches them', () => {
            gLib.getOrganization = vi.fn().mockReturnValue([mockCreatedSub1])
            mockUrlFetchApp.fetchAll.mockReturnValue([
                { getResponseCode: () => 409, getContentText: () => 'Conflict' },
                { getResponseCode: () => 201, getContentText: () => JSON.stringify({ Item: mockCreatedSub2 }) }
            ])
            
            const { failedRows, createdSubcontractors } = gLib._createSubcontractors(subcontractorData, mockToken, mockBaseUrl)
            
            const expectedQuery = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (Name eq Sub One)`
            expect(gLib.getOrganization).toHaveBeenCalledWith('Subcontractor', mockToken, mockBaseUrl, expectedQuery)
            expect(failedRows).toHaveLength(0)
            expect(createdSubcontractors).toContainEqual(mockCreatedSub1)
            expect(createdSubcontractors).toContainEqual(mockCreatedSub2)
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor "Sub One" already exists in the database.')
        })
    })

    describe('_addSubcontractorWorkTypes', () => {
        const mockPayloads: ISubconWorkTypePayload[] = [
            { OrganizationREF: 'org1', WorkTypeCategoryREF: 'wt1' },
            { OrganizationREF: 'org2', WorkTypeCategoryREF: 'wt2' }
        ]
        
        it('successfully adds work types and returns no failures', () => {
             mockUrlFetchApp.fetchAll.mockReturnValue([
                { getResponseCode: () => 201, getContentText: () => '' },
                { getResponseCode: () => 201, getContentText: () => '' }
            ])
            const failed = gLib._addSubcontractorWorkTypes(mockPayloads, mockToken, mockBaseUrl)
            expect(failed).toHaveLength(0)
            expect(mockLogger.log).toHaveBeenCalledWith('Work type with id: wt1 added to organization with id: org1')
        })

        it('returns failed payloads on error', () => {
            mockUrlFetchApp.fetchAll.mockReturnValue([
               { getResponseCode: () => 500, getContentText: () => 'Error' },
               { getResponseCode: () => 201, getContentText: () => '' }
           ])
           const failed = gLib._addSubcontractorWorkTypes(mockPayloads, mockToken, mockBaseUrl)
           expect(failed).toEqual([mockPayloads[0]])
           expect(mockLogger.log).toHaveBeenCalledWith(`An error occured adding work type with id: wt1 to subcontractor with id org1. Code: 500. Error: Error`)
       })
    })

    // Note: _addSubcontractorSubWorkTypes is nearly identical to _addSubcontractorWorkTypes,
    // so tests would follow the same pattern, just with different property names and log messages.

    describe('CreateSubcontractors', () => {
        // Mock all dependencies of the main function
        beforeAll(() => {
            gLib.authenticate = vi.fn(() => ({ token: mockToken, baseUrl: mockBaseUrl }))
            gLib.getSpreadSheetData = vi.fn()
            gLib._createSubcontractorCategories = vi.fn()
            gLib._createSubcontractors = vi.fn()
            gLib.highlightRows = vi.fn()
            gLib.getDBCategoryList = vi.fn()
            gLib.getDBSubcategoryList = vi.fn()
            gLib._addSubcontractorWorkTypes = vi.fn()
            gLib._addSubcontractorSubWorkTypes = vi.fn()
        })

        it('exits early if no spreadsheet data is found', () => {
            gLib.getSpreadSheetData.mockReturnValue([])
            
            gLib.CreateSubcontractors()

            expect(mockLogger.log).toHaveBeenCalledWith('No data to send!')
            expect(mockUi.alert).toHaveBeenCalledWith('No data to send!')
            expect(gLib._createSubcontractors).not.toHaveBeenCalled()
        })

        it('throws an error if subcontractor category creation fails', () => {
            gLib.getSpreadSheetData.mockReturnValue([mockSubcontractorRow])
            gLib._createSubcontractorCategories.mockReturnValue({ failedCategories: ['Plumbing'], createdCategories: [] })

            expect(() => gLib.CreateSubcontractors()).toThrow('Script failed while creating the following subcontractor categories: Plumbing')
        })

        it('highlights rows and alerts if subcontractor creation fails', () => {
            gLib.getSpreadSheetData.mockReturnValue([mockSubcontractorRow])
            gLib._createSubcontractorCategories.mockReturnValue({ failedCategories: [], createdCategories: [] })
            gLib._createSubcontractors.mockReturnValue({ failedRows: [2], createdSubcontractors: [] })
            gLib.getDBCategoryList.mockReturnValue([])
            gLib.getDBSubcategoryList.mockReturnValue([])

            expect(() => gLib.CreateSubcontractors()).toThrowError('Some rows failed to be created. Failed Rows: 2')
            
            expect(gLib.highlightRows).toHaveBeenCalledWith([2], 'red')
        })

        it('runs the full process successfully', () => {
            gLib.getSpreadSheetData.mockReturnValue([mockSubcontractorRow])
            gLib._createSubcontractorCategories.mockReturnValue({ failedCategories: [], createdCategories: [] })
            gLib._createSubcontractors.mockReturnValue({ failedRows: [], createdSubcontractors: [mockCreatedSub1] })
            // Mock DB fetches for work types
            gLib.getDBCategoryList.mockReturnValue([{ Name: "Rough-in", ObjectID: 'wt-id-1' }]) // WorkType
            gLib.getDBSubcategoryList.mockReturnValue([{ Name: "Finishing", ObjectID: 'wst-id-1' }]) // WorkSubType
            // Mock final add steps
            gLib._addSubcontractorWorkTypes.mockReturnValue([])
            gLib._addSubcontractorSubWorkTypes.mockReturnValue([])

            gLib.CreateSubcontractors()

            // Verify payload creation for linking work types
            const expectedWorkTypePayload = [{
                OrganizationREF: 'sub-obj-id-1',
                WorkTypeCategoryREF: 'wt-id-1'
            }]
            const expectedWorkSubTypePayload = [{
                OrganizationREF: 'sub-obj-id-1',
                WorkSubtypeCategoryREF: 'wst-id-1'
            }]

            expect(gLib._addSubcontractorWorkTypes).toHaveBeenCalledWith(expectedWorkTypePayload, mockToken, mockBaseUrl)
            expect(gLib._addSubcontractorSubWorkTypes).toHaveBeenCalledWith(expectedWorkSubTypePayload, mockToken, mockBaseUrl)
            expect(mockUi.alert).toHaveBeenCalledWith('All subcontractors created successfully!')
        })
    })
})
