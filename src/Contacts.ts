type TOrgType = 'Customer' | 'Subcontractor' | 'Vendor'
type TOrgRow = ISubcontractorRow | ICustomerRow | IVendorRow
interface ISpreadsheetContact extends Record<string, TSpreadsheetValues | undefined> {
  "Contact Name"?: string,
  "Contact Title"?: string,
  "Contact Email"?: string,
  "Contact Phone"?: string,
  "Contact Notes"?: string,
  "Contact Fax"?: string,
  "Contact Extension"?: string,
  "Is Default Contact?"?: boolean
}
interface IContactDTO {
  Name: string,
  OrganizationREF: string,
  Email?: string
  Extension?: string
  Fax?: string,
  IsDefaultContact?: boolean,
  MobileNumber?: string,
  Notes?: string,
  ObjectID?: string,
  Title?: string
}
function createContacts(contacts: IContactDTO[], token: string, baseUrl: string) {
  const url = `${baseUrl}/Resource/Organization/Contact?$filter=EstimateREF eq ${ESTIMATE_REF}`
  const headers = createHeaders(token);
  const batchOptions = contacts.map(contact => ({
    url,
    headers,
    method: 'post' as const,
    payload: JSON.stringify(contact),
    muteHttpExceptions: true
  }))
  const failedContacts: number[] = [];
  try {
    const responses = batchFetch(batchOptions) ;
    responses.forEach((response, index) => {
      const responseCode = response.getResponseCode();
      if(responseCode >= 400 && responseCode !== 409) {
        Logger.log(`Contact "${contacts[index].Name}" failed with status code ${responseCode}. Error: ${response.getContentText()}`)
        failedContacts.push(index)
      } else if (responseCode === 409 || responseCode === 200) {
        Logger.log(`Contact "${contacts[index].Name}" already existed in the database.`)
      } else {
        Logger.log(`Contact: "${contacts[index].Name}" successfully created`)
      }
    })
  } catch (err) {
    Logger.log(err);
    throw new Error("An unexpected error occured creating customer categories. See logs for more details.")
  }
  return failedContacts;
}

function createContactDTOs(orgs: TOrganizationDTO[], orgContacts: TOrgRow[]) {
  const contactDTOs: IContactDTO[] = []
  orgContacts.forEach(orgContact => {
    if(orgContact["Contact Name"]) {
      const contactDTO: IContactDTO = {
        Name: orgContact["Contact Name"],
        OrganizationREF: orgs.find(org => org.Name === orgContact.Name && org.City === orgContact.City)?.ObjectID! as string,
        Email: orgContact["Contact Email"],
        Fax: orgContact["Contact Fax"],
        Extension: orgContact["Contact Extension"],
        IsDefaultContact: orgContact["Is Default Contact?"],
        MobileNumber: orgContact["Contact Phone"],
        Notes: orgContact["Contact Notes"],
        Title: orgContact["Contact Title"]
      }
      contactDTOs.push(contactDTO);
    }
  })
  return contactDTOs;
}
// function CreateContacts() {
//   const { token, baseUrl } = authenticate()
//   const contactData = getSpreadSheetData<ISpreadsheetContact>('Contacts')

//   if(!contactData || contactData.length === 0) {
//     Logger.log("CreateContacts() failed to run because there was no data to send.");
//     SpreadsheetApp.getUi().alert('No data to send!');
//     return;
//   }
//   const orgsToGet = contactData.map((contact) => {
//     const [orgName, orgCity] = contact.Organization.split(',').map(each => each.trim())
//     return {
//       Name: orgName,
//       City: orgCity,
//       Type: contact["Organization Type"]
//     }
//   })
//   const customersToGet = orgsToGet.filter((org) => org.Type === 'Customer')
//   const subsToGet = orgsToGet.filter((org) => org.Type === 'Subcontractor')
//   const vendorsToGet = orgsToGet.filter((org) => org.Type === 'Vendor')
//   const customers: TOrganizationDTO[] = []
//   const subs: TOrganizationDTO[] = []
//   const vendors: TOrganizationDTO[] = []
//   if(customersToGet.length > 0) {
//     customers.push(...getOrganization('Customer', token, baseUrl))
//   }
//   if(subsToGet.length > 0) {
//     subs.push(...getOrganization('Subcontractor', token, baseUrl))
//   }
//   if(vendorsToGet.length > 0) {
//     vendors.push(...getOrganization('Vendor', token, baseUrl))
//   }
//   const contactDTOs: IContactDTO[] = contactData.map((contact) => {
//     const {Organization, "Organization Type": orgType, ...rest} = contact
//     let OrganizationREF: string
//     const [orgName, orgCity] = Organization.split(',').map(each => each.trim())
//     switch (orgType) {
//       case 'Customer':
//         OrganizationREF = customers.find((customer) => customer.Name === orgName && customer.City === orgCity)!.ObjectID as string
//         break;
//       case "Subcontractor":
//         OrganizationREF = subs.find((sub) => sub.Name === orgName && sub.City === orgCity)!.ObjectID as string
//         break;
//       case "Vendor":
//         OrganizationREF = vendors.find((vend) => vend.Name === orgName && vend.City === orgCity)!.ObjectID as string
//         break
//     }
//     return {OrganizationREF, ...rest}
//   })
//   const failedContacts = _createContacts(contactDTOs, token, baseUrl)
//   if(failedContacts.length > 0) {
//     highlightRows(failedContacts, 'red')
//     SpreadsheetApp.getUi().alert(`Some contacts failed to be created at rows: ${failedContacts.join(', ')}`)
//   } else {
//     SpreadsheetApp.getUi().alert("All contacts created successfully")
//   }

// }

// function _createContacts(contactDTOs: IContactDTO[], token: string, baseUrl: string) {
//   const failedRows: number[] = []
//   const batchOptions = contactDTOs.map((payload) => ({
//     url: `${baseUrl}/Resource/Organization/Contact`,
//     headers: createHeaders(token),
//     method: 'post' as const,
//     payload: JSON.stringify(payload),
//     muteHttpExceptions: true
//   }))
//   try {
//     const responses = batchFetch(batchOptions)
//     responses.forEach((response, index) => {
//       const responseCode = response.getResponseCode()
//       if(responseCode >= 400 && responseCode !== 409) {
//         Logger.log(`An error occured creating contact: "${contactDTOs[index].Name}". Error: ${response.getContentText()}`)
//         failedRows.push(index + 2)
//       } else if (responseCode === 409 || responseCode === 200) {
//         Logger.log(`Contact "${contactDTOs[index].Name}" already exists on resource with id: "${contactDTOs[index].OrganizationREF}"`)
//       } else {
//         Logger.log(`Contact "${contactDTOs[index].Name}" created successfully`)
//       }
//     })
//     return failedRows
//   } catch (err) {
//     Logger.log(err)
//     throw new Error("An unexpected error occured creating organization contacts. Check the logs for more details.")
//   }
// }
// function _createQuery(orgs: {Name: string, City:string, Type: TOrgType }[]) {
//   const query = `?$filter=EstimateREF eq ${ESTIMATE_REF} and (${orgs.map(org => `(Name eq '${org.Name}' and City eq '${org.City}')`).join(" or ")})`
//   return query
// }