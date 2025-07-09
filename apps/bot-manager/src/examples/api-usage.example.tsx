// Example usage of the new API system in components
// This file demonstrates how to use the ApiContext and custom hooks

import React from 'react';
import { useApi } from '@/contexts/api-context';
import { useApiQuery, useApiMutation, useApiPagination } from '@/hooks/use-api-query';
import { API_ENDPOINTS, API_CACHE_KEYS } from '@/lib/api-endpoints';
import { Bot, CreateBotRequest } from '@/types/bot';

// Example 1: Basic API query with caching
function BotList() {
  const { data: bots, loading, error, refetch } = useApiQuery<Bot[]>(
    API_ENDPOINTS.BOTS.LIST,
    {
      cache: true,
      cacheKey: API_CACHE_KEYS.BOTS_LIST,
      showErrorNotification: true,
    }
  );

  if (loading) return <div>Loading bots...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={refetch}>Refresh</button>
      {bots?.map(bot => (
        <div key={bot.id}>{bot.name}</div>
      ))}
    </div>
  );
}

// Example 2: Mutation with success/error handling
function CreateBotForm() {
  const { mutate: createBot, loading, error } = useApiMutation(
    async (request: CreateBotRequest) => {
      const api = useApi();
      return api.post(API_ENDPOINTS.BOTS.CREATE, request, {
        showSuccessNotification: true,
        successMessage: 'Bot created successfully!',
      });
    },
    {
      onSuccess: (data, variables) => {
        console.log('Bot created:', data);
        // Could navigate to bot detail page
      },
      onError: (error, variables) => {
        console.error('Failed to create bot:', error);
      },
      invalidateCache: [API_CACHE_KEYS.BOTS_LIST],
    }
  );

  const handleSubmit = async (formData: CreateBotRequest) => {
    try {
      await createBot(formData);
    } catch (error) {
      // Error is already handled by the mutation
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      handleSubmit({
        name: 'Test Bot',
        strategy: 'yield-farming',
        maxGasPrice: 1000,
        slippageTolerance: 0.5,
        autoRestart: true,
      });
    }}>
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create Bot'}
      </button>
      {error && <div>Error: {error.message}</div>}
    </form>
  );
}

// Example 3: Paginated data
function BotListPaginated() {
  const {
    data: bots,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
  } = useApiPagination<Bot>(
    API_ENDPOINTS.BOTS.LIST,
    {
      initialLimit: 10,
      cache: true,
    }
  );

  return (
    <div>
      <button onClick={refresh}>Refresh</button>
      {bots.map(bot => (
        <div key={bot.id}>{bot.name}</div>
      ))}
      {hasMore && (
        <button onClick={loadMore} disabled={loading}>
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
      {error && <div>Error: {error.message}</div>}
    </div>
  );
}

// Example 4: Direct API usage with manual loading states
function BotDetail({ botId }: { botId: string }) {
  const api = useApi();
  const [bot, setBot] = React.useState<Bot | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchBot = async () => {
      try {
        const response = await api.get<Bot>(API_ENDPOINTS.BOTS.GET(botId), {
          cache: true,
          cacheKey: API_CACHE_KEYS.BOT_DETAIL(botId),
        });
        setBot(response.data);
      } catch (error) {
        console.error('Failed to fetch bot:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBot();
  }, [api, botId]);

  const handleStartBot = async () => {
    try {
      await api.post(API_ENDPOINTS.BOTS.START(botId), {}, {
        showSuccessNotification: true,
        successMessage: 'Bot started successfully!',
      });
      
      // Invalidate cache to refresh data
      api.clearCache(API_CACHE_KEYS.BOT_DETAIL(botId));
      api.clearCache(API_CACHE_KEYS.BOTS_LIST);
      
      // Refresh bot data
      const response = await api.get<Bot>(API_ENDPOINTS.BOTS.GET(botId));
      setBot(response.data);
    } catch (error) {
      // Error notification is handled by the API context
    }
  };

  if (loading) return <div>Loading bot...</div>;
  if (!bot) return <div>Bot not found</div>;

  return (
    <div>
      <h1>{bot.name}</h1>
      <p>Status: {bot.status}</p>
      <button onClick={handleStartBot}>Start Bot</button>
    </div>
  );
}

// Example 5: Using global loading states
function GlobalLoadingIndicator() {
  const api = useApi();
  const isLoading = api.isLoading();
  const error = api.getError();

  return (
    <div>
      {isLoading && <div>Loading...</div>}
      {error && <div>Global Error: {error.message}</div>}
    </div>
  );
}

// Example 6: Custom hook that combines API logic
function useBotOperations(botId: string) {
  const api = useApi();
  const { mutate: startBot, loading: startLoading } = useApiMutation(
    () => api.post(API_ENDPOINTS.BOTS.START(botId), {}, {
      showSuccessNotification: true,
      successMessage: 'Bot started successfully!',
    }),
    {
      invalidateCache: [
        API_CACHE_KEYS.BOT_DETAIL(botId),
        API_CACHE_KEYS.BOTS_LIST,
      ],
    }
  );

  const { mutate: pauseBot, loading: pauseLoading } = useApiMutation(
    () => api.post(API_ENDPOINTS.BOTS.PAUSE(botId), {}, {
      showSuccessNotification: true,
      successMessage: 'Bot paused successfully!',
    }),
    {
      invalidateCache: [
        API_CACHE_KEYS.BOT_DETAIL(botId),
        API_CACHE_KEYS.BOTS_LIST,
      ],
    }
  );

  const { mutate: deleteBot, loading: deleteLoading } = useApiMutation(
    () => api.delete(API_ENDPOINTS.BOTS.DELETE(botId), {
      showSuccessNotification: true,
      successMessage: 'Bot deleted successfully!',
    }),
    {
      invalidateCache: [
        API_CACHE_KEYS.BOT_DETAIL(botId),
        API_CACHE_KEYS.BOTS_LIST,
      ],
    }
  );

  return {
    startBot,
    pauseBot,
    deleteBot,
    loading: startLoading || pauseLoading || deleteLoading,
  };
}

// Example 7: Using the custom hook
function BotOperationsComponent({ botId }: { botId: string }) {
  const { startBot, pauseBot, deleteBot, loading } = useBotOperations(botId);

  return (
    <div>
      <button onClick={() => startBot()} disabled={loading}>
        Start Bot
      </button>
      <button onClick={() => pauseBot()} disabled={loading}>
        Pause Bot
      </button>
      <button onClick={() => deleteBot()} disabled={loading}>
        Delete Bot
      </button>
    </div>
  );
}

export {
  BotList,
  CreateBotForm,
  BotListPaginated,
  BotDetail,
  GlobalLoadingIndicator,
  BotOperationsComponent,
  useBotOperations,
};