'use client'

import { useEffect, useState } from 'react'

export default function MigratePage() {
  const [status, setStatus] = useState('Loading...')

  useEffect(() => {
    const migrateData = async () => {
      try {
        // Get data from localStorage
        const stored = localStorage.getItem('lifeExtendedEvents')
        if (!stored) {
          setStatus('No data found in localStorage')
          return
        }

        // Send data to Redis
        const response = await fetch('/api/populate-redis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: stored
        })

        const result = await response.json()
        if (result.success) {
          setStatus(`Successfully migrated ${result.eventsCount} events to Redis (up to block ${result.lastBlock})`)
        } else {
          setStatus('Error: ' + result.error)
        }
      } catch (error) {
        setStatus('Error: ' + error)
      }
    }

    migrateData()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl mb-4">Redis Migration Status</h1>
      <div className="text-lg">{status}</div>
    </div>
  )
} 