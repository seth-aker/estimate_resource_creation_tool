

function _getSpreadsheetVars() {
  const varSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('API_Information');
  if(!varSheet) return
  const baseUrl: string = varSheet.getRange("C2").getValue(); 
  const clientID: string = varSheet.getRange("C3").getValue();
  const clientSec: string = varSheet.getRange("C4").getValue();
  const userName: string = varSheet.getRange("C5").getValue();
  const userPW: string = varSheet.getRange("C6").getValue();
 
  if(!baseUrl) {
    SpreadsheetApp.getUi().alert(`BaseUrl required!`)
    return
  }
  if(!clientID) {
    SpreadsheetApp.getUi().alert('Client Id required!')
    return
  }
  if(!clientSec) {
    SpreadsheetApp.getUi().alert('Client Secret required!')
    return
  }
  if(!userName) {
    SpreadsheetApp.getUi().alert('Username required!')
    return
  }
  if(!userPW) {
    SpreadsheetApp.getUi().alert('Password required!')
    return
  }
  return {
    baseUrl,
    clientID: clientID,
    clientSecret: clientSec,
    userName: userName,
    password: userPW
  }
}
interface Credentials {
  clientID: string,
  clientSecret: string,
  userName: string,
  password: string
}

function _getToken(baseUrl: string, credentials: Credentials) {
  const tokenHeader = {
    clientID: credentials.clientID,
    clientSecret: credentials.clientSecret,
    userName: credentials.userName,
    password: credentials.password
  }
  const options = {
    'method': 'get' as const,
    'headers': tokenHeader
  };
  try {
    const response = UrlFetchApp.fetch(`${baseUrl}/login`, options);
    const responseCode = response.getResponseCode()
    if(responseCode !== 200) {
      throw new Error(`An error occured authenticating with the Estimate API. Error code: ${responseCode}`)
    }
    const token = JSON.parse(response.getContentText()).AccessToken;
    return token as string
  } catch (err) {
    Logger.log(err)
    throw err
  }
}
/**
 * Used to authenticate with the api and returns the necessary information to call endpoints.
 * Namely, the token from /login and baseUrl from the speadsheet
 * @returns token: string, baseUrl: string
 */
function authenticate() {
  // use to get bearer to
  const spreadsheetVars = _getSpreadsheetVars()
  if(!spreadsheetVars) throw new Error("Missing API_Information!")
  const token = _getToken(spreadsheetVars.baseUrl, spreadsheetVars)
  return {token, baseUrl: spreadsheetVars.baseUrl}
}