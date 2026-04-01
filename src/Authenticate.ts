interface IUserVariables extends Record<string, string> {
  baseUrl: string,
  clientID: string,
  clientSecret: string,
  userName: string,
  password: string,
  sqlListener: string,
  dbName: string
}
interface ITemplateWithVars extends GoogleAppsScript.HTML.HtmlTemplate {
  baseUrl: string,
  clientID: string,
  userName: string,
  sqlListener: string,
  dbName: string,
  hasPassword: boolean, //indicates whether the user has a password stored
  hasClientSecret: boolean
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
  const template = HtmlService.createTemplateFromFile('SetUserProperties') as ITemplateWithVars
  const userProperties = PropertiesService.getUserProperties();
  const props = userProperties.getProperties()
  template.baseUrl = props['baseUrl']
  template.clientID = props['clientID']
  template.userName = props['userName']
  template.sqlListener = props['sqlListener']
  template.dbName = props['dbName']
  template.hasPassword = userProperties.getProperty('password') ? true : false // Warning, this gets passed as a string 'true' or 'false'
  template.hasClientSecret = userProperties.getProperty('clientSecret') ? true : false
  SpreadsheetApp.getUi().showModalDialog(template.evaluate(), "Set Environment Variables")
}
function clearUserProperties() {
  PropertiesService.getUserProperties().deleteAllProperties()
  SpreadsheetApp.getUi().alert("Database properties successfully deleted")
}
function viewUserProperties() {
  const props = PropertiesService.getUserProperties().getProperties() as IUserVariables
  SpreadsheetApp.getUi().alert(`Current API Properties: \nBase URL: ${props.baseUrl}\nClientID: ${props.clientID}\nUsername: ${props.userName}\nSql Listener: ${props.sqlListener}\nDatabase Name: ${props.dbName}`)
}
function setUserVariables(vars: IUserVariables) {
  for(const key of Object.keys(vars)) {
    vars[key].trim();
  }
  const userProperties = PropertiesService.getUserProperties();
  try {
    if(vars.password === "********") {
      vars.password = userProperties.getProperty('password') ?? ""
    }
    if(vars.clientSecret === "********") {
      vars.clientSecret = userProperties.getProperty('clientSecret') ?? ""
    }
    if(!vars.baseUrl.toLowerCase().includes("estapi_")) {
      const splitUrl = vars.baseUrl.split("/")
      let companyName = splitUrl[splitUrl.length - 1];
      splitUrl[splitUrl.length - 1] = `ESTAPI_${companyName}`;
      vars.baseUrl = splitUrl.join("/");
    }
    userProperties.setProperties(vars)
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
    method: 'get' as const,
    headers: tokenHeader,
    muteHttpExceptions: true
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
  if(!spreadsheetVars) throw new Error("Missing API Properties!")
  const token = _getToken(spreadsheetVars.baseUrl, spreadsheetVars)
  return {token, baseUrl: spreadsheetVars.baseUrl}
}

function validateAuthentication() {
  const {token, baseUrl} = authenticate();
  const options = {
    method: 'get' as const,
    headers: createHeaders(token),
    muteHttpExceptions: true
  }
  try {
    fetchWithRetries(`${baseUrl}/Estimate/schema`, options)
  } catch (error) {
    Logger.log(error);
    throw error;
  }
}