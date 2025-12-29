# Import Transactions from Excel

## Overview

The accounting module includes functionality to import transactions from an Excel file. This allows you to bulk import your existing transaction data.

## Setup

1. **Install the required package:**
   ```bash
   npm install xlsx
   npm install --save-dev @types/xlsx
   ```

2. **Access the Import Page:**
   - Navigate to `/accounting/import` in your browser
   - Or click the "Import" button in the transactions list page

## Excel File Format

Your Excel file should have the following columns (case-insensitive):

- **Date**: Transaction date (can be in various formats: "23 Dec 2025", Excel date serial number, or ISO format)
- **Number**: Transaction number (e.g., "TRA-00575" or just "575")
- **Type**: Transaction type - "Income", "Expense", or "Transfer"
- **Category**: Transaction category (e.g., "Sales", "Expenses", "Transfer", "Events", etc.)
- **Account**: Account name (e.g., "Валентин", "Красимир", "Krasi Cash", "Bank account - hostado")
- **Contact**: Contact/client name (e.g., "Felisa", "Rumen - midwestlab", or "N/A")
- **Document**: Document reference or description (can be "N/A")
- **Amount**: Transaction amount (e.g., "лв330,00" or "330.00")

## Import Process

1. **Upload File**: Click "Choose File" and select your Excel file (.xlsx or .xls)

2. **Import**: Click the "Import" button

3. **Results**: The system will:
   - Create accounts automatically if they don't exist
   - Detect account types (Cash accounts from names containing "cash", etc.)
   - Match contacts to existing clients (exact match or partial match)
   - Create transactions with proper types (Income/Expense/Transfer)
   - Handle duplicate transaction numbers (skip if already exists)
   - Show a summary of what was imported

## Features

### Automatic Account Creation
- Accounts are created automatically if they don't exist
- Account types are detected from names:
  - Names containing "cash" → Cash account
  - Names containing "revolut" or "card" → Credit Card account
  - Names containing "bank" or "account" → Bank account
  - Default → Bank account

### Contact Matching
- Tries exact match first
- Falls back to partial match (e.g., "Rumen - midwestlab" matches "Rumen")
- If contact not found, transaction is still created (without contact link)

### Transaction Number Handling
- If transaction number is provided (e.g., "TRA-00575"), it's used
- If just a number is provided (e.g., "575"), it's formatted as "TRA-000575"
- If missing, auto-generated
- Duplicates are skipped with a warning

### Amount Parsing
- Handles Bulgarian format: "лв330,00" (comma as decimal separator)
- Handles standard format: "330.00"
- Removes currency symbols and spaces automatically

### Date Parsing
- Supports Excel date serial numbers
- Supports various date string formats
- Converts to ISO date format (YYYY-MM-DD)

## Error Handling

The import process will:
- Continue processing even if some rows fail
- Show detailed error messages for failed rows
- Display a summary of successful imports and errors
- Limit error display to first 50 errors (to avoid overwhelming the UI)

## Example Excel Structure

| Date | Number | Type | Category | Account | Contact | Document | Amount |
|------|--------|------|----------|---------|---------|----------|--------|
| 23 Dec 2025 | TRA-00575 | Income | Sales | Валентин | Felisa | N/A | лв330,00 |
| 20 Dec 2025 | TRA-00567 | Income | Sales | Валентин | Rumen - midwestlab | N/A | лв350,00 |
| 20 Dec 2025 | TRA-00569 | Expense | Transfer | Валентин | N/A | N/A | лв175,00 |

## Notes

- The import is idempotent: running it multiple times with the same data will skip duplicates
- Account balances are automatically updated when transactions are imported
- Transactions are linked to accounts and optionally to clients
- Categories are preserved as-is (they should match your default categories or will be stored as custom categories)




