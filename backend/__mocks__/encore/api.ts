import { jest } from '@jest/globals';

const apiFunction = jest.fn((options: any, handler: any) => handler);
const rawFunction = jest.fn((options: any, handler: any) => handler);

export const api = Object.assign(apiFunction, {
    raw: rawFunction
}); 