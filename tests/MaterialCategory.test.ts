import { vi, describe, it, beforeEach, expect} from 'vitest'
import { gasRequire } from 'tgas-local'
import { mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUi, mockUrlFetchApp, mockUserProperties } from './mocks'
const mockGetDBSubcategoryList = vi.fn()
const mockGetDBCategoryList = vi.fn()
const mockGetSpreadSheetData = vi.fn()
const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger,
    PropertiesService: mockPropertiesService
}
const gLib = gasRequire('./dist', mocks)
gLib.getDBSubcategoryList = mockGetDBSubcategoryList
gLib.getDBCategoryList = mockGetDBCategoryList
gLib.getSpreadSheetData = mockGetSpreadSheetData
describe("MaterialCategory", () => {
    const ESTIMATE_REF = "00000000-0000-0000-0000-000000000000";
    const mockBaseUrl = 'https://mock.com'
    const mockToken = 'mock-token'
    const mockHeader = {
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json',
        "ConnectionString": `Server=${mockUserProperties.serverName};Database=${mockUserProperties.dbName};MultipleActiveResultSets=true;Integrated Security=SSPI;`,
        'ClientID': mockUserProperties.clientID,
        'ClientSecret': mockUserProperties.clientSecret
    }
    beforeEach(() => {
        vi.resetAllMocks()
    })
    describe("_createMaterialSubcategories", () => {
        it('exists early when there are not subcategories', () => {
            const mockSubcatParentMap: IParentSubcategoryMap[] = [];
            const {failedSubcategories, createdSubcategories} = gLib._createMaterialSubcategories(mockSubcatParentMap, mockToken, mockBaseUrl);
            expect(failedSubcategories).toHaveLength(0)
            expect(createdSubcategories).toHaveLength(0)
            expect(mockUrlFetchApp.fetchAll).not.toHaveBeenCalled() 
        })
        it('returned no failed subcategories and all created subcategories when subcategories are created successfully', () => {
            const mockSubcatParentMap: IParentSubcategoryMap[] = [
                {parentRef: 'mockParentRef1', subcategory: 'mockSubcat1'},
                {parentRef: 'mockParentRef1', subcategory: 'mockSubcat2'},
                {parentRef: 'mockParentRef2', subcategory: 'mockSubcat3'}
            ]
            const mockResponses = mockSubcatParentMap.map((each) => ({
                getResponseCode: () => 201,
                getContentText: () => JSON.stringify({ Item: each.subcategory})
            }))
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses)
            const expectedBatchOptions = mockSubcatParentMap.map((each) => ({
                url: mockBaseUrl + '/Resource/Subcategory/MaterialSubcategory',
                headers: mockHeader,
                method: 'post' as const,
                payload: JSON.stringify({
                    EstimateREF: ESTIMATE_REF,
                    Name: each.subcategory,
                    CategoryREF: each.parentRef
                }),
                muteHttpExceptions: true

            }))

            const {failedSubcategories, createdSubcategories} = gLib._createMaterialSubcategories(mockSubcatParentMap, mockToken, mockBaseUrl)
            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
            expect(mockLogger.log).nthCalledWith(1, `Material Subcategory: "${mockSubcatParentMap[0].subcategory}" successfully created`)
            expect(mockLogger.log).nthCalledWith(2, `Material Subcategory: "${mockSubcatParentMap[1].subcategory}" successfully created`)
            expect(mockLogger.log).nthCalledWith(3, `Material Subcategory: "${mockSubcatParentMap[2].subcategory}" successfully created`)

            expect(failedSubcategories).toHaveLength(0)
            expect(createdSubcategories).toHaveLength(3)
            expect(createdSubcategories[0]).toEqual(mockSubcatParentMap[0].subcategory)
            expect(createdSubcategories[1]).toEqual(mockSubcatParentMap[1].subcategory)
            expect(createdSubcategories[2]).toEqual(mockSubcatParentMap[2].subcategory)
        })
        it('should return failed subcategories when response codes are failures', () => {
            const mockSubcatParentMap: IParentSubcategoryMap[] = [
                {parentRef: 'mockParentRef1', subcategory: 'mockSubcat1'},
                {parentRef: 'mockParentRef1', subcategory: 'mockSubcat2'},
                {parentRef: 'mockParentRef2', subcategory: 'mockSubcat3'}
            ]
            const mockResponses = mockSubcatParentMap.map((_) => ({
                getResponseCode: () => 400
            }))
            const expectedBatchOptions = mockSubcatParentMap.map((each) => ({
                url: mockBaseUrl + '/Resource/Subcategory/MaterialSubcategory',
                headers: mockHeader,
                method: 'post' as const,
                payload: JSON.stringify({
                    EstimateREF: ESTIMATE_REF,
                    Name: each.subcategory,
                    CategoryREF: each.parentRef
                }),
                muteHttpExceptions: true

            }))
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses)
            const expectedFailedSubcats = ['mockSubcat1', 'mockSubcat2', 'mockSubcat3']
            const expectedFailureMessages = mockSubcatParentMap.map(each => `Material Subcategory: "${each.subcategory}" failed to create with status code 400`)
            const {failedSubcategories, createdSubcategories} = gLib._createMaterialSubcategories(mockSubcatParentMap, mockToken, mockBaseUrl)

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
            expect(failedSubcategories).toEqual(expectedFailedSubcats)
            expect(createdSubcategories).toHaveLength(0)
            expect(mockLogger.log).nthCalledWith(1, expectedFailureMessages[0])
            expect(mockLogger.log).nthCalledWith(2, expectedFailureMessages[1])
            expect(mockLogger.log).nthCalledWith(3, expectedFailureMessages[2])
        })
        it('material Subcategories that already exist in the database are properly logged and fetched from the database', () => {
        
            const mockSubcatParentMap: IParentSubcategoryMap[] = [
                {parentRef: 'mockParentRef1', subcategory: 'mockSubcat1'},
                {parentRef: 'mockParentRef1', subcategory: 'mockSubcat2'},
                {parentRef: 'mockParentRef2', subcategory: 'mockSubcat3'}
            ]
            const mockResponses = mockSubcatParentMap.map((_) => ({
                getResponseCode: () => 409
            }))
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses)
            const mockGetResponse = [{Name: 'mockSubcat1'}, {Name: 'mockSubcat2'}, {Name: 'mockSubcat3'}]
            mockGetDBSubcategoryList.mockReturnValue(mockGetResponse)
            const expectedQuery = `?$filter=EstimateREF eq ${ESTIMATE_REF} and ((Name eq 'mockSubcat1' and CategoryREF eq mockParentRef1) or (Name eq 'mockSubcat2' and CategoryREF eq mockParentRef1) or (Name eq 'mockSubcat3' and CategoryREF eq mockParentRef2))`
            
            const {failedSubcategories, createdSubcategories} = gLib._createMaterialSubcategories(mockSubcatParentMap, mockToken, mockBaseUrl)

            expect(mockLogger.log).nthCalledWith(1, 'Material Subcategory "mockSubcat1" already existed in the database.')
            expect(mockLogger.log).nthCalledWith(2, 'Material Subcategory "mockSubcat2" already existed in the database.')
            expect(mockLogger.log).nthCalledWith(3, 'Material Subcategory "mockSubcat3" already existed in the database.')

            expect(mockGetDBSubcategoryList).toHaveBeenCalledWith('MaterialSubcategory', mockToken, mockBaseUrl, expectedQuery)

            expect(failedSubcategories).toHaveLength(0)
            expect(createdSubcategories).toEqual(mockGetResponse)
        })  
    })
    describe('_createMaterialCategories', () => {
        it('exists early when there are not categories (unlikely to every happen)', () => {
            const mockCategories: string[] = [];
            const {failedCategories, createdCategories} = gLib._createMaterialCategories(mockCategories, mockToken, mockBaseUrl);
            expect(failedCategories).toHaveLength(0)
            expect(createdCategories).toHaveLength(0)
            expect(mockUrlFetchApp.fetchAll).not.toHaveBeenCalled() 
        })
        it('returned no categories and all created categories when categories are created successfully', () => {
            const mockCategories: string[] = [
                'category1',
                'category2',
                'category3'
            ]
            const mockResponses = mockCategories.map((each) => ({
                getResponseCode: () => 201,
                getContentText: () => JSON.stringify({ Item: each })
            }))
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses)
            const expectedBatchOptions = mockCategories.map((each) => ({
                url: mockBaseUrl + '/Resource/Category/MaterialCategory',
                headers: mockHeader,
                method: 'post' as const,
                payload: JSON.stringify({
                    Name: each,
                    EstimateREF: ESTIMATE_REF
                }),
                muteHttpExceptions: true
            }))

            const {failedCategories, createdCategories} = gLib._createMaterialCategories(mockCategories, mockToken, mockBaseUrl)
            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
            expect(mockLogger.log).nthCalledWith(1, `Category: "${mockCategories[0]}" successfully created.`)
            expect(mockLogger.log).nthCalledWith(2, `Category: "${mockCategories[1]}" successfully created.`)
            expect(mockLogger.log).nthCalledWith(3, `Category: "${mockCategories[2]}" successfully created.`)

            expect(failedCategories).toHaveLength(0)
            expect(createdCategories).toHaveLength(3)
            expect(createdCategories[0]).toEqual(mockCategories[0])
            expect(createdCategories[1]).toEqual(mockCategories[1])
            expect(createdCategories[2]).toEqual(mockCategories[2])
        })
        it('should return failed categories when response codes are failures', () => {
            const mockCategories: string[] = [
                'category1',
                'category2',
                'category3'
            ]
            const mockResponses = mockCategories.map((_) => ({
                getResponseCode: () => 400,
                getContentText: () => "Mock Error Message"
            }))
            const expectedBatchOptions = mockCategories.map((each) => ({
                url: mockBaseUrl + '/Resource/Category/MaterialCategory',
                headers: mockHeader,
                method: 'post' as const,
                payload: JSON.stringify({
                    Name: each,
                    EstimateREF: ESTIMATE_REF
                }),
                muteHttpExceptions: true
            }))
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses)
            const expectedFailedSubcats = ['category1', 'category2', 'category3']
            const expectedFailureMessages = mockCategories.map(each => `Category: "${each}" failed to create with status code 400. Error: Mock Error Message`)
            const {failedCategories, createdCategories} = gLib._createMaterialCategories(mockCategories, mockToken, mockBaseUrl)

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedBatchOptions)
            expect(failedCategories).toEqual(expectedFailedSubcats)
            expect(createdCategories).toHaveLength(0)
            expect(mockLogger.log).nthCalledWith(1, expectedFailureMessages[0])
            expect(mockLogger.log).nthCalledWith(2, expectedFailureMessages[1])
            expect(mockLogger.log).nthCalledWith(3, expectedFailureMessages[2])
        })
        it('material Subcategories that already exist in the database are properly logged and fetched from the database', () => {
            const mockCategories: string[] = [
                'category1',
                'category2',
                'category3'
            ]
            const mockResponses = mockCategories.map((_) => ({
                getResponseCode: () => 409
            }))
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses)
            const mockGetResponse = [{Name: 'category1'}, {Name: 'category2'}, {Name: 'category3'}]
            mockGetDBCategoryList.mockReturnValue(mockGetResponse)
            const expectedQuery = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (Name eq 'category1' or Name eq 'category2' or Name eq 'category3')`
            
            const {failedCategories, createdCategories} = gLib._createMaterialCategories(mockCategories, mockToken, mockBaseUrl)

            expect(mockLogger.log).nthCalledWith(1, 'Category: "category1" already existed in the database.')
            expect(mockLogger.log).nthCalledWith(2, 'Category: "category2" already existed in the database.')
            expect(mockLogger.log).nthCalledWith(3, 'Category: "category3" already existed in the database.')

            expect(mockGetDBCategoryList).toHaveBeenCalledWith('MaterialCategory', mockToken, mockBaseUrl, expectedQuery)

            expect(failedCategories).toHaveLength(0)
            expect(createdCategories).toEqual(mockGetResponse)
        })  
    })
    describe('CreateMaterialCategories', () => {
        gLib.authenticate = vi.fn(() => ({token: mockToken, baseUrl: mockBaseUrl}))
        gLib.getSpreadSheetData = vi.fn(() => [
            {"Material Category": 'category1', "Material Subcategory": 'subcategory1'},
            {"Material Category": 'category1', "Material Subcategory": 'subcategory2'},
            {"Material Category": 'category2', "Material Subcategory": 'subcategory3'}
        ])
        it('returns early where there is not spreadsheet data', () => {
            gLib.getSpreadSheetData.mockReturnValue([])
            gLib.CreateMaterialCategories()
            expect(mockLogger.log).toHaveBeenCalledWith('No data to send!')
            expect(mockUi.alert).toHaveBeenCalledWith('No data to send!')
        })
        it('throws when _createMaterialCategories returns with failedCategories', () => {
            gLib._createMaterialCategories = vi.fn(() => ({failedCategories: ['failedCategory1', 'failedCategory2' ], createdCategories: []}))
            expect(() => gLib.CreateMaterialCategories()).toThrowError('The following material categories failed to be created: "failedCategory1", "failedCategory2"')
        })
        it('throws when there are failed subcategories', () => {
            const mockCreatedCategories: ICategoryItem[] = [
                {EstimateREF: ESTIMATE_REF, Name: 'category1', ObjectID: 'cat1ObjectID'},
                {EstimateREF: ESTIMATE_REF, Name: 'category2', ObjectID: 'cat2ObjectID'} 
            ]
            gLib._createMaterialCategories.mockReturnValue({failedCategories: [], createdCategories: mockCreatedCategories})
            gLib._createMaterialSubcategories = vi.fn(() => ({failedSubcategories: ['subcategory1', 'subcategory2']}))
            expect(() => gLib.CreateMaterialCategories()).toThrowError('The following material subcategories failed to be created: "subcategory1", "subcategory2"')
        })
        it('alerts the user a success when all materials are created.', () => {
            const mockCreatedCategories: ICategoryItem[] = [
                {EstimateREF: ESTIMATE_REF, Name: 'category1', ObjectID: 'cat1ObjectID'},
                {EstimateREF: ESTIMATE_REF, Name: 'category2', ObjectID: 'cat2ObjectID'} 
            ]
            gLib._createMaterialCategories.mockReturnValue({failedCategories: [], createdCategories: mockCreatedCategories})
            gLib._createMaterialSubcategories = vi.fn(() => ({failedSubcategories: []}))
            gLib.CreateMaterialCategories()
            expect(mockUi.alert).toHaveBeenCalledWith("All Material Categories created successfully!")
        })
    })
})
