declare module 'gas-local' {
  export function require(folderPath: string, globalObject?: Object, options?: Object): any
  export interface GlobalMockDefaults {
    Logger: {
      enabled: boolean,
      log: (obj: any) => void,
    },
    Utilities: {
      formatString: (format: string, etc: string) => string,
      formatDate: (date: Date, tz: string, format: string) => Date
    },
    [key: string]: any
  }
  export const globalMockDefaults: GlobalMockDefaults
}
