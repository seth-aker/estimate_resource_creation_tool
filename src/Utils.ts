// Work types require a EstimateREF to be sent with the post, use this as a dummy ref
const ESTIMATE_REF = "00000000-0000-0000-0000-000000000000";
let TOKEN: string
let BASE_URL: string

interface ICategoryItem {
  EstimateREF: string,
  Name: string,
  ObjectID?: string,
}
interface ISubcategoryItem extends ICategoryItem {
  CategoryREF: string
}
interface IPagination {
  CurrentPage: string,
  ItemsOnPage: number,
  NextPage: string,
  PageSize: number,
  PreviousPage: string,
  TotalItems: number
}
interface ICategoryGetResponse {
  Items: ICategoryItem[],
  Pagination: IPagination
}
interface ISubcategoryGetResponse {
  Items: ISubcategoryItem[],
  Pagination: IPagination
}
function createHeaders(token: string, additionalHeaders?: Record<string, string>) {
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...additionalHeaders
    }
}
function getDBCategoryList(categoryName: string, token: string, baseUrl: string, query: string = `?$filter=EstimateREF eq ${ESTIMATE_REF}`) {
    const url = baseUrl + `/Resource/Category/${categoryName}${query}`
    const headers = createHeaders(token)
    const options = {
      headers,
      method: 'get' as const
    }
    try {
      const response = UrlFetchApp.fetch(url, options)
      const responseCode = response.getResponseCode()
      if(responseCode !== 200) {
        throw new Error(`An error occured fetching category: "${categoryName}" Code: ${responseCode}`)
      }
      const data: ICategoryGetResponse = JSON.parse(response.getContentText())
      const items: ICategoryItem[] = [...data.Items]
      
      // Recursively cycle through the pages if there is a NextPage entry in the pagination object
      if(data.Pagination.NextPage) {
        const qIndex = data.Pagination.NextPage.indexOf('?')
        const query = data.Pagination.NextPage.substring(qIndex)
        const nextPageItems = getDBCategoryList(categoryName, token, baseUrl, query)
        items.push(...nextPageItems)
      }
      return items
    } catch (err) {
      throw err
    }
}
function getDBSubcategoryList(subcategoryName: string, token: string, baseUrl: string, query: string = `?$filter=EstimateREF eq ${ESTIMATE_REF}` ) {
  const url = baseUrl + `/Resource/Subcategory/${subcategoryName}${query}`
    const headers = createHeaders(token)
    const options = {
      headers,
      method: 'get' as const
    }
    try {
      const response = UrlFetchApp.fetch(url, options)
      const responseCode = response.getResponseCode()
      if(responseCode !== 200) {
        throw new Error(`An error occured fetching category: "${subcategoryName}" Code: ${responseCode}`)
      }
      const data: ISubcategoryGetResponse = JSON.parse(response.getContentText())
      const items: ISubcategoryItem[] = [...data.Items]
      
      // Recursively cycle through the pages if there is a NextPage entry in the pagination object
      if(data.Pagination.NextPage) {
        const qIndex = data.Pagination.NextPage.indexOf('?')
        const query = data.Pagination.NextPage.substring(qIndex)
        const nextPageItems = getDBSubcategoryList(subcategoryName, token, baseUrl, query)
        items.push(...nextPageItems)
      }
      return items
    } catch (err) {
      throw err
    }
}