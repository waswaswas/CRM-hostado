# Accounting Module Setup Guide

## Overview

The accounting module has been fully implemented with the following features:

- **Accounts Management**: Create and manage bank accounts, cash accounts, etc.
- **Transactions**: Record income, expenses, and transfers
- **Dashboard**: Financial overview with statistics and charts
- **Categories**: Default transaction categories for income and expenses

## Database Setup

### Step 1: Run the Migration

1. Open your Supabase SQL Editor
2. Run the migration file: `supabase/migration_accounting.sql`
3. This will create:
   - `accounts` table
   - `transactions` table
   - `transaction_categories` table
   - RLS policies
   - Triggers for automatic balance updates
   - Function to initialize default categories

### Step 2: Verify Tables

After running the migration, verify that the tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('accounts', 'transactions', 'transaction_categories');
```

## Features Implemented

### 1. Accounts Page (`/accounting/accounts`)
- List all accounts with current balances
- Create new accounts
- View account details
- Search and filter accounts

### 2. Transactions Page (`/accounting/transactions`)
- List all transactions with filters
- Filter by type (Income/Expense/Transfer)
- Filter by account
- Search transactions
- Sort by date (newest/oldest)
- Create new transactions
- View transaction details
- Edit transactions
- Delete transactions

### 3. Transaction Form
- Tabs for Income/Expense/Transfer
- All required fields with validation
- Auto-generated transaction numbers (TRA-XXXXX format)
- Link transactions to clients
- Support for transfers between accounts

### 4. Accounting Dashboard (`/accounting/dashboard`)
- Date range selector
- Summary cards (Total Income, Total Expenses, Profit)
- Cash Flow overview
- Profit & Loss overview
- Expenses by Category
- Account Balances
- Top Payers (customers who paid the most)

## Navigation

The Accounting section has been added to the main sidebar with:
- **Accounting** (main link) → redirects to `/accounting/transactions`
- Sub-navigation within accounting:
  - Accounts
  - Transactions
  - Dashboard

## Transaction Types

### Income
- Money coming into your business
- Increases account balance
- Can be linked to a customer/client

### Expense
- Money going out of your business
- Decreases account balance
- Can be linked to a vendor/client

### Transfer
- Moving money between accounts
- Creates two linked transactions:
  - Expense from source account
  - Income to destination account
- Net balance remains the same

## Default Categories

When a user first accesses the accounting module, default categories are automatically created:

**Income Categories:**
- Sales
- Transfer

**Expense Categories:**
- Expenses
- Transfer
- Events
- Other
- Salaries
- Ads
- Dani payouts
- Third party
- VAT

## Transaction Numbering

Transactions are automatically numbered in the format `TRA-XXXXX` (e.g., TRA-00001, TRA-00002).

## Account Balance Updates

Account balances are automatically updated when:
- A transaction is created
- A transaction is updated
- A transaction is deleted

This is handled by a database trigger that calculates the balance change based on transaction type.

## Next Steps

### Optional Enhancements:

1. **Chart Visualization**: Install a charting library (e.g., `recharts`) to add visual charts to the dashboard
2. **Excel Import**: Create a script to import transactions from the Excel file
3. **Reports**: Add more detailed financial reports
4. **Recurring Transactions**: Support for recurring income/expenses
5. **Attachments**: File upload support for transaction receipts/invoices
6. **Tax Management**: Full tax calculation and reporting

## Usage

1. **Create Accounts**: Go to `/accounting/accounts` and create your bank/cash accounts
2. **Record Transactions**: Go to `/accounting/transactions` and click "New Transaction"
3. **View Dashboard**: Go to `/accounting/dashboard` to see financial overview
4. **Link to Clients**: When creating income transactions, you can link them to clients for better reporting

## Notes

- All accounting data is protected by Row Level Security (RLS)
- Users can only see their own accounts and transactions
- Account balances are calculated automatically
- Transfer transactions create two linked records automatically















