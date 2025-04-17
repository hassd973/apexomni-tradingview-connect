
import React, { useEffect, useState } from 'react'

export default function BalanceCard() {
  const [balance, setBalance] = useState(null)

  useEffect(() => {
    fetch('/balance')
      .then(res => res.json())
      .then(data => setBalance(data.totalEquityValue))
      .catch(err => console.error('Balance fetch error:', err))
  }, [])

  return (
    <section>
      <h2>💰 Balance</h2>
      <p>{balance ? `$${parseFloat(balance).toFixed(2)}` : 'Loading...'}</p>
    </section>
  )
}
