# Estimate Resource Creator
Used in conjunction with Google Sheets and Google Apps Scripts to send resources to the B2W Estimate API. 

It is highly recommended to make a copy of the production Google Sheets document and then use that to run your data uploads. Making a copy of the Google Sheet will also make a copy of the Apps Scripts.

[Link to Google Sheet](https://docs.google.com/spreadsheets/d/1yFlKXRHQUA9BAhoyHMqvTS01vBfpw-quvw50pHnAl98/edit?usp=sharing)

### Setup
```bash
# Run the command
# Installs clasp (Command Line Apps Scripts Projects) and other project dependencies
pnpm install
```

### Build 
```bash
# Build 
pnpm build
```

### Push to Production
```bash
# Runs the build command and then pushes compiled files to the production repository using clasp.
pnpm push
```

### Run Tests
```bash
# In order for the tests to work properly, the project files must be compiled from Typescript to Javascript. This is done with test script.
pnpm test

```

