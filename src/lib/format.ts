export function formatMoney(value: number, currency = 'PKR ') {
  const isNegative = value < 0;
  const absoluteValue = Math.abs(value);
  const formattedValue = absoluteValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? '-' : ''}${currency}${formattedValue}`;
}
