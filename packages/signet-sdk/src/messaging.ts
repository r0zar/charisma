/**
 * Core messaging functionality for Signet SDK
 * A simple wrapper around window.postMessage to handle communication
 * between applications and the Signet extension
 */

/**
 * Enum of supported message types
 * Starting with the basic status/discovery messages
 */
export enum MessageType {
  // Status and discovery operations
  CHECK_EXTENSION_INSTALLED = 'check_extension_installed',
  GET_STATUS = 'get_status',

  // Subnet operations
  GET_BALANCE = 'get_balance',
  GET_BALANCES = 'get_balances',

  // Transaction operations
  CREATE_TRANSFER_TX = 'create_transfer_tx',
  SIGN_PREDICTION = 'sign_prediction',
  CLAIM_REWARDS = 'claim_rewards',

  // Dexterity operations
  EXECUTE_DEX_SWAP = 'execute_dex_swap',

  // Mempool operations
  REQUEST_TRANSACTION_CUSTODY = 'request_transaction_custody',
  SEARCH_MEMPOOL = 'search_mempool',

  // Contract operations
  DEPLOY_TOKEN_SUBNET = 'deploy_token_subnet',
  GENERATE_SUBNET_CODE = 'generate_subnet_code'
}

/**
 * Core message interface with improved typing
 */
export interface Message<T = unknown> {
  id: string
  timestamp: string

  // Message classification using enum
  type: MessageType

  // Origin for security
  origin?: string

  // Type-safe data payload
  data: T

  // Request/response handling
  request?: boolean
  response?: string

  // Error handling
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

// Internal state
const listeners: Array<(message: Message<any>) => void> = []
const pendingResponses: Map<string, {
  resolve: (response: Message<any>) => void
  reject: (error: Error) => void
  timeoutId: NodeJS.Timeout
}> = new Map()

// Auto-initialize listener on first import
setupListener()

/**
 * Handle incoming messages from window.postMessage
 */
function handleIncomingMessage(event: MessageEvent): void {
  // Check if this is a valid Signet message
  if (!isValidMessage(event.data)) {
    return
  }

  const message = event.data as Message<unknown>

  // Check if this is a response to a pending request
  if (message.response && pendingResponses.has(message.response)) {
    const { resolve, timeoutId } = pendingResponses.get(message.response)!

    // Clear the timeout (if it exists) and resolve the promise
    if (timeoutId) clearTimeout(timeoutId)
    resolve(message)

    // Remove from pending responses
    pendingResponses.delete(message.response)

    // We don't need to continue processing this as a new message
    return
  }

  // Notify all listeners
  listeners.forEach(listener => {
    try {
      listener(message)
    } catch (error) {
      console.error('Error in message listener:', error)
    }
  })
}

/**
 * Set up listener for incoming messages
 */
function setupListener(): void {
  window.addEventListener('message', handleIncomingMessage)
}

/**
 * Clean up when no longer needed
 */
export function cleanup(): void {
  window.removeEventListener('message', handleIncomingMessage)

  // Clear any pending response promises
  pendingResponses.forEach(({ reject, timeoutId }) => {
    if (timeoutId) clearTimeout(timeoutId)
    reject(new Error('Messaging system shut down'))
  })

  pendingResponses.clear()
  listeners.length = 0
}

/**
 * Prepare a message for sending
 */
function prepareMessage<T>(message: Partial<Message<T>> & { type: MessageType }): Message<T> {
  return {
    data: {} as T,
    ...message,
    id: message.id || (crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random()}`),
    timestamp: message.timestamp || new Date().toISOString(),
    origin: message.origin || window.location.origin
  }
}

/**
 * Check if data is a valid Signet message
 */
function isValidMessage(msg: any): boolean {
  return (
    msg &&
    typeof msg === 'object' &&
    'type' in msg &&
    'data' in msg &&
    'id' in msg &&
    'timestamp' in msg
  )
}

/**
 * Send a message without expecting a response
 */
export function send<T>(message: Partial<Message<T>> & { type: MessageType }): Message<T> {
  const finalMessage = prepareMessage(message)
  window.postMessage(finalMessage, '*')
  return finalMessage
}

/**
 * Send a message and wait for a response
 */
export async function request<TRequest, TResponse = unknown>(
  message: Partial<Message<TRequest>> & { type: MessageType },
  timeoutMs = 0
): Promise<Message<TResponse>> {
  const finalMessage = prepareMessage<TRequest>({
    ...message,
    request: true
  })

  const responsePromise = new Promise<Message<TResponse>>((resolve, reject) => {
    // Set up timeout to reject the promise if no response is received (unless timeoutMs is 0)
    let timeoutId: NodeJS.Timeout | null = null;

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        pendingResponses.delete(finalMessage.id)
        reject(new Error(`No response received within ${timeoutMs}ms`))
      }, timeoutMs);
    }

    // Store promise resolution functions and timeout ID
    pendingResponses.set(finalMessage.id, {
      resolve: resolve as any,
      reject,
      timeoutId: timeoutId as any // Cast needed for compatibility with existing type 
    })
  })

  // Send the message
  window.postMessage(finalMessage, '*')

  // Return the promise
  return responsePromise
}

/**
 * Send a response to a message
 */
export function respond<T>(
  originalMessage: Message<any>,
  data?: T,
  error?: { code: string; message: string; details?: unknown }
): Message<T> {
  const responseMessage = prepareMessage<T>({
    data: data as any || ({} as any),
    response: originalMessage.id,
    type: originalMessage.type as any,
    error
  })

  window.postMessage(responseMessage, '*')
  return responseMessage
}

/**
 * Subscribe to messages
 * Returns an unsubscribe function
 */
export function subscribe<T = unknown>(
  callback: (message: Message<T>) => void,
  filter?: { type?: MessageType | MessageType[] }
): () => void {
  // Create a wrapper that applies filters
  const wrappedCallback = (message: Message<any>) => {
    // Apply type filtering if specified
    if (filter?.type) {
      if (Array.isArray(filter.type)) {
        if (!filter.type.includes(message.type)) return;
      } else if (message.type !== filter.type) {
        return;
      }
    }

    callback(message as Message<T>);
  };

  listeners.push(wrappedCallback)

  // Return unsubscribe function
  return () => {
    const index = listeners.indexOf(wrappedCallback)
    if (index !== -1) {
      listeners.splice(index, 1)
    }
  }
}