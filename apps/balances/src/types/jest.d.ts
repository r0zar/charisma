/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

import '@testing-library/jest-dom'

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R
      toHaveClass(className: string): R
      toHaveAttribute(attribute: string, value?: string): R
      toBeDisabled(): R
      toHaveTextContent(text: string | RegExp): R
      toBeGreaterThan(expected: number): R
      toBeGreaterThanOrEqual(expected: number): R
    }
  }
  
  var describe: jest.Describe
  var it: jest.It
  var test: jest.It
  var expect: jest.Expect
  var beforeEach: jest.Lifecycle
  var afterEach: jest.Lifecycle
  var beforeAll: jest.Lifecycle
  var afterAll: jest.Lifecycle
}