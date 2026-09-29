import React, { type ReactNode } from 'react';
import { MessageType } from 'signet-sdk/src/messaging';
import { colors } from '~shared/styles/theme';
import { CustomIcons } from './Icons';
import type { FormattedNotification, PermissionRequest } from './types';
import {
  ExtensionCheckContent,
  GetStatusContent,
  BalanceContent,
  BalancesContent,
  TransferContent,
  TransactionCustodyContent,
  SearchMempoolContent,
  SwapContent,
  SignPredictionContent,
  ClaimRewardsContent,
  DefaultPermissionContent
} from './PermissionContent';

/**
 * Factory class to create notification objects based on permission requests
 */
export class NotificationFactory {
  /**
   * Creates a formatted notification object for a permission request
   */
  static createPermissionNotification(
    permission: PermissionRequest,
    rememberCheckbox: ReactNode
  ): FormattedNotification {
    // Different formatting based on message type
    switch (permission.type) {
      case MessageType.CHECK_EXTENSION_INSTALLED:
        return {
          title: 'EXTENSION CHECK',
          type: 'SDK_PERMISSION',
          color: colors.cyber,
          customIcon: CustomIcons.checkExtension,
          message: (
            <ExtensionCheckContent
              origin={permission.origin}
              rememberCheckbox={rememberCheckbox}
            />
          ),
          actions: this.getStandardActions()
        };

      case MessageType.GET_STATUS:
        return {
          title: 'GET STATUS REQUEST',
          type: 'SDK_PERMISSION',
          color: colors.cyber,
          customIcon: CustomIcons.getStatus,
          message: (
            <GetStatusContent
              origin={permission.origin}
              rememberCheckbox={rememberCheckbox}
            />
          ),
          actions: this.getStandardActions()
        };

      case MessageType.GET_BALANCE:
        return {
          title: 'BALANCE REQUEST',
          type: 'SDK_PERMISSION',
          color: colors.neonOrange,
          customIcon: CustomIcons.getBalance,
          message: (
            <BalanceContent
              origin={permission.origin}
              rememberCheckbox={rememberCheckbox}
            />
          ),
          actions: this.getStandardActions()
        };

      case MessageType.GET_BALANCES:
        return {
          title: 'ALL BALANCES REQUEST',
          type: 'SDK_PERMISSION',
          color: colors.neonOrange,
          customIcon: CustomIcons.getBalances,
          message: (
            <BalancesContent
              origin={permission.origin}
              rememberCheckbox={rememberCheckbox}
            />
          ),
          actions: this.getStandardActions()
        };

      case MessageType.CREATE_TRANSFER_TX:
        return {
          title: 'TRANSFER REQUEST',
          type: 'SDK_PERMISSION',
          color: colors.neonRed,
          customIcon: CustomIcons.createTransfer,
          message: (
            <TransferContent
              origin={permission.origin}
              rememberCheckbox={rememberCheckbox}
            />
          ),
          actions: this.getStandardActions()
        };

      case MessageType.SIGN_PREDICTION:
        return {
          title: 'PREDICTION REQUEST',
          type: 'SDK_PERMISSION',
          color: colors.neonRed,
          customIcon: CustomIcons.signPrediction,
          message: (
            <SignPredictionContent
              origin={permission.origin}
              rememberCheckbox={rememberCheckbox}
            />
          ),
          actions: this.getStandardActions()
        };

      case MessageType.CLAIM_REWARDS:
        return {
          title: 'CLAIM REWARDS',
          type: 'SDK_PERMISSION',
          color: colors.neonOrange,
          customIcon: CustomIcons.claimRewards,
          message: (
            <ClaimRewardsContent
              origin={permission.origin}
              rememberCheckbox={rememberCheckbox}
            />
          ),
          actions: this.getStandardActions()
        };


      case MessageType.REQUEST_TRANSACTION_CUSTODY:
        return {
          title: 'TRANSACTION CUSTODY REQUEST',
          type: 'SDK_PERMISSION',
          color: colors.neonRed,
          customIcon: CustomIcons.createTransfer, // Reusing transfer icon
          message: (
            <TransactionCustodyContent
              origin={permission.origin}
              rememberCheckbox={rememberCheckbox}
            />
          ),
          actions: this.getStandardActions()
        };

      case MessageType.SEARCH_MEMPOOL:
        return {
          title: 'MEMPOOL ACCESS REQUEST',
          type: 'SDK_PERMISSION',
          color: colors.cyber,
          customIcon: CustomIcons.searchMempool,
          message: (
            <SearchMempoolContent
              origin={permission.origin}
              rememberCheckbox={rememberCheckbox}
            />
          ),
          actions: this.getStandardActions()
        };

      case MessageType.EXECUTE_DEX_SWAP:
        return {
          title: 'TOKEN SWAP REQUEST',
          type: 'SDK_PERMISSION',
          color: colors.neonRed,
          customIcon: CustomIcons.createSwap,
          message: (
            <SwapContent
              origin={permission.origin}
              rememberCheckbox={rememberCheckbox}
              route={permission.data?.route}
              amount={permission.data?.amount}
              options={permission.data?.options}
            />
          ),
          actions: this.getStandardActions()
        };

      default:
        return {
          title: 'PERMISSION REQUEST',
          type: 'SDK_PERMISSION',
          color: colors.neonOrange,
          customIcon: CustomIcons.defaultPermission,
          message: (
            <DefaultPermissionContent
              origin={permission.origin}
              type={permission.type}
              rememberCheckbox={rememberCheckbox}
            />
          ),
          actions: this.getStandardActions()
        };
    }
  }

  /**
   * Returns standard actions for permission notifications
   */
  private static getStandardActions() {
    return [
      {
        id: 'reject',
        label: 'DENY',
        action: 'reject',
        color: colors.neonRed
      },
      {
        id: 'approve',
        label: 'APPROVE',
        action: 'approve',
        color: colors.neonGreen
      }
    ];
  }
}