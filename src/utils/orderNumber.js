// src/utils/orderNumber.js

export function formatOrderNumber(orderType, orderNumber) {
  const prefixes = {
    workshop:       'B',
    cutting:        'C',
    painting:       'D',
    cnc:            'E',
    soft_fabric:    'F',
    soft_furniture: 'G',
  }
  const prefix = prefixes[orderType] || 'X'
  return `${prefix}-${orderNumber}`
}

export function formatProjectNumber(projectNumber) {
  return `A-${projectNumber}`
}