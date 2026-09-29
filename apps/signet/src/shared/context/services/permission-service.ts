import { Storage } from '@plasmohq/storage'
import { MessageType, type Message } from 'signet-sdk/src/messaging'

// Initialize storage for permissions
const permissionsStorage = new Storage({ area: "local" })

// Maximum permission age (30 days)
const MAX_PERMISSION_AGE_MS = 30 * 24 * 60 * 60 * 1000

// Simple permission data structure
export interface PermissionData {
  allowed: boolean
  timestamp: string
}

// Permission request structure
export interface PermissionRequest {
  id: string
  messageId: string
  type: MessageType
  origin: string
  timestamp: string
  data: any
}

// Result of a permission check
export interface PermissionCheckResult {
  hasPermission: boolean // True if the user has granted permission
  shouldAsk: boolean     // True if we should ask for permission (no saved preference)
  isExpired: boolean     // True if permission has expired
}

export class PermissionService {
  /**
   * Create a new permission request object from a message
   */
  createPermissionRequest(message: Message): PermissionRequest {
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random()}`,
      messageId: message.id,
      type: message.type,
      origin: message.origin || 'unknown',
      timestamp: new Date().toISOString(),
      data: message.data
    }
  }

  /**
   * Generate a unique key for storing a permission
   */
  getPermissionKey(origin: string, messageType: string): string {
    return `permission:${origin}:${messageType}`
  }

  /**
   * Check if there is a saved permission for a request
   * Returns information about the permission status
   */
  async checkPermission(request: PermissionRequest): Promise<PermissionCheckResult> {
    const permissionKey = this.getPermissionKey(request.origin, request.type)

    try {
      // Default result (no permission, should ask)
      const result: PermissionCheckResult = {
        hasPermission: false,
        shouldAsk: true,
        isExpired: false
      }

      // Fetch the specific permission
      const savedPermission = await permissionsStorage.get(permissionKey) as PermissionData | undefined

      // If we have a saved permission decision
      if (savedPermission && typeof savedPermission.allowed === 'boolean') {
        // Check if permission has expired
        const permissionTimestamp = new Date(savedPermission.timestamp).getTime()
        const currentTime = new Date().getTime()
        const isExpired = currentTime - permissionTimestamp > MAX_PERMISSION_AGE_MS

        if (isExpired) {
          console.log('Permission has expired, requesting new permission')
          result.isExpired = true
          // Permission expired, so we should ask again
          return result
        }

        // Permission is still valid
        result.hasPermission = savedPermission.allowed
        result.shouldAsk = false
        return result
      }

      // No saved permission, so we should ask
      return result
    } catch (error) {
      console.error(`Error checking permission for ${permissionKey}:`, error)
      // On error, default to asking for permission
      return { hasPermission: false, shouldAsk: true, isExpired: false }
    }
  }

  /**
   * Save a permission decision for future use
   */
  async savePermission(request: PermissionRequest, allow: boolean): Promise<void> {
    const permissionKey = this.getPermissionKey(request.origin, request.type)

    // Create the permission data
    const permissionData: PermissionData = {
      allowed: allow,
      timestamp: new Date().toISOString()
    }

    console.log(`Saving permission for ${permissionKey}:`, permissionData)

    try {
      // Save to storage
      await permissionsStorage.set(permissionKey, permissionData)
      console.log(`Permission saved successfully for ${permissionKey}`)
    } catch (error) {
      console.error(`Error saving permission for ${permissionKey}:`, error)
      throw error
    }
  }

  /**
   * Clear all saved permissions
   */
  async clearAllPermissions(): Promise<void> {
    try {
      // Get all keys and filter for permission keys
      const allPermissions = await permissionsStorage.getAll()
      const allKeys = Object.keys(allPermissions)
      const permissionKeys = allKeys.filter(key => key.startsWith('permission:'))

      // Delete each permission
      for (const key of permissionKeys) {
        await permissionsStorage.remove(key)
      }

      console.log(`Cleared ${permissionKeys.length} saved permissions`)
    } catch (error) {
      console.error('Error clearing permissions:', error)
      throw error
    }
  }
}