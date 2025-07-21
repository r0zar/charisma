import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardPage from '@/app/dashboard/page'

// Mock recharts to avoid rendering issues in tests
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  Pie: () => <div data-testid="pie" />
}))

describe('Dashboard Page', () => {
  it('renders dashboard header', () => {
    render(<DashboardPage />)
    
    expect(screen.getByText('Balance Collection Dashboard')).toBeInTheDocument()
    expect(screen.getByText(/Monitor balance collection activity/i)).toBeInTheDocument()
  })

  it('displays basic functionality', () => {
    render(<DashboardPage />)
    
    // Just check that basic elements exist
    expect(screen.getAllByText('Total Collections').length).toBeGreaterThanOrEqual(1)
  })

  it('shows refresh button', async () => {
    const user = userEvent.setup()
    render(<DashboardPage />)
    
    const refreshButton = screen.getByText('Refresh Data')
    expect(refreshButton).toBeInTheDocument()
    
    await user.click(refreshButton)
    expect(refreshButton).toBeInTheDocument()
  })

  it('displays basic interface elements', () => {
    render(<DashboardPage />)
    
    // Check for basic UI elements without being too specific
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
    
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBeGreaterThan(0)
  })

  it('renders with proper accessibility', () => {
    render(<DashboardPage />)
    
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
    
    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBeGreaterThan(0)
  })
})