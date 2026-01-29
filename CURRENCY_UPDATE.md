# Currency Sign Update

**Date:** January 29, 2026  
**Change:** Updated currency formatting from ₹ (INR) to PKR

## Changes Made

### File Modified: `src/lib/format.ts`

**Before:**
```typescript
export function formatMoney(value: number, currency = "₹") {
```

**After:**
```typescript
export function formatMoney(value: number, currency = 'PKR') {
```

## Impact

This change affects all currency displays throughout the application:
- Dashboard financial KPIs
- Expense amounts
- Income amounts
- Wallet balances
- Approval amounts
- Invoice totals
- Project contract values
- Reports and exports

## Format Examples

**Previous:** ₹42,570.00  
**New:** PKR42,570.00

## Reason

AutoMatrix ERP is for Pakistani market, so using PKR (Pakistani Rupee) is more appropriate than INR (Indian Rupee) symbol.

## Areas Affected

All pages and components that display money values:
- `/dashboard`
- `/expenses`
- `/income`
- `/projects`
- `/employees` (wallet balances)
- `/invoices`
- `/approvals` (amount displays)
- `/reports`
- All API responses that include formatted money

## Testing

- ✅ All money displays now show "PKR" prefix
- ✅ Formatting still includes thousand separators
- ✅ Two decimal places maintained
- ✅ No breaking changes

