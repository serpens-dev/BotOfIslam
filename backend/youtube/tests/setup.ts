import '@jest/globals';

// Mock für Encore Module
jest.mock('encore.dev/api', () => ({
    api: jest.fn((options: any, handler: any) => handler),
    raw: jest.fn((options: any, handler: any) => handler)
}));

// Mock für Encore Config
const mockSecret = (name: string) => () => `mock-${name}`;
jest.mock('encore.dev/config', () => ({
    secret: mockSecret
}));

// Mock für Encore Service
jest.mock('encore.dev/service', () => ({
    Service: jest.fn()
}));

// Mock für process.env
process.env.ENCORE_APP_PUBLIC_URL = 'https://test.example.com'; 