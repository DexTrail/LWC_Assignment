const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    modulePathIgnorePatterns: ['<rootDir>/.localdevserver'],
    moduleNameMapper: {
        '^lightning/messageService$': '<rootDir>/force-app/tests/jest-mocks/lightning/messageService'
    }
};
