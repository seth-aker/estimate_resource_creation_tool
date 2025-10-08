// Typescript REALLY didin't like that this line of code didn't exist, so I had to add it.
declare module 'eslint-plugin-googleappsscript' {
    import type { Linter } from 'eslint'
    const plugin: {
        environments: {
            googleappsscript: {
                globals: Record<string, boolean>
            }
        }
    }
    export default plugin
}
