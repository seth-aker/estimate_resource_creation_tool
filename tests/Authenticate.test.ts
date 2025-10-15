import { vi, describe, it, beforeEach, expect} from 'vitest'
import gas from 'gas-local'
import { mockLogger, mockSpreadsheetApp, mockUrlFetchApp } from './mocks'

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
