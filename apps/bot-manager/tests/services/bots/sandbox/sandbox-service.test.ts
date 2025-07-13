/**
 * Unit tests for Sandbox Service
 * 
 * Tests sandbox creation, strategy execution, and security validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SandboxService,
  sandboxService
} from '@/lib/services/bots/sandbox/sandbox-service';
import { type Bot } from '@/schemas/bot.schema';
import { type BotContext, type StrategyExecutionResult } from '@/schemas/sandbox.schema';

// Mock external dependencies
vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: vi.fn()
  }
}));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue('test-uuid-123')
  };
});

vi.mock('dotenv', () => ({
  config: vi.fn()
}));

vi.mock('@/lib/modules/security/wallet-encryption', () => ({
  getPrivateKeyForExecution: vi.fn().mockReturnValue('test-private-key')
}));

vi.mock('@/lib/services/bots/execution/execution-log-service', () => ({
  ExecutionLogService: {
    store: vi.fn().mockResolvedValue({
      url: 'https://logs.example.com/log-123',
      size: 1024
    })
  }
}));

vi.mock('@/lib/services/bots/sandbox/templates/strategy-wrapper', () => ({
  strategyWrapperTemplate: vi.fn().mockReturnValue('wrapped-strategy-code')
}));

vi.mock('@/lib/services/bots/core/service', () => ({
  botService: {
    scanAllBots: vi.fn().mockResolvedValue([])
  }
}));

// Mock console to avoid noise during tests
vi.mock('console', () => ({
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}));

describe('Sandbox Service', () => {
  let mockBot: Bot;
  let mockSandbox: any;
  let mockVercelSandbox: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Set up environment variables
    process.env.VERCEL_TOKEN = 'test-token';
    process.env.VERCEL_TEAM_ID = 'test-team';
    process.env.VERCEL_PROJECT_ID = 'test-project';
    process.env.NEXT_PUBLIC_ENABLE_API_BOTS = 'false';
    
    mockBot = {
      id: 'SP1234567890ABCDEF1234567890ABCDEF12345678',
      name: 'Test Trading Bot',
      strategy: 'bot.trade({ symbol: "STX", amount: 100 });',
      status: 'active',
      ownerId: 'SP1111111111111111111111111111111111111111',
      createdAt: '2025-01-15T08:00:00.000Z',
      lastActive: '2025-01-15T08:00:00.000Z',
      imageType: 'pokemon',
      isScheduled: true,
      executionCount: 5,
      encryptedWallet: 'encrypted_data',
      walletIv: 'iv_data',
      publicKey: 'public_key'
    };

    // Mock sandbox instance
    mockSandbox = {
      sandboxId: 'sandbox-123',
      writeFiles: vi.fn(),
      runCommand: vi.fn(),
      stop: vi.fn()
    };

    // Mock Vercel Sandbox constructor
    mockVercelSandbox = (await import('@vercel/sandbox')).Sandbox;
    mockVercelSandbox.create.mockResolvedValue(mockSandbox);
  });

  describe('constructor and configuration', () => {
    it('should initialize with default configuration', () => {
      const service = new SandboxService();
      expect(service).toBeInstanceOf(SandboxService);
    });

    it('should accept custom configuration', () => {
      const customConfig = { timeout: 5 * 60 * 1000, runtime: 'node22' as const };
      const service = new SandboxService(customConfig);
      expect(service).toBeInstanceOf(SandboxService);
    });

    it('should use environment variables for default config', () => {
      const service = new SandboxService();
      expect(service).toBeInstanceOf(SandboxService);
    });
  });

  describe('buildBotContext', () => {
    it('should build bot context successfully', async () => {
      const context = await sandboxService.buildBotContext(mockBot);

      expect(context).toEqual({
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: {
          privateKey: 'test-private-key'
        }
      });
    });

    it('should handle missing wallet credentials', async () => {
      const { getPrivateKeyForExecution } = await import('@/lib/modules/security/wallet-encryption');
      vi.mocked(getPrivateKeyForExecution).mockReturnValueOnce(null);

      const context = await sandboxService.buildBotContext(mockBot);

      expect(context.walletCredentials).toEqual({});
    });

    it('should handle wallet encryption import failure', async () => {
      const context = await sandboxService.buildBotContext(mockBot);

      expect(context.walletCredentials).toEqual({
        privateKey: 'test-private-key'
      });
    });
  });

  describe('createStrategyWrapper', () => {
    it('should create strategy wrapper successfully', () => {
      const botContext: BotContext = {
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: {}
      };

      const result = sandboxService.createStrategyWrapper(mockBot.strategy, botContext);

      expect(result).toBe('wrapped-strategy-code');
    });

    it('should handle template generation failure', async () => {
      const { strategyWrapperTemplate } = await import('@/lib/services/bots/sandbox/templates/strategy-wrapper');
      vi.mocked(strategyWrapperTemplate).mockImplementationOnce(() => {
        throw new Error('Template error');
      });

      const botContext: BotContext = {
        id: mockBot.id,
        name: mockBot.name,
        status: mockBot.status,
        created_at: mockBot.createdAt,
        last_active: mockBot.lastActive,
        walletCredentials: {}
      };

      expect(() => {
        sandboxService.createStrategyWrapper(mockBot.strategy, botContext);
      }).toThrow('Failed to create strategy wrapper: Template error');
    });
  });

  describe('executeStrategy', () => {
    beforeEach(() => {
      // Mock execution command result
      const mockCommandResult = {
        exitCode: 0,
        logs: async function* () {
          yield { stream: 'stdout', data: Buffer.from('Strategy executed\nSTRATEGY_EXECUTION_COMPLETE\n') };
        }
      };
      mockSandbox.runCommand.mockResolvedValue(mockCommandResult);
    });

    it('should execute strategy successfully', async () => {
      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        { timeout: 2, enableLogs: false }
      );

      expect(result.success).toBe(true);
      expect(result.sandboxId).toBe('sandbox-123');
      expect(typeof result.executionTime).toBe('number');
      expect(mockVercelSandbox.create).toHaveBeenCalled();
      expect(mockSandbox.writeFiles).toHaveBeenCalled();
      expect(mockSandbox.runCommand).toHaveBeenCalled();
      expect(mockSandbox.stop).toHaveBeenCalled();
    });

    it('should handle missing Vercel credentials', async () => {
      delete process.env.VERCEL_TOKEN;

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing required Vercel credentials');
    });

    it('should execute with custom git repository', async () => {
      const botWithRepo = {
        ...mockBot,
        gitRepository: 'https://github.com/user/repo.git',
        isMonorepo: false
      };

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        botWithRepo,
        {}
      );

      expect(result.success).toBe(true);
      expect(mockVercelSandbox.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: {
            url: 'https://github.com/user/repo.git',
            type: 'git'
          }
        })
      );
    });

    it('should handle monorepo with package path', async () => {
      const botWithMonorepo = {
        ...mockBot,
        gitRepository: 'https://github.com/user/monorepo.git',
        isMonorepo: true,
        packagePath: 'packages/trading',
        buildCommands: ['pnpm install', 'pnpm build']
      };

      // Mock successful build commands
      mockSandbox.runCommand
        .mockResolvedValueOnce({ exitCode: 0 }) // install
        .mockResolvedValueOnce({ exitCode: 0 }) // build
        .mockResolvedValueOnce({ // strategy execution
          exitCode: 0,
          logs: async function* () {
            yield { stream: 'stdout', data: Buffer.from('STRATEGY_EXECUTION_COMPLETE\n') };
          }
        });

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        botWithMonorepo,
        {}
      );

      expect(result.success).toBe(true);
      expect(mockSandbox.runCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          cmd: 'pnpm',
          args: ['install'],
          cwd: '/vercel/sandbox/packages/trading'
        })
      );
    });

    it('should handle build command failures in monorepo', async () => {
      const botWithMonorepo = {
        ...mockBot,
        gitRepository: 'https://github.com/user/monorepo.git',
        isMonorepo: true,
        packagePath: 'packages/trading',
        buildCommands: ['pnpm install']
      };

      mockSandbox.runCommand.mockResolvedValue({
        exitCode: 1,
        stderr: 'Build failed'
      });

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        botWithMonorepo,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Command "pnpm install" failed');
    });

    it('should stream logs when enabled', async () => {
      const onLog = vi.fn();
      const onStatus = vi.fn();

      const mockCommandResult = {
        exitCode: 0,
        logs: async function* () {
          yield { stream: 'stdout', data: Buffer.from('Log line 1\nLog line 2\n') };
          yield { stream: 'stderr', data: Buffer.from('Error line 1\n') };
        }
      };
      mockSandbox.runCommand.mockResolvedValue(mockCommandResult);

      await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        { enableLogs: true },
        { onLog, onStatus }
      );

      expect(onLog).toHaveBeenCalledWith('info', 'Log line 1', expect.any(String));
      expect(onLog).toHaveBeenCalledWith('info', 'Log line 2', expect.any(String));
      expect(onLog).toHaveBeenCalledWith('error', 'Error line 1', expect.any(String));
    });

    it('should handle execution errors', async () => {
      const mockCommandResult = {
        exitCode: 1,
        logs: async function* () {
          yield { stream: 'stdout', data: Buffer.from('STRATEGY_EXECUTION_ERROR: Runtime error\n') };
        }
      };
      mockSandbox.runCommand.mockResolvedValue(mockCommandResult);

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Runtime error');
    });

    it('should store execution logs when userId provided', async () => {
      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        { enableLogs: true },
        undefined,
        'user-123',
        'exec-456'
      );

      expect(result.success).toBe(true);
      expect(result.logsUrl).toBe('https://logs.example.com/log-123');
      expect(result.logsSize).toBe(1024);
    });

    it('should handle sandbox creation failure', async () => {
      mockVercelSandbox.create.mockRejectedValue(new Error('Sandbox creation failed'));

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sandbox creation failed');
    });

    it('should cleanup sandbox even on failure', async () => {
      mockSandbox.runCommand.mockRejectedValue(new Error('Execution failed'));

      await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        {}
      );

      expect(mockSandbox.stop).toHaveBeenCalled();
    });

    it('should handle bot ID instead of bot object', async () => {
      const { botService } = await import('@/lib/services/bots/core/service');
      vi.mocked(botService.scanAllBots).mockResolvedValueOnce([mockBot]);

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot.id,
        {}
      );

      expect(result.success).toBe(true);
      expect(botService.scanAllBots).toHaveBeenCalled();
    });
  });

  describe('security validation', () => {
    let service: SandboxService;

    beforeEach(() => {
      service = new SandboxService();
    });

    it('should validate allowed git repositories', () => {
      const allowedUrls = [
        'https://github.com/user/repo.git',
        'https://gitlab.com/user/repo.git',
        'https://bitbucket.org/user/repo.git'
      ];

      allowedUrls.forEach(url => {
        expect((service as any).validateGitRepository(url)).toBe(true);
      });
    });

    it('should reject disallowed git repositories', () => {
      expect((service as any).validateGitRepository('https://malicious.com/repo.git')).toBe(false);
      expect((service as any).validateGitRepository('ftp://github.com/user/repo.git')).toBe(false);
      expect((service as any).validateGitRepository('invalid-url')).toBe(false);
      expect((service as any).validateGitRepository('https://evil-site.org/repo.git')).toBe(false);
    });

    it('should allow http github urls', () => {
      // HTTP github URLs should be allowed
      expect((service as any).validateGitRepository('http://github.com/user/repo.git')).toBe(true);
    });

    it('should validate allowed build commands', () => {
      const allowedCommands = [
        'npm install',
        'yarn build',
        'pnpm run test',
        'node script.js',
        'python setup.py'
      ];

      allowedCommands.forEach(commands => {
        expect((service as any).validateBuildCommands([commands])).toBe(true);
      });
    });

    it('should reject dangerous build commands', () => {
      const dangerousCommands = [
        'rm -rf /',
        'curl http://malicious.com',
        'wget evil.sh',
        'ssh user@server'
      ];

      dangerousCommands.forEach(command => {
        expect((service as any).validateBuildCommands([command])).toBe(false);
      });
    });

    it('should sanitize package paths', () => {
      const testCases = [
        { input: '../../../etc/passwd', expected: 'etc/passwd' },
        { input: '/absolute/path', expected: 'absolute/path' },
        { input: 'normal/path', expected: 'normal/path' },
        { input: '  spaced  ', expected: 'spaced' }
      ];

      testCases.forEach(({ input, expected }) => {
        expect((service as any).sanitizePackagePath(input)).toBe(expected);
      });
    });

    it('should reject invalid git repository in execution', async () => {
      const botWithInvalidRepo = {
        ...mockBot,
        gitRepository: 'https://malicious.com/repo.git'
      };

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        botWithInvalidRepo,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid or unsupported git repository');
    });

    it('should reject dangerous build commands in execution', async () => {
      const botWithDangerousCommands = {
        ...mockBot,
        gitRepository: 'https://github.com/user/repo.git',
        buildCommands: ['rm -rf /']
      };

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        botWithDangerousCommands,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid build commands detected');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle log storage failure gracefully', async () => {
      const { ExecutionLogService } = await import('@/lib/services/bots/execution/execution-log-service');
      vi.mocked(ExecutionLogService.store).mockRejectedValueOnce(new Error('Storage failed'));

      // Set up successful execution first
      const mockCommandResult = {
        exitCode: 0,
        logs: async function* () {
          yield { stream: 'stdout', data: Buffer.from('Strategy executed\nSTRATEGY_EXECUTION_COMPLETE\n') };
        }
      };
      mockSandbox.runCommand.mockResolvedValueOnce(mockCommandResult);

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        {},
        undefined,
        'user-123'
      );

      // Should still succeed even if log storage fails
      expect(result.success).toBe(true);
      expect(result.logsUrl).toBeUndefined();
    });

    it('should handle sandbox cleanup failure', async () => {
      mockSandbox.stop.mockRejectedValueOnce(new Error('Cleanup failed'));

      // Set up successful execution first
      const mockCommandResult = {
        exitCode: 0,
        logs: async function* () {
          yield { stream: 'stdout', data: Buffer.from('Strategy executed\nSTRATEGY_EXECUTION_COMPLETE\n') };
        }
      };
      mockSandbox.runCommand.mockResolvedValueOnce(mockCommandResult);

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        {}
      );

      expect(result.success).toBe(true); // Main execution should still succeed
    });

    it('should handle bot not found error', async () => {
      const { botService } = await import('@/lib/services/bots/core/service');
      vi.mocked(botService.scanAllBots).mockResolvedValueOnce([]);

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        'nonexistent-bot-id',
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Bot with ID \'nonexistent-bot-id\' not found');
    });

    it('should handle malformed execution results', async () => {
      const mockCommandResult = {
        exitCode: 0,
        logs: async function* () {
          yield { stream: 'stdout', data: Buffer.from('Malformed output') };
        }
      };
      mockSandbox.runCommand.mockResolvedValue(mockCommandResult);

      const result = await sandboxService.executeStrategy(
        mockBot.strategy,
        mockBot,
        {}
      );

      // Should handle missing completion marker
      expect(result.success).toBe(true); // Still succeeds with exit code 0
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(sandboxService).toBeInstanceOf(SandboxService);
    });

    it('should have all required methods', () => {
      expect(typeof sandboxService.executeStrategy).toBe('function');
      expect(typeof sandboxService.buildBotContext).toBe('function');
      expect(typeof sandboxService.createStrategyWrapper).toBe('function');
    });
  });
});