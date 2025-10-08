/// <reference types="./types/eslint-plugin-googleappsscript" />

import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import googleappsscript from 'eslint-plugin-googleappsscript'
export default defineConfig([
  tseslint.configs.recommended,
  { 
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], 
    plugins: { 
      js,
      googleappsscript
     },
    extends: ["js/recommended"], 
    languageOptions: { 
      globals: globals.browser
    }
  }
]);
