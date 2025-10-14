import { vi, describe, it, beforeEach, expect, beforeAll} from 'vitest'
import gas from 'gas-local'
import { mockLogger, mockPropertiesService, mockSpreadsheetApp, mockUi, mockUrlFetchApp, mockUserProperties } from './mocks'

const mockGetDBCategoryList = vi.fn()
const mockGetDBSubcategoryList = vi.fn()
const mockGetOrganization = vi.fn()

const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger,
    PropertiesService: mockPropertiesService
}
const gLib = gas.require('./dist', mocks)
gLib.getDBCategoryList = mockGetDBCategoryList
gLib.getDBSubcategoryList = mockGetDBSubcategoryList
gLib.getOrganization = mockGetOrganization


describe("Subcontractors", () => {
    const ESTIMATE_REF = "00000000-0000-0000-0000-000000000000";
    const mockBaseUrl = 'https://mock.com'
    const mockToken = 'mock-token' 
    const mockHeader = {
        'Authorization': `Bearer ${mockToken}`,
        'Content-Type': 'application/json',
        'ClientID': mockUserProperties.clientID,
        'ClientSecret': mockUserProperties.clientSecret,
        "ConnectionString": `Server=${mockUserProperties.serverName};Database=${mockUserProperties.dbName};MultipleActiveResultSets=true;Integrated Security=SSPI;`
    }

    beforeEach(() => {
        vi.resetAllMocks()
    })

    describe("_createSubcontractorCategories", () => {
        it('should create categories successfully', () => {
            const categories = ['Cat1', 'Cat2'];
            const mockResponses = categories.map(cat => ({
                getResponseCode: () => 201,
                getContentText: () => JSON.stringify({ Item: { Name: cat } })
            }));
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses);

            const expectedOptions = categories.map(cat => ({
                url: mockBaseUrl + '/Resource/Category/SubcontractorCategory',
                method: 'post',
                headers: mockHeader,
                payload: JSON.stringify({ Name: cat, EstimateREF: ESTIMATE_REF }),
                muteHttpExceptions: true
            }));

            const { failedCategories, createdCategories } = gLib._createSubcontractorCategories(categories, mockToken, mockBaseUrl);

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedOptions);
            expect(failedCategories).toHaveLength(0);
            const expectedCategories = [{ Name: 'Cat1' }, { Name: 'Cat2' }];
            expect(createdCategories).toEqual(expectedCategories);
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor Category: "Cat1" successfully created');
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor Category: "Cat2" successfully created');
        });

        it('should handle failed category creation', () => {
            const categories = ['Cat1', 'Cat2'];
            const mockResponses = categories.map(() => ({
                getResponseCode: () => 400,
                getContentText: () => 'Error'
            }));
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses);
            const expectedOptions = categories.map(cat => ({
                url: mockBaseUrl + '/Resource/Category/SubcontractorCategory',
                method: 'post',
                headers: mockHeader,
                payload: JSON.stringify({ Name: cat, EstimateREF: ESTIMATE_REF }),
                muteHttpExceptions: true
            }));

            const { failedCategories, createdCategories } = gLib._createSubcontractorCategories(categories, mockToken, mockBaseUrl);

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedOptions);
            expect(failedCategories).toEqual(categories);
            expect(createdCategories).toHaveLength(0);
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor Category: "Cat1" failed to create with status code 400. Error: Error');
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor Category: "Cat2" failed to create with status code 400. Error: Error');
        });

        it('should handle existing categories', () => {
            const categories = ['Cat1', 'Cat2'];
            const mockResponses = categories.map(() => ({
                getResponseCode: () => 409
            }));
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses);
            const expectedCategories = [{ Name: 'Cat1' }, { Name: 'Cat2' }];
            mockGetDBCategoryList.mockReturnValue(expectedCategories);
             const expectedOptions = categories.map(cat => ({
                url: mockBaseUrl + '/Resource/Category/SubcontractorCategory',
                method: 'post',
                headers: mockHeader,
                payload: JSON.stringify({ Name: cat, EstimateREF: ESTIMATE_REF }),
                muteHttpExceptions: true
            }));

            const { failedCategories, createdCategories } = gLib._createSubcontractorCategories(categories, mockToken, mockBaseUrl);

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedOptions);
            expect(failedCategories).toHaveLength(0);
            expect(createdCategories).toEqual(expectedCategories);
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor Category: "Cat1" already existed in the database.');
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor Category: "Cat2" already existed in the database.');
            expect(mockGetDBCategoryList).toHaveBeenCalled();
        });
    });

    describe('_createSubcontractors', () => {
        const subData = [{ Name: 'Sub1', City: 'City1', "Work Types": "Type1", "Subcontractor Category": "CatA" }, { Name: 'Sub2', City: 'City2', "Work Types": "Type2" }];
        const expectedSubcontractors = [{ Name: 'Sub1' }, { Name: 'Sub2' }];

        it('should create subcontractors successfully', () => {
            const mockResponses = subData.map(sub => ({
                getResponseCode: () => 201,
                getContentText: () => JSON.stringify({ Item: { Name: sub.Name } })
            }));
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses);
            const expectedOptions = [
                {
                    url: mockBaseUrl + '/Resource/Organization/Subcontractor',
                    method: 'post',
                    headers: mockHeader,
                    payload: JSON.stringify({ Name: 'Sub1', City: 'City1', Category: 'CatA' }),
                    muteHttpExceptions: true
                },
                {
                    url: mockBaseUrl + '/Resource/Organization/Subcontractor',
                    method: 'post',
                    headers: mockHeader,
                    payload: JSON.stringify({ Name: 'Sub2', City: 'City2' }),
                    muteHttpExceptions: true
                }
            ]

            const { failedRows, createdSubcontractors } = gLib._createSubcontractors(subData, mockToken, mockBaseUrl);

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedOptions);
            expect(failedRows).toHaveLength(0);
            expect(createdSubcontractors).toEqual(expectedSubcontractors);
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor "Sub1" successfully created');
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor "Sub2" successfully created');
        });

        it('should handle failed subcontractor creation', () => {
            const mockResponses = subData.map(() => ({
                getResponseCode: () => 500,
                getContentText: () => 'Server Error'
            }));
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses);

            const { failedRows, createdSubcontractors } = gLib._createSubcontractors(subData, mockToken, mockBaseUrl);

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalled();
            expect(failedRows).toEqual([2, 3]);
            expect(createdSubcontractors).toHaveLength(0);
            expect(mockLogger.log).toHaveBeenCalledWith('An error with code 500 occured creating subcontractor at line 2. Error: Server Error ');
            expect(mockLogger.log).toHaveBeenCalledWith('An error with code 500 occured creating subcontractor at line 3. Error: Server Error ');
        });

        it('should fetch existing subcontractors', () => {
            const mockResponses = subData.map(sub => ({
                getResponseCode: () => 409,
                 getContentText: () => JSON.stringify({ Item: { Name: sub.Name } })
            }));
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses);
            mockGetOrganization.mockReturnValue(expectedSubcontractors);

            const { failedRows, createdSubcontractors } = gLib._createSubcontractors(subData, mockToken, mockBaseUrl);

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalled();
            expect(failedRows).toHaveLength(0);
            expect(createdSubcontractors).toEqual(expectedSubcontractors);
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor "Sub1" already exists in the database.');
            expect(mockLogger.log).toHaveBeenCalledWith('Subcontractor "Sub2" already exists in the database.');
            expect(mockGetOrganization).toHaveBeenCalled();
        });
    });

    describe('_addSubcontractorWorkTypes', () => {
        const workTypePayloads = [
            { OrganizationREF: 'org1', WorkTypeCategoryREF: 'wt1' },
            { OrganizationREF: 'org2', WorkTypeCategoryREF: 'wt2' }
        ];

        it('should add work types successfully', () => {
            const mockResponses = workTypePayloads.map(() => ({
                getResponseCode: () => 201
            }));
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses);
            const expectedOptions = workTypePayloads.map(payload => ({
                url: mockBaseUrl + '/Resource/Organization/OrganizationWorkType',
                method: 'post',
                headers: mockHeader,
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            }));

            const failed = gLib._addSubcontractorWorkTypes(workTypePayloads, mockToken, mockBaseUrl);

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedOptions);
            expect(failed).toHaveLength(0);
            expect(mockLogger.log).toHaveBeenCalledWith('Work type with id: wt1 added to organization with id: org1');
            expect(mockLogger.log).toHaveBeenCalledWith('Work type with id: wt2 added to organization with id: org2');
        });

        it('should handle failures when adding work types', () => {
            const mockResponses = workTypePayloads.map(() => ({
                getResponseCode: () => 400,
                getContentText: () => 'Error'
            }));
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses);
            const expectedOptions = workTypePayloads.map(payload => ({
                url: mockBaseUrl + '/Resource/Organization/OrganizationWorkType',
                method: 'post',
                headers: mockHeader,
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            }));

            const failed = gLib._addSubcontractorWorkTypes(workTypePayloads, mockToken, mockBaseUrl);

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedOptions);
            expect(failed).toEqual(workTypePayloads);
            expect(mockLogger.log).toHaveBeenCalledWith('An error occured adding work type with id: wt1 to subcontractor with id org1. Code: 400. Error: Error');
            expect(mockLogger.log).toHaveBeenCalledWith('An error occured adding work type with id: wt2 to subcontractor with id org2. Code: 400. Error: Error');
        });
    });
    
    describe('_addSubcontractorSubWorkTypes', () => {
        const workSubTypePayloads = [
            { OrganizationREF: 'org1', WorkSubtypeCategoryREF: 'wst1' },
            { OrganizationREF: 'org2', WorkSubtypeCategoryREF: 'wst2' }
        ];

        it('should add work subtypes successfully', () => {
            const mockResponses = workSubTypePayloads.map(() => ({
                getResponseCode: () => 201
            }));
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses);
            const expectedOptions = workSubTypePayloads.map(payload => ({
                url: mockBaseUrl + '/Resource/Organization/OrganizationWorkSubType',
                method: 'post',
                headers: mockHeader,
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            }));

            const failed = gLib._addSubcontractorSubWorkTypes(workSubTypePayloads, mockToken, mockBaseUrl);

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedOptions);
            expect(failed).toHaveLength(0);
            expect(mockLogger.log).toHaveBeenCalledWith('Work subtype with id: wst1 successfully added to organization with id: org1');
            expect(mockLogger.log).toHaveBeenCalledWith('Work subtype with id: wst2 successfully added to organization with id: org2');
        });

        it('should handle failures when adding work subtypes', () => {
            const mockResponses = workSubTypePayloads.map(() => ({
                getResponseCode: () => 400,
                getContentText: () => 'Error'
            }));
            mockUrlFetchApp.fetchAll.mockReturnValue(mockResponses);
            const expectedOptions = workSubTypePayloads.map(payload => ({
                url: mockBaseUrl + '/Resource/Organization/OrganizationWorkSubType',
                method: 'post',
                headers: mockHeader,
                payload: JSON.stringify(payload),
                muteHttpExceptions: true
            }));

            const failed = gLib._addSubcontractorSubWorkTypes(workSubTypePayloads, mockToken, mockBaseUrl);

            expect(mockUrlFetchApp.fetchAll).toHaveBeenCalledWith(expectedOptions);
            expect(failed).toEqual(workSubTypePayloads);
            expect(mockLogger.log).toHaveBeenCalledWith('An error occured adding work subtype with id: wst1 to subcontractor with id org1. Code: 400. Error: Error');
            expect(mockLogger.log).toHaveBeenCalledWith('An error occured adding work subtype with id: wst2 to subcontractor with id org2. Code: 400. Error: Error');
        });
    });

    describe('CreateSubcontractors', () => {
        const mockGetSpreadSheetData = vi.fn();
        const mock_createSubcontractorCategories = vi.fn();
        const mock_createSubcontractors = vi.fn();
        const mock_addSubcontractorWorkTypes = vi.fn();
        const mock_addSubcontractorSubWorkTypes = vi.fn();
        const mockHighlightRows = vi.fn();

        beforeAll(() => {
            gLib.authenticate = vi.fn(() => ({ token: mockToken, baseUrl: mockBaseUrl }));
            gLib.getSpreadSheetData = mockGetSpreadSheetData;
            gLib._createSubcontractorCategories = mock_createSubcontractorCategories;
            gLib._createSubcontractors = mock_createSubcontractors;
            gLib._addSubcontractorWorkTypes = mock_addSubcontractorWorkTypes;
            gLib._addSubcontractorSubWorkTypes = mock_addSubcontractorSubWorkTypes;
            gLib.highlightRows = mockHighlightRows;
        });

        it('should exit early if no data is present', () => {
            mockGetSpreadSheetData.mockReturnValue([]);
            gLib.CreateSubcontractors();
            expect(mockLogger.log).toHaveBeenCalledWith('CreateSubcontractors() failed to run because there was no data to send.');
            expect(mockUi.alert).toHaveBeenCalledWith('No data to send!');
            expect(mock_createSubcontractorCategories).not.toHaveBeenCalled();
        });

        it('should throw an error if subcontractor category creation fails', () => {
            mockGetSpreadSheetData.mockReturnValue([
                { Name: 'Sub1', City: 'City1', 'Subcontractor Category': 'Cat1', "Work Types": 'Type1' }
            ]);
            mock_createSubcontractorCategories.mockReturnValue({ failedCategories: ['Cat1'], createdCategories: [] });

            expect(() => gLib.CreateSubcontractors()).toThrow('Script failed while creating the following subcontractor categories: Cat1');
        });

        it('should throw an error and highlight rows if subcontractor creation fails', () => {
            mockGetSpreadSheetData.mockReturnValue([
                { Name: 'Sub1', City: 'City1', 'Subcontractor Category': 'Cat1', "Work Types": 'Type1' }
            ]);
            mock_createSubcontractorCategories.mockReturnValue({ failedCategories: [], createdCategories: [{ Name: 'Cat1' }] });
            mock_createSubcontractors.mockReturnValue({ failedRows: [2], createdSubcontractors: [] });

            expect(() => gLib.CreateSubcontractors()).toThrow('Some rows failed to be created. Failed Rows: 2');
            expect(mockHighlightRows).toHaveBeenCalledWith([2], 'red');
        });

        it('should throw an error if adding work types fails', () => {
            const subData = [{ Name: 'Sub1', City: 'City1', "Work Types": "Type1", ObjectID: 'sub1' }];
            mockGetSpreadSheetData.mockReturnValue(subData);
            mock_createSubcontractorCategories.mockReturnValue({ failedCategories: [], createdCategories: [] });
            mock_createSubcontractors.mockReturnValue({ failedRows: [], createdSubcontractors: subData });
            mockGetDBCategoryList.mockReturnValue([{ Name: 'Type1', ObjectID: 'wt1' }]);
            mockGetDBSubcategoryList.mockReturnValue([]);
            const failedPayload = [{ OrganizationREF: 'sub1', WorkTypeCategoryREF: 'wt1' }];
            mock_addSubcontractorWorkTypes.mockReturnValue(failedPayload);

            expect(() => gLib.CreateSubcontractors()).toThrow();
        });

        it('should throw an error if adding work subtypes fails', () => {
            const subData = [{ Name: 'Sub1', City: 'City1', "Work Types": "SubType1", ObjectID: 'sub1' }];
            mockGetSpreadSheetData.mockReturnValue(subData);
            mock_createSubcontractorCategories.mockReturnValue({ failedCategories: [], createdCategories: [] });
            mock_createSubcontractors.mockReturnValue({ failedRows: [], createdSubcontractors: subData });
            mockGetDBCategoryList.mockReturnValue([]);
            mockGetDBSubcategoryList.mockReturnValue([{ Name: 'SubType1', ObjectID: 'wst1' }]);
            mock_addSubcontractorWorkTypes.mockReturnValue([]);
            const failedPayload = [{ OrganizationREF: 'sub1', WorkSubtypeCategoryREF: 'wst1' }];
            mock_addSubcontractorSubWorkTypes.mockReturnValue(failedPayload);

            expect(() => gLib.CreateSubcontractors()).toThrow();
        });

        it('should run successfully to completion', () => {
            const subData = [{ Name: 'Sub1', City: 'City1', "Work Types": "Type1, SubType1", 'Subcontractor Category': 'Cat1', ObjectID: 'sub1' }];
            mockGetSpreadSheetData.mockReturnValue(subData);
            mock_createSubcontractorCategories.mockReturnValue({ failedCategories: [], createdCategories: [{Name: 'Cat1'}] });
            mock_createSubcontractors.mockReturnValue({ failedRows: [], createdSubcontractors: subData });
            mockGetDBCategoryList.mockReturnValue([{ Name: 'Type1', ObjectID: 'wt1' }]);
            mockGetDBSubcategoryList.mockReturnValue([{ Name: 'SubType1', ObjectID: 'wst1', CategoryREF: 'wt1' }]);
            mock_addSubcontractorWorkTypes.mockReturnValue([]);
            mock_addSubcontractorSubWorkTypes.mockReturnValue([]);

            gLib.CreateSubcontractors();

            expect(mock_createSubcontractorCategories).toHaveBeenCalledWith(['Cat1'], mockToken, mockBaseUrl);
            expect(mock_createSubcontractors).toHaveBeenCalledWith(subData, mockToken, mockBaseUrl);
            expect(mock_addSubcontractorWorkTypes).toHaveBeenCalledWith([{ OrganizationREF: 'sub1', WorkTypeCategoryREF: 'wt1' }], mockToken, mockBaseUrl);
            expect(mock_addSubcontractorSubWorkTypes).toHaveBeenCalledWith([{ OrganizationREF: 'sub1', WorkSubtypeCategoryREF: 'wst1' }], mockToken, mockBaseUrl);
            expect(mockUi.alert).toHaveBeenCalledWith('All subcontractors created successfully!');
        });
    });
});

