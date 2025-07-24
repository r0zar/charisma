import { LotteryConfig, DEFAULT_LOTTERY_CONFIG, PhysicalJackpot } from '@/types/lottery'
import { blobStorage } from './blob-storage'

export class LotteryConfigService {
  async getConfig(): Promise<LotteryConfig> {
    try {
      const config = await blobStorage.getLotteryConfig()
      
      if (!config) {
        // Initialize with default config if none exists
        console.log('No config found, initializing with defaults...')
        await blobStorage.saveLotteryConfig(DEFAULT_LOTTERY_CONFIG)
        return DEFAULT_LOTTERY_CONFIG
      }

      return config
    } catch (error) {
      console.error('Failed to get lottery config:', error)
      // If we can't read from blob storage, return defaults but don't throw
      console.log('Falling back to default configuration due to error')
      return DEFAULT_LOTTERY_CONFIG
    }
  }

  async updateConfig(updates: Partial<LotteryConfig>): Promise<LotteryConfig> {
    try {
      const currentConfig = await this.getConfig()
      
      const updatedConfig: LotteryConfig = {
        ...currentConfig,
        ...updates,
        lastModified: new Date().toISOString(),
        version: currentConfig.version + 1
      }

      await blobStorage.saveLotteryConfig(updatedConfig)
      return updatedConfig
    } catch (error) {
      console.error('Failed to update lottery config:', error)
      throw new Error('Unable to update lottery configuration')
    }
  }

  async initializeDefaultConfig(): Promise<LotteryConfig> {
    try {
      const configExists = await blobStorage.configExists()
      
      if (!configExists) {
        await blobStorage.saveLotteryConfig(DEFAULT_LOTTERY_CONFIG)
      }

      return DEFAULT_LOTTERY_CONFIG
    } catch (error) {
      console.error('Failed to initialize default config:', error)
      throw new Error('Unable to initialize lottery configuration')
    }
  }

  async getCurrentJackpot(): Promise<PhysicalJackpot> {
    const config = await this.getConfig()
    return config.currentJackpot
  }

  async getNextDrawTime(): Promise<string> {
    const config = await this.getConfig()
    return config.nextDrawDate
  }

  async isLotteryActive(): Promise<boolean> {
    const config = await this.getConfig()
    return config.isActive
  }
}

// Singleton instance
export const lotteryConfigService = new LotteryConfigService()