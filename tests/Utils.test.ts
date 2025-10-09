import gas from 'gas-local';
import { vi, beforeEach, expect, describe, it } from 'vitest'
import { mockSpreadsheetApp, mockUrlFetchApp, mockLogger, mockSpreadsheet, mockRange} from './mocks';
const mocks = {
  SpreadsheetApp: mockSpreadsheetApp,
  UrlFetchApp: mockUrlFetchApp,
  Logger: mockLogger,
  // __proto__: gas.globalMockDefaults
}

const glib = gas.require('./dist', mocks)

describe("Utils Tests", () => {
  describe("GetSpreadSheetData", () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })
    it('throws and error if spreadsheetName could not be found', () => {
      mockSpreadsheet.getSheetByName.mockImplementation(() => null)
      expect(() => glib.getSpreadSheetData("Test")).toThrow(/^Could not find spreadsheet: "Test"$/)
    })
    it('returns properly formatted data for JCIDS', () => {
      const mockData = [
        ['Description', 'Code'],
        ['Desc1', 'Code1'],
        ['Desc2', 'Code2'],
        ['Desc3', 'Code3'],
        ['Desc4', 'Code4']
      ]
      const expectedData = [
        {Description: 'Desc1', Code: 'Code1'},
        {Description: 'Desc2', Code: 'Code2'},
        {Description: 'Desc3', Code: 'Code3'},
        {Description: 'Desc4', Code: 'Code4'},
      ]
      mockRange.getValues.mockReturnValue(mockData)
      const returnData = glib.getSpreadSheetData('Test')
      expect(returnData).toEqual(expectedData)
    })
    it('returns properly formatted data for Customers (with empty columns)', () => {
      const mockData = [
        ['Name', 'Address1', 'Address2', 'City', 'State', 'Zip', 'Category'],
        ['Cust1', 'Cust1Address1', '', 'Cust1City', 'Cust1State', '', ''],
        ['Cust2', '','', 'Cust2City', 'Cust2State', '', 'Cust2Category'],
        ['Cust3', 'Cust3Address1', 'Cust3Address2', 'Cust3City', 'Cust3State', 'Cust3Zip', 'Cust3Category']
      ]
      const expectedData = [
        { Name: 'Cust1', Address1: 'Cust1Address1', Address2: '', City: 'Cust1City', State: 'Cust1State', Zip: '', Category: ''},
        { Name: 'Cust2', Address1: '', Address2: '', City: 'Cust2City', State: 'Cust2State', Zip: '', Category: 'Cust2Category'},
        { Name: 'Cust3', Address1: 'Cust3Address1', Address2: 'Cust3Address2', City: 'Cust3City', State: 'Cust3State', Zip: 'Cust3Zip', Category: 'Cust3Category'}
      ]
      mockRange.getValues.mockReturnValue(mockData)
      const returnData = glib.getSpreadSheetData('Test')
      expect(returnData).toEqual(expectedData)
    })
    it('trimp whitespace for strings', () => {
      const mockData = [
        ['Description', 'Code'],
        ['Desc1', 'Code1      '],
        ['       Desc2', 1234]
      ]
      const expectedData = [
        {Description: "Desc1", Code: 'Code1'},
        {Description: 'Desc2', Code: 1234}
      ]
      mockRange.getValues.mockReturnValue(mockData)
      const returnData = glib.getSpreadSheetData("Test")
      expect(returnData).toEqual(expectedData)
    })
  })
  describe('deepEquals', () => {
    // Test cases for primitive values
    it('should return true for equal primitives', () => {
      expect(glib.deepEquals(1, 1)).toBe(true);
      expect(glib.deepEquals('hello', 'hello')).toBe(true);
      expect(glib.deepEquals(true, true)).toBe(true);
      expect(glib.deepEquals(null, null)).toBe(true);
      expect(glib.deepEquals(undefined, undefined)).toBe(true);
      expect(glib.deepEquals(Symbol('foo'), Symbol('foo'))).toBe(false); // Symbols are unique
    });

    it('should return false for unequal primitives', () => {
      expect(glib.deepEquals(1, 2)).toBe(false);
      expect(glib.deepEquals('hello', 'world')).toBe(false);
      expect(glib.deepEquals(true, false)).toBe(false);
      expect(glib.deepEquals(1, '1')).toBe(false);
      expect(glib.deepEquals(null, undefined)).toBe(false);
      expect(glib.deepEquals(0, null)).toBe(false);
    });

    // Test cases for simple, flat objects
    it('should return true for equal flat objects', () => {
      const obj1 = { a: 1, b: 'test' };
      const obj2 = { a: 1, b: 'test' };
      const obj3 = { b: 'test', a: 1 }; // Order shouldn't matter
      expect(glib.deepEquals(obj1, obj2)).toBe(true);
      expect(glib.deepEquals(obj1, obj3)).toBe(true);
    });

    it('should return false for unequal flat objects', () => {
      const obj1 = { a: 1, b: 'test' };
      const obj2 = { a: 1, b: 'testing' };
      const obj3 = { a: 1, c: 'test' }; // Different key
      const obj4 = { a: 1 }; // Different number of keys
      expect(glib.deepEquals(obj1, obj2)).toBe(false);
      expect(glib.deepEquals(obj1, obj3)).toBe(false);
      expect(glib.deepEquals(obj1, obj4)).toBe(false);
    });

    // Test cases for simple arrays
    it('should return true for equal arrays', () => {
      expect(glib.deepEquals([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(glib.deepEquals([], [])).toBe(true);
      expect(glib.deepEquals([null, undefined], [null, undefined])).toBe(true);
    });

    it('should return false for unequal arrays', () => {
      expect(glib.deepEquals([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(glib.deepEquals([1, 2, 3], [1, 2])).toBe(false);
      expect(glib.deepEquals([1, 2, 3], [3, 2, 1])).toBe(false);
    });

    // Test cases for nested objects and arrays
    it('should return true for deeply equal nested structures', () => {
      const obj1 = { a: 1, b: { c: 2, d: [3, { e: 4 }] } };
      const obj2 = { a: 1, b: { c: 2, d: [3, { e: 4 }] } };
      expect(glib.deepEquals(obj1, obj2)).toBe(true);
    });

    it('should return false for deeply unequal nested structures', () => {
      const obj1 = { a: 1, b: { c: 2, d: [3, { e: 4 }] } };
      const obj2 = { a: 1, b: { c: 2, d: [3, { e: 5 }] } };
      expect(glib.deepEquals(obj1, obj2)).toBe(false);
    });

    // Test cases for dates
    it('should correctly compare Date objects', () => {
      const date1 = new Date('2023-01-01T00:00:00.000Z');
      const date2 = new Date('2023-01-01T00:00:00.000Z');
      const date3 = new Date('2024-01-01T00:00:00.000Z');
      expect(glib.deepEquals(date1, date2)).toBe(true);
      expect(glib.deepEquals(date1, date3)).toBe(false);
    });
    
    // Test cases for objects with different constructors
    it('should return false for objects with different constructors', () => {
        class MyClass {}
        const obj1 = {};
        const obj2 = new MyClass();
        expect(glib.deepEquals(obj1, obj2)).toBe(false);
    });

    // Test cases for circular references
    it('should handle circular references without infinite loops', () => {
      const obj1: any = { name: 'obj1' };
      const obj2: any = { name: 'obj2' };
      obj1.ref = obj2;
      obj2.ref = obj1;

      const obj3: any = { name: 'obj1' };
      const obj4: any = { name: 'obj2' };
      obj3.ref = obj4;
      obj4.ref = obj3;
      
      expect(glib.deepEquals(obj1, obj3)).toBe(true);

      const obj5: any = { name: 'obj1' };
      const obj6: any = { name: 'obj2' };
      obj5.ref = obj6;
      obj6.ref = obj5;

      const obj7: any = { name: 'obj1' };
      const obj8: any = { name: 'DIFFERENT' }; // Difference
      obj7.ref = obj8;
      obj8.ref = obj7;

      expect(glib.deepEquals(obj5, obj7)).toBe(false);
    });
    
    it('should handle self-referencing properties', () => {
        const obj1: any = {};
        obj1.self = obj1;
        
        const obj2: any = {};
        obj2.self = obj2;

        expect(glib.deepEquals(obj1, obj2)).toBe(true);
    });
  });

  describe('deepIncludes', () => {
    it('should return true if the array contains the primitive element', () => {
      const arr = [1, 'hello', true, null];
      expect(glib.deepIncludes(arr, 1)).toBe(true);
      expect(glib.deepIncludes(arr, 'hello')).toBe(true);
      expect(glib.deepIncludes(arr, true)).toBe(true);
      expect(glib.deepIncludes(arr, null)).toBe(true);
    });

    it('should return false if the array does not contain the primitive element', () => {
      const arr = [1, 'hello', true, null];
      expect(glib.deepIncludes(arr, 2)).toBe(false);
      expect(glib.deepIncludes(arr, 'world')).toBe(false);
      expect(glib.deepIncludes(arr, false)).toBe(false);
      expect(glib.deepIncludes(arr, undefined)).toBe(false);
    });

    it('should return true if the array contains a deeply equal object', () => {
      const arr = [
        { a: 1, b: 'test' },
        { c: [2, 3], d: { e: 4 } }
      ];
      const searchElement1 = { a: 1, b: 'test' };
      const searchElement2 = { c: [2, 3], d: { e: 4 } };
      expect(glib.deepIncludes(arr, searchElement1)).toBe(true);
      expect(glib.deepIncludes(arr, searchElement2)).toBe(true);
    });

    it('should return false if the array does not contain a deeply equal object', () => {
      const arr = [
        { a: 1, b: 'test' },
        { c: [2, 3], d: { e: 4 } }
      ];
      const searchElement = { a: 1, b: 'testing' }; // different value
      expect(glib.deepIncludes(arr, searchElement)).toBe(false);
    });
    
    it('should work with an empty array', () => {
      expect(glib.deepIncludes([], { a: 1 })).toBe(false);
    });
  });
})