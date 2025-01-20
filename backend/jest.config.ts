import type { Config } from '@jest/types';
import { resolve } from 'path';

const config: Config.InitialOptions = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>'],
    testMatch: [
        '**/__tests__/**/*.+(ts|tsx|js)',
        '**/*.test.+(ts|tsx|js)'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
    },
    moduleNameMapper: {
        '^encore\\.dev/(.*)$': resolve(__dirname, './__mocks__/encore/$1.ts'),
        '^~encore/(.*)$': resolve(__dirname, './encore.gen/$1')
    },
    setupFilesAfterEnv: ['<rootDir>/youtube/tests/setup.ts'],
    moduleDirectories: ['node_modules', '<rootDir>']
};

export default config; 