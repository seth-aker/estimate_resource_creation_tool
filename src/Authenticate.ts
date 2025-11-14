interface IUserVariables extends Record<string, string> {
  baseUrl: string,
  clientID: string,
  clientSecret: string,
  userName: string,
  password: string,
  serverName: string,
  dbName: string
}
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('API Properties')
    .addItem('Set API Properties', 'requestUserProperties')
    .addItem('View Current API Properties', 'viewUserProperties')
    .addItem('Clear API Properties', 'clearUserProperties')
    .addToUi()
}
function requestUserProperties() {
  const html = HtmlService.createHtmlOutputFromFile('SetUserProperties')
  SpreadsheetApp.getUi().showModalDialog(html, "Set Environment Variables")
}
function clearUserProperties() {
  PropertiesService.getUserProperties().deleteAllProperties()
  SpreadsheetApp.getUi().alert("Database properties successfully deleted")
}
function viewUserProperties() {
  const props = PropertiesService.getUserProperties().getProperties() as IUserVariables
  SpreadsheetApp.getUi().alert(`Current API Properties: \nBase URL: ${props.baseUrl}\nClientID: ${props.clientID}\nUsername: ${props.userName}\nServer Name: ${props.serverName}\nDatabase Name: ${props.dbName}`)
}
function setUserVariables(vars: IUserVariables) {
  try {
    PropertiesService.getUserProperties().setProperties(vars)
  } catch (err) {
    SpreadsheetApp.getUi().alert(`An error occured setting properties: ${err}`)
    throw err
  }
}
function _getUserVariables() {
  const props = PropertiesService.getUserProperties().getProperties()
  const baseUrl = props['baseUrl']
  const clientID = props['clientID']
  const clientSecret = props['clientSecret']
  const userName = props['userName']
  const password = props['password']

  if(!baseUrl) {
    SpreadsheetApp.getUi().alert(`BaseUrl required!`)
    return
  }
  if(!clientID) {
    SpreadsheetApp.getUi().alert('Client Id required!')
    return
  }
  if(!clientSecret) {
    SpreadsheetApp.getUi().alert('Client Secret required!')
    return
  }
  if(!userName) {
    SpreadsheetApp.getUi().alert('Username required!')
    return
  }
  if(!password) {
    SpreadsheetApp.getUi().alert('Password required!')
    return
  }
  return {
    baseUrl,
    clientID,
    clientSecret,
    userName,
    password
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
    userName: `viewpoint\\${credentials.userName}`,
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
 * @returns \{ token: string, baseUrl: string }
 */
function authenticate(): {token: string, baseUrl: string} {
  // use to get bearer token
  const spreadsheetVars = _getUserVariables()
  if(!spreadsheetVars) throw new Error("Missing API_Information!")
  const token = _getToken(spreadsheetVars.baseUrl, spreadsheetVars)
  return {token, baseUrl: spreadsheetVars.baseUrl}
}
