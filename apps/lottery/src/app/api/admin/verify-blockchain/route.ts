import { NextRequest, NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'
import { LotteryTicket } from '@/types/lottery'

function validateAdminAuth(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY

  if (!adminKey) {
    console.error('ADMIN_API_KEY environment variable not set')
    return false
  }

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

interface TicketVerification {
  ticketId: string
  walletAddress: string
  status: string
  purchasePrice: number
  purchaseDate: string
  transactionId: string | null
  explorerUrl: string | null
  hasIssue: boolean
  issueType: 'confirmed_no_txid' | 'pending_no_txid' | null
  issueMessage: string | null
}

const STACKS_EXPLORER_BASE = 'https://explorer.hiro.so/txid'

function analyzeTicket(ticket: LotteryTicket): TicketVerification {
  const hasTxId = !!ticket.transactionId
  const isConfirmed = ticket.status === 'confirmed'
  const isPending = ticket.status === 'pending'

  let hasIssue = false
  let issueType: 'confirmed_no_txid' | 'pending_no_txid' | null = null
  let issueMessage: string | null = null

  if (isConfirmed && !hasTxId) {
    hasIssue = true
    issueType = 'confirmed_no_txid'
    issueMessage = 'Confirmed ticket missing transaction ID'
  } else if (isPending && !hasTxId) {
    hasIssue = true
    issueType = 'pending_no_txid'
    issueMessage = 'Pending ticket missing transaction ID'
  }

  return {
    ticketId: ticket.id,
    walletAddress: ticket.walletAddress,
    status: ticket.status,
    purchasePrice: ticket.purchasePrice,
    purchaseDate: ticket.purchaseDate,
    transactionId: ticket.transactionId || null,
    explorerUrl: ticket.transactionId ? `${STACKS_EXPLORER_BASE}/${ticket.transactionId}?chain=mainnet` : null,
    hasIssue,
    issueType,
    issueMessage
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { startDate, endDate } = await request.json()

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    console.log('Blockchain verification request:', { startDate, endDate })

    // Get all tickets in date range
    const allTickets = await hybridStorage.getAllLotteryTickets()
    const ticketsInRange = allTickets.filter(ticket => {
      const purchaseDate = new Date(ticket.purchaseDate)
      return purchaseDate >= new Date(startDate) && purchaseDate <= new Date(endDate)
    })

    console.log(`Found ${ticketsInRange.length} tickets in date range`)

    // Analyze each ticket
    const verifications = ticketsInRange.map(analyzeTicket)

    // Sort: issues first, then by ticket ID
    verifications.sort((a, b) => {
      if (a.hasIssue && !b.hasIssue) return -1
      if (!a.hasIssue && b.hasIssue) return 1
      return a.ticketId.localeCompare(b.ticketId)
    })

    // Calculate statistics
    const totalTickets = verifications.length
    const ticketsWithIssues = verifications.filter(v => v.hasIssue).length
    const confirmedNoTxid = verifications.filter(v => v.issueType === 'confirmed_no_txid').length
    const pendingNoTxid = verifications.filter(v => v.issueType === 'pending_no_txid').length
    const ticketsWithTxid = verifications.filter(v => v.transactionId).length

    console.log(`Verification complete: ${ticketsWithIssues} tickets with issues`)

    return NextResponse.json({
      success: true,
      data: {
        tickets: verifications,
        stats: {
          totalTickets,
          ticketsWithIssues,
          confirmedNoTxid,
          pendingNoTxid,
          ticketsWithTxid
        }
      }
    })
  } catch (error) {
    console.error('Blockchain verification error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    )
  }
}
