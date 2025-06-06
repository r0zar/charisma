import { signedFetch } from 'blaze-sdk';

// Admin API functions
export async function getSystemStatus() {
    try {
        const res = await fetch('/api/admin/status', {
            method: 'GET',
            cache: 'no-store'
        });
        if (!res.ok) throw new Error('Failed to fetch status');
        return res.json();
    } catch (error) {
        console.error('Error fetching status:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function resetSpin() {
    try {
        const res = await signedFetch('/api/admin/reset', {
            method: 'POST',
            message: 'Reset spin',
            body: JSON.stringify({})
        });
        if (!res.ok) throw new Error('Failed to reset spin');
        return res.json();
    } catch (error) {
        console.error('Error resetting spin:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function setWinner(tokenId: string) {
    try {
        const res = await signedFetch('/api/admin/winner', {
            method: 'POST',
            message: 'Set winner',
            body: JSON.stringify({ tokenId })
        });
        if (!res.ok) throw new Error('Failed to set winner');
        return res.json();
    } catch (error) {
        console.error('Error setting winner:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function setSpinTime(timestamp: number) {
    try {
        const res = await signedFetch('/api/admin/spin-time', {
            method: 'POST',
            message: 'Set spin time',
            body: JSON.stringify({ timestamp })
        });
        if (!res.ok) throw new Error('Failed to set spin time');
        return res.json();
    } catch (error) {
        console.error('Error setting spin time:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function updateTokenBet(tokenId: string, amount: number) {
    try {
        const res = await signedFetch('/api/admin/token-bet', {
            method: 'POST',
            message: 'Set token bet',
            body: JSON.stringify({ tokenId, amount })
        });
        if (!res.ok) throw new Error('Failed to update token bet');
        return res.json();
    } catch (error) {
        console.error('Error updating token bet:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function getUserVotes(userId?: string) {
    try {
        const url = userId
            ? `/api/admin/user-votes?userId=${encodeURIComponent(userId)}`
            : '/api/admin/user-votes';

        const res = await fetch(url, { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch user votes');
        return res.json();
    } catch (error) {
        console.error('Error fetching user votes:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function getRoundDuration() {
    try {
        const res = await fetch('/api/admin/round-duration', { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch round duration');
        return res.json();
    } catch (error) {
        console.error('Error fetching round duration:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function setRoundDuration(durationMinutes: number) {
    try {
        const res = await signedFetch('/api/admin/round-duration', {
            method: 'POST',
            message: 'Set round duration',
            body: JSON.stringify({ durationMinutes })
        });
        if (!res.ok) throw new Error('Failed to update round duration');
        return res.json();
    } catch (error) {
        console.error('Error updating round duration:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function getLockDuration() {
    try {
        const res = await fetch('/api/admin/lock-duration', { method: 'GET', cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to fetch lock duration');
        return res.json();
    } catch (error) {
        console.error('Error fetching lock duration:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function setLockDuration(durationMinutes: number) {
    try {
        const res = await signedFetch('/api/admin/lock-duration', {
            method: 'POST',
            message: 'Set lock duration',
            body: JSON.stringify({ durationMinutes })
        });
        if (!res.ok) throw new Error('Failed to update lock duration');
        return res.json();
    } catch (error) {
        console.error('Error updating lock duration:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
}

export async function validateUserBalances() {
    try {
        const res = await signedFetch('/api/admin/validate-balances', {
            method: 'POST',
            message: 'Validate user balances',
            body: JSON.stringify({})
        });
        if (!res.ok) throw new Error('Failed to validate balances');
        return res.json();
    } catch (error) {
        console.error('Error validating balances:', error);
        return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
} 