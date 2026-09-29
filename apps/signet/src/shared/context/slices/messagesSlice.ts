import { useState } from 'react'
import {
  respond,
  MessageType,
  type Message
} from 'signet-sdk/src/messaging'
import type { BlockchainSlice } from './blockchainSlice'
import {
  PermissionService,
  MessageHandlerService,
  type PermissionRequest
} from '../services'

export interface MessagesState {
  messages: Message[]
  pendingPermissions: PermissionRequest[]
}

export interface MessagesActions {
  clearMessages: () => void
  addMessage: (message: Message) => void
  handleSDKMessage: (message: Message) => void
  approvePermission: (requestId: string) => void
  denyPermission: (requestId: string) => void
  rememberPermission: (requestId: string, allow: boolean) => void
}

export type MessagesSlice = MessagesState & MessagesActions

// Custom hook for the messages slice
export function useMessagesSlice(blockchainSlice: BlockchainSlice): MessagesSlice {
  const [messages, setMessages] = useState<Message[]>([])
  const [pendingPermissions, setPendingPermissions] = useState<PermissionRequest[]>([])

  // Create instances of our services
  const permissionService = new PermissionService()
  const messageHandlerService = new MessageHandlerService(blockchainSlice)

  // Clear all messages
  const clearMessages = () => setMessages([])

  // Add a new message
  function addMessage(message: Message) {
    setMessages(prev => [...prev, message])
  }

  // Handle an incoming SDK message
  async function handleSDKMessage(message: Message) {
    // Log all messages
    addMessage(message)

    // Skip non-request messages
    if (!message.request) {
      return
    }

    // Create a permission request object
    const permRequest = permissionService.createPermissionRequest(message)

    // Check if we have a valid permission
    try {
      const permissionCheck = await permissionService.checkPermission(permRequest)

      if (permissionCheck.hasPermission) {
        // Auto-handle the message since we have permission
        await messageHandlerService.handleMessage(message)
        return
      } else if (permissionCheck.shouldAsk) {
        // Add to pending permissions based on type
        if (messageHandlerService.isSupportedMessageType(message.type)) {
          setPendingPermissions(prev => [...prev, permRequest])
        } else {
          // Unknown message type - respond with error
          respond(message, undefined, {
            code: 'UNKNOWN_MESSAGE_TYPE',
            message: `Unknown message type: ${message.type}`
          })
        }
      } else {
        // Auto-deny the request based on saved preference
        respond(message, undefined, {
          code: 'PERMISSION_DENIED',
          message: 'Permission denied by saved preference'
        })
      }
    } catch (error) {
      console.error('Error checking permission:', error)
      // On error, default to asking for permission if it's a supported type
      if (messageHandlerService.isSupportedMessageType(message.type)) {
        setPendingPermissions(prev => [...prev, permRequest])
      } else {
        respond(message, undefined, {
          code: 'UNKNOWN_MESSAGE_TYPE',
          message: `Unknown message type: ${message.type}`
        })
      }
    }
  }

  // Approve a pending permission
  async function approvePermission(requestId: string) {
    // Find the permission request
    const request = pendingPermissions.find(p => p.id === requestId)
    if (!request) return

    // Find the original message
    const originalMessage = messages.find(m => m.id === request.messageId)
    if (!originalMessage) return

    // Immediately remove from pending permissions
    setPendingPermissions(prev => prev.filter(p => p.id !== requestId))
    
    // Then handle the approved message asynchronously
    try {
      await messageHandlerService.handleMessage(originalMessage)
    } catch (error) {
      console.error('Error handling approved message:', error)
      // No need to set pending permissions again - the UI has already been updated
    }
  }

  // Deny a pending permission
  function denyPermission(requestId: string) {
    // Find the permission request
    const request = pendingPermissions.find(p => p.id === requestId)
    if (!request) return

    // Find the original message
    const originalMessage = messages.find(m => m.id === request.messageId)
    if (!originalMessage) return

    // Immediately remove from pending permissions
    setPendingPermissions(prev => prev.filter(p => p.id !== requestId))
    
    // Then respond with permission denied error
    respond(originalMessage, undefined, {
      code: 'PERMISSION_DENIED',
      message: 'Permission denied by user'
    })

    // Refresh status to ensure UI is consistent
    messageHandlerService.refreshStatus()
  }

  // Remember permission for future use
  const rememberPermission = async (requestId: string, allow: boolean) => {
    // Find the permission request
    const request = pendingPermissions.find(p => p.id === requestId)
    if (!request) {
      console.error('Permission request not found:', requestId)
      return
    }

    // Immediately remove from pending permissions to dismiss UI
    setPendingPermissions(prev => prev.filter(p => p.id !== requestId))

    // Save the permission asynchronously
    try {
      await permissionService.savePermission(request, allow)
      
      // Process the permission request - we're using the existing functions but the UI is already updated
      if (allow) {
        // We need to get the message again since we're calling directly
        const originalMessage = messages.find(m => m.id === request.messageId)
        if (originalMessage) {
          await messageHandlerService.handleMessage(originalMessage)
        }
      } else {
        // Find the original message
        const originalMessage = messages.find(m => m.id === request.messageId)
        if (originalMessage) {
          respond(originalMessage, undefined, {
            code: 'PERMISSION_DENIED',
            message: 'Permission denied by user'
          })
          messageHandlerService.refreshStatus()
        }
      }
    } catch (error) {
      console.error('Error saving permission:', error)
      // UI is already updated, so we don't need to restore the pending permission
    }
  }

  return {
    // State
    messages,
    pendingPermissions,

    // Actions
    clearMessages,
    addMessage,
    handleSDKMessage,
    approvePermission,
    denyPermission,
    rememberPermission
  }
}