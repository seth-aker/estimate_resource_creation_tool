import { vi, describe, it, beforeEach, expect} from 'vitest'
import gas from 'gas-local'
import { mockLogger, mockRange, mockSpreadsheetApp, mockUi, mockUrlFetchApp } from './mocks'

const mocks = {
    SpreadsheetApp: mockSpreadsheetApp,
    UrlFetchApp: mockUrlFetchApp,
    Logger: mockLogger
}
const gLib = gas.require('./dist', mocks)

describe("Authenticate", () => {
    beforeEach(() => {
        vi.resetAllMocks()
    })
    describe('_getSpreadsheetVars()', () => {
        it("exits early if baseUrl is empty.", () => {
            mockRange.getValue
            .mockReturnValueOnce('') // if baseUrl is an empty cell
            .mockReturnValueOnce('clientID')
            .mockReturnValueOnce('clientSec')
            .mockReturnValueOnce('userName')
            .mockReturnValueOnce('userPW')
            
            gLib._getSpreadsheetVars()
            expect(mockUi.alert).toHaveBeenCalledWith("BaseUrl required!")
        })
        it("exits early if clientID is empty", () => {
             mockRange.getValue
            .mockReturnValueOnce('baseUrl') 
            .mockReturnValueOnce('')// if clientId is an empty cell
            .mockReturnValueOnce('clientSec')
            .mockReturnValueOnce('userName')
            .mockReturnValueOnce('userPW')
            
            gLib._getSpreadsheetVars()
            expect(mockUi.alert).toHaveBeenCalledWith("Client Id required!")
        })
        it("exits early if ClientSec is empty", () => {
            mockRange.getValue
            .mockReturnValueOnce('baseUrl') 
            .mockReturnValueOnce('clientID')
            .mockReturnValueOnce('') //if clientSec is an empty cell
            .mockReturnValueOnce('userName')
            .mockReturnValueOnce('userPW')
            
            gLib._getSpreadsheetVars()
            expect(mockUi.alert).toHaveBeenCalledWith("Client Secret required!")

        })
        it("exits early if Username is empty", () => {
            mockRange.getValue
            .mockReturnValueOnce('baseUrl') 
            .mockReturnValueOnce('clientID')
            .mockReturnValueOnce('clientSec') 
            .mockReturnValueOnce('') //if username is an empty cell
            .mockReturnValueOnce('userPW')
            gLib._getSpreadsheetVars()
            expect(mockUi.alert).toHaveBeenCalledWith("Username required!")

        })
        it("exits early if password is empty", () => {
            mockRange.getValue
            .mockReturnValueOnce('baseUrl') 
            .mockReturnValueOnce('clientID')
            .mockReturnValueOnce('clientSec') 
            .mockReturnValueOnce('username') 
            .mockReturnValueOnce('') // if username is an empty cell
            gLib._getSpreadsheetVars()
            expect(mockUi.alert).toHaveBeenCalledWith("Password required!")
        })
        it("returns the object containing the correct fields when they exist", () => {
            mockRange.getValue
            .mockReturnValueOnce('baseUrl') 
            .mockReturnValueOnce('clientID')
            .mockReturnValueOnce('clientSec') 
            .mockReturnValueOnce('username') 
            .mockReturnValueOnce('password')
            
            const actualReturnValue = gLib._getSpreadsheetVars()
            expect(actualReturnValue.baseUrl).toBe("baseUrl")
            expect(actualReturnValue.clientID).toBe("clientID")
            expect(actualReturnValue.clientSecret).toBe("clientSec")
            expect(actualReturnValue.userName).toBe('username')
            expect(actualReturnValue.password).toBe("password")
        })
    })
    describe('_getToken()', () => {
        it('throws when response code is not 200', () => {
            mockUrlFetchApp.fetch.mockReturnValue({
                    getResponseCode: vi.fn(() => 400),
                    getContentText: vi.fn()
            })
            const baseUrl = 'baseUrl'
            const credentials = {
                    clientID: "id",
                    clientSecret: 'secret',
                    userName: 'user1',
                    password: 'password'
                }
            expect(() => gLib._getToken(baseUrl, credentials)).toThrow(/^An error occured authenticating with the Estimate API. Error code: 400$/)
            expect(mockLogger.log).toHaveBeenCalled()
        })
        it('to return a token when the response code is 200', () => {
            mockUrlFetchApp.fetch.mockReturnValue({
                getResponseCode: () => 200,
                getContentText: () => JSON.stringify({AccessToken: "accessToken", RefreshToken: "refreshToken"})
            })
             const baseUrl = 'baseUrl'
            const credentials = {
                    clientID: "id",
                    clientSecret: 'secret',
                    userName: 'user1',
                    password: 'password'
                }
            const token = gLib._getToken(baseUrl, credentials)
            expect(token).toBe("accessToken")
        })
    })
})