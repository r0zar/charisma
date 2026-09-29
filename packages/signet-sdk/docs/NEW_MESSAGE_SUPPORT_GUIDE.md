# Adding New Message Types to Signet SDK

This guide provides a step-by-step process for adding support for new message types in the Signet SDK ecosystem. Follow these steps to ensure all parts of the system are updated correctly.

## Overview of Message Flow

```
Web App → Signet SDK → Chrome Extension (content script) → Background Service → Implementation
```

## Complete Workflow Checklist

Here's a complete checklist for adding a new message type:

1. ✅ Add new message type to `MessageType` enum in `signet-sdk/src/messaging.ts`
2. ✅ Define interface types in `signet-sdk/src/index.ts`
3. ✅ Add helper function in `signet-sdk/src/index.ts`
4. ✅ Add message type to supported list in `MessageHandlerService.isSupportedMessageType()`
5. ✅ Add message handler method to `MessageHandlerService` class
6. ✅ Add case to `handleMessage()` switch statement in `MessageHandlerService`
7. ✅ Add message type to `MessageAction` type in `shared/context/types.ts`
8. ✅ Implement integration module or function (if needed) in `background/lib/`
9. ✅ Add case to background `handler.ts` switch statement
10. ✅ Test the full message flow

## Step 1: Define the Message Type

Add a new message type to the `MessageType` enum in `signet-sdk/src/messaging.ts`.

```typescript
export enum MessageType {
  // Existing message types...
  
  // Your new message type
  MY_NEW_MESSAGE_TYPE = 'my_new_message_type'
}
```

## Step 2: Define Interface Types (Optional)

If your message requires specific parameters, define an interface in the SDK's `index.ts` file:

```typescript
// Define the parameters for your message
export interface MyNewMessageParams {
  paramOne: string;
  paramTwo: number;
  optionalParam?: boolean;
}

// Define the response structure
export interface MyNewMessageResponse {
  success: boolean;
  result?: any;
  error?: string;
}
```

## Step 3: Add SDK Function

Add a helper function to `signet-sdk/src/index.ts` that handles the message request:

```typescript
/**
 * My new message helper function description
 * @param params The parameters for the message
 * @returns A promise resolving to the response
 */
export async function myNewMessageFunction(params: MyNewMessageParams): Promise<MyNewMessageResponse> {
  try {
    const response = await request<MyNewMessageParams, MyNewMessageResponse>({
      type: MessageType.MY_NEW_MESSAGE_TYPE,
      data: params
    }, 0); // 0 means no timeout - adjust as needed
    
    return response.data;
  } catch (error) {
    console.error('Failed to execute my new message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

## Step 4: Update MessageAction Type

Add your new message action to the `MessageAction` type in `shared/context/types.ts`:

```typescript
export type MessageAction =
  | "getStatus"
  | "getBalance"
  | "getBalances"
  // Existing actions...
  | "myNewMessageAction"  // Add your new action here
  // Wallet related actions...
```

This ensures type safety for message handlers and validates it at compile time.

## Step 5: Add Message Handler in Extension

### 5.1 Update isSupportedMessageType

Add your new message type to the supported types list in `message-handler-service.ts`:

```typescript
isSupportedMessageType(type: MessageType): boolean {
  return [
    // Existing types...
    MessageType.MY_NEW_MESSAGE_TYPE
  ].includes(type)
}
```

### 5.2 Add a message handler method

In the `MessageHandlerService` class, add a handler method for your new message:

```typescript
/**
 * Handle MY_NEW_MESSAGE_TYPE message
 */
async handleMyNewMessageType(message: Message): Promise<void> {
  try {
    // Extract parameters from the message
    const params = message.data as MyNewMessageParams;
    
    // Validate parameters
    if (!params.paramOne || typeof params.paramTwo !== 'number') {
      throw new Error("Required parameters missing or invalid");
    }
    
    // Forward to background script for processing
    const result = await this.sendMessage<MyNewMessageResponse>(
      "myNewMessageAction", 
      params
    );
    
    // Optional: Refresh state after operation
    if (this.blockchainSlice) {
      this.blockchainSlice.refreshStatus();
    }
    
    respond(message, result);
  } catch (error) {
    respond(message, undefined, {
      code: 'MY_NEW_MESSAGE_ERROR',
      message: error instanceof Error ? error.message : 'Operation failed'
    });
  }
}
```

### 5.3 Update the handleMessage switch statement

Add your new message type to the switch statement in `handleMessage`:

```typescript
async handleMessage(message: Message): Promise<void> {
  switch (message.type) {
    // Existing cases...
    
    case MessageType.MY_NEW_MESSAGE_TYPE:
      await this.handleMyNewMessageType(message);
      break;
      
    // Default case...
  }
}
```

## Step 6: Implement Integration Module (if needed)

If your message requires a new integration module (like Dexterity), create a dedicated file in `background/lib/` to handle the implementation details. For example:

```typescript
// In background/lib/my-integration.ts

/**
 * Implement the actual functionality for the message
 */
export async function performAction(params: {
  paramOne: string;
  paramTwo: number;
  optionalParam?: boolean;
}): Promise<{success: boolean; result?: any; error?: string}> {
  try {
    // Implementation logic here
    
    return {
      success: true,
      result: { /* your result data */ }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

## Step 7: Implement Background Handler

Update the background handler.ts file to handle your new message action:

```typescript
// In the switch statement of the handler function:
case "myNewMessageAction":
  // Validate input data
  if (!data.paramOne || typeof data.paramTwo !== 'number') {
    throw new Error("Invalid parameters");
  }
  
  // Implement the action
  response = await myIntegration.performAction({
    paramOne: data.paramOne,
    paramTwo: data.paramTwo,
    optionalParam: data.optionalParam
  });
  break;
```

## Step 8: Test the Message Flow

1. Test SDK function directly in a web app
2. Validate message is received by content script
3. Verify background handler processes the message correctly
4. Check response is correctly returned to the app

## Common Patterns

### Parameter Validation

Always validate parameters at each step of the message flow:
1. In the SDK helper function
2. In the content script handler
3. In the background handler

### Error Handling 

Use consistent error patterns:
```typescript
try {
  // Implementation
} catch (error) {
  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error'
  };
}
```

### Response Format

Maintain consistent response structure:
```typescript
{
  success: boolean;
  data?: any;
  error?: string;
}
```

## Example: Implementing EXECUTE_DEX_SWAP

Here's how we implemented the `EXECUTE_DEX_SWAP` message type following this guide:

1. Added `EXECUTE_DEX_SWAP` to the `MessageType` enum in `messaging.ts`:
   ```typescript
   export enum MessageType {
     // Existing message types...
     EXECUTE_DEX_SWAP = 'execute_dex_swap'
   }
   ```

2. Added interface types in `index.ts`:
   ```typescript
   export interface ExecuteSwapParams {
     route: DexterityRoute;
     amount: number;
     options?: {
       disablePostConditions?: boolean;
       sponsored?: boolean;
     };
   }

   export interface ExecuteSwapResponse {
     success: boolean;
     txId?: string;
     error?: string;
   }
   ```

3. Added helper function in `index.ts`:
   ```typescript
   export async function executeDexSwap(params: ExecuteSwapParams): Promise<ExecuteSwapResponse> {
     try {
       const response = await request<ExecuteSwapParams, ExecuteSwapResponse>({
         type: MessageType.EXECUTE_DEX_SWAP,
         data: params
       }, 0);
       
       return response.data;
     } catch (error) {
       console.error('Failed to execute Dexterity swap:', error);
       return {
         success: false,
         error: error instanceof Error ? error.message : 'Unknown error'
       };
     }
   }
   ```

4. Added `executeDexSwap` to the `MessageAction` type in `types.ts`:
   ```typescript
   export type MessageAction =
     // Existing actions...
     | "executeDexSwap"
     // Other actions...
   ```

5. Updated `isSupportedMessageType` in `message-handler-service.ts`:
   ```typescript
   isSupportedMessageType(type: MessageType): boolean {
     return [
       // Existing types...
       MessageType.EXECUTE_DEX_SWAP
     ].includes(type)
   }
   ```

6. Added handler method in `message-handler-service.ts`:
   ```typescript
   async handleExecuteDexSwap(message: Message): Promise<void> {
     try {
       // Extract parameters and validate
       const params = message.data as {
         route: { hops: Array<any> };
         amount: number;
         options?: any;
       };
       
       // Validate params
       if (!params.route || !params.route.hops || !Array.isArray(params.route.hops)) {
         throw new Error("Required parameters missing");
       }
       
       // Forward to background script
       const result = await this.sendMessage<{
         success: boolean;
         txId?: string;
         error?: string;
       }>("executeDexSwap", params);
       
       respond(message, result);
     } catch (error) {
       respond(message, undefined, {
         code: 'EXECUTE_DEX_SWAP_ERROR',
         message: error instanceof Error ? error.message : 'Failed to execute swap'
       });
     }
   }
   ```

7. Added implementation in `dexterity.ts`:
   ```typescript
   export async function executeDexSwap(
     params: {
       route: any;
       amount: number;
       options?: any;
     },
     stxAddress: string,
     privateKey?: string
   ): Promise<{ success: boolean; txId?: string; error?: string }> {
     try {
       // Implementation details...
       return { success: true, txId: "..." };
     } catch (error) {
       return {
         success: false,
         error: error instanceof Error ? error.message : "Unknown error"
       };
     }
   }
   ```

8. Added case in background `handler.ts`:
   ```typescript
   case "executeDexSwap":
     // Validate and process
     response = await dexterity.executeDexSwap(
       data,
       subnetRegistry.signer,
       (await wallet.getCurrentAccount())?.privateKey
     );
     break;
   ```

This complete example demonstrates all the necessary steps to implement a new message type in the Signet ecosystem.

By following this guide, you ensure that all parts of the Signet SDK ecosystem are properly updated to support your new message type.