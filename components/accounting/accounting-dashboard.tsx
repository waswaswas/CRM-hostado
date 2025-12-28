'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  getCashFlow,
  getProfitLoss,
  getExpensesByCategory,
  getTopPayers,
  getAccountBalances,
  getAccountingSummary,
} from '@/app/actions/accounting-stats'
import type {
  CashFlowData,
  ProfitLossData,
  ExpenseByCategory,
  TopPayer,
} from '@/app/actions/accounting-stats'
import { format } from 'date-fns'

interface AccountingDashboardProps {
  startDate: string
  endDate: string
}

export function AccountingDashboard({ startDate: initialStartDate, endDate: initialEndDate }: AccountingDashboardProps) {
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [loading, setLoading] = useState(true)
  const [cashFlow, setCashFlow] = useState<CashFlowData[]>([])
  const [profitLoss, setProfitLoss] = useState<ProfitLossData[]>([])
  const [expensesByCategory, setExpensesByCategory] = useState<ExpenseByCategory[]>([])
  const [topPayers, setTopPayers] = useState<TopPayer[]>([])
  const [accountBalances, setAccountBalances] = useState<Array<{ id: string; name: string; balance: number }>>([])
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, profit: 0 })

  useEffect(() => {
    loadData()
  }, [startDate, endDate])

  async function loadData() {
    setLoading(true)
    try {
      const [cashFlowData, profitLossData, expensesData, payersData, balancesData, summaryData] = await Promise.all([
        getCashFlow(startDate, endDate),
        getProfitLoss(startDate, endDate),
        getExpensesByCategory(startDate, endDate),
        getTopPayers(5, startDate, endDate),
        getAccountBalances(),
        getAccountingSummary(startDate, endDate),
      ])

      setCashFlow(cashFlowData)
      setProfitLoss(profitLossData)
      setExpensesByCategory(expensesData)
      setTopPayers(payersData)
      setAccountBalances(balancesData)
      setSummary(summaryData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: 'BGN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  if (loading) {
    return <div className="text-center py-8">Loading dashboard data...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
          <span>to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 border rounded-md"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatAmount(summary.totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatAmount(summary.totalExpense)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${summary.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatAmount(summary.profit)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cash Flow */}
        <Card>
          <CardHeader>
            <CardTitle>Cash Flow</CardTitle>
            <p className="text-sm text-muted-foreground">Cash coming in and going out of your business</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Incoming: {formatAmount(cashFlow.reduce((sum, d) => sum + d.incoming, 0))}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Outgoing: {formatAmount(cashFlow.reduce((sum, d) => sum + d.outgoing, 0))}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span>Profit: {formatAmount(cashFlow.reduce((sum, d) => sum + d.profit, 0))}</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Chart visualization would go here (requires charting library like recharts)
            </div>
          </CardContent>
        </Card>

        {/* Profit & Loss */}
        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss</CardTitle>
            <p className="text-sm text-muted-foreground">Income and expenses including unpaid invoices and bills</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Income: {formatAmount(profitLoss.reduce((sum, d) => sum + d.income, 0))}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Expense: {formatAmount(profitLoss.reduce((sum, d) => sum + d.expense, 0))}</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Chart visualization would go here (requires charting library like recharts)
            </div>
          </CardContent>
        </Card>

        {/* Expenses By Category */}
        <Card>
          <CardHeader>
            <CardTitle>Expenses By Category</CardTitle>
            <p className="text-sm text-muted-foreground">Top expenses across various categories</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expensesByCategory.slice(0, 10).map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>{item.category}</span>
                  </div>
                  <span className="font-medium">{formatAmount(item.amount)}</span>
                </div>
              ))}
              {expensesByCategory.length === 0 && (
                <p className="text-sm text-muted-foreground">No expense data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Balance */}
        <Card>
          <CardHeader>
            <CardTitle>Account Balance</CardTitle>
            <p className="text-sm text-muted-foreground">Current balance of your bank accounts</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {accountBalances.map((account) => (
                <div key={account.id} className="flex items-center justify-between text-sm">
                  <span>{account.name}</span>
                  <span className={`font-medium ${account.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatAmount(account.balance)}
                  </span>
                </div>
              ))}
              {accountBalances.length === 0 && (
                <p className="text-sm text-muted-foreground">No accounts available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Payers */}
        {topPayers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Top Payers</CardTitle>
              <p className="text-sm text-muted-foreground">Measures the amount of revenue from your company's top 5 customers</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {topPayers.map((payer, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>{payer.name}</span>
                    <span className="font-medium">{formatAmount(payer.amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}



