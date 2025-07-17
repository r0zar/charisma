describe('Price Scheduler App', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', (err, runnable) => {
      if (err.message.includes('Hydration failed')) {
        return false
      }
    })
    cy.visit('http://localhost:3500')
  })

  it('loads the homepage', () => {
    cy.contains('Price Scheduler')
  })

  it('can navigate to history page', () => {
    cy.visit('http://localhost:3500/history')
    cy.url().should('include', '/history')
  })

  it('checks API status endpoint', () => {
    cy.request('GET', 'http://localhost:3500/api/status').then((response) => {
      expect(response.status).to.eq(200)
    })
  })

  it('checks engine health endpoint', () => {
    cy.request('GET', 'http://localhost:3500/api/engine-health').then((response) => {
      expect(response.status).to.eq(200)
    })
  })
})