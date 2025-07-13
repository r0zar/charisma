"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import * as React from 'react';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

import { useWallet } from "./wallet-context";

interface AuthContextType {
    // Clerk auth state
    isLoaded: boolean;
    isSignedIn: boolean;
    userId: string | null;
    user: any; // Clerk user object
    
    // Combined auth state
    isAuthenticated: boolean;
    hasWallet: boolean;
    walletAddress: string | null;
    
    // Auth actions
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    isLoaded: false,
    isSignedIn: false,
    userId: null,
    user: null,
    isAuthenticated: false,
    hasWallet: false,
    walletAddress: null,
    signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const { isLoaded, isSignedIn, userId, signOut: clerkSignOut } = useAuth();
    const { user } = useUser();
    const { walletState } = useWallet();

    // Combined authentication state
    const isAuthenticated = isLoaded && isSignedIn && !!userId;
    const hasWallet = walletState.connected && !!walletState.address;
    const walletAddress = walletState.address || null;

    // Function to sign out completely
    const signOut = async () => {
        try {
            await clerkSignOut();
        } catch (error) {
            console.error('Failed to sign out:', error);
        }
    };

    const contextValue: AuthContextType = {
        // Clerk auth state
        isLoaded,
        isSignedIn: isSignedIn || false,
        userId: userId ?? null,
        user,
        
        // Combined auth state
        isAuthenticated,
        hasWallet,
        walletAddress,
        
        // Auth actions
        signOut,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAppAuth = () => useContext(AuthContext);