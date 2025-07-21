import { NextRequest, NextResponse } from 'next/server'
import { getSchedulerJobs, createSchedulerJob, CreateSchedulerJobRequest } from '@/lib/actions'

export async function GET(_request: NextRequest) {
  try {
    const jobs = await getSchedulerJobs()
    
    return NextResponse.json({ 
      jobs,
      success: true 
    })
  } catch (error) {
    console.error('Scheduler jobs API error:', error)
    return NextResponse.json(
      { error: 'Failed to get scheduler jobs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateSchedulerJobRequest = await request.json()
    const job = await createSchedulerJob(body)
    
    return NextResponse.json({ 
      job,
      success: true 
    })
  } catch (error) {
    console.error('Create scheduler job API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: `Failed to create scheduler job: ${errorMessage}`,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}