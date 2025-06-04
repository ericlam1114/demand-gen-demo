import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(cents) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function formatDate(date) {
  if (!date) return '--'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getStatusColor(status) {
  const colors = {
    draft: 'bg-gray-100 text-gray-800',
    sent: 'bg-blue-100 text-blue-800',
    opened: 'bg-green-100 text-green-800',
    paid: 'bg-emerald-100 text-emerald-800',
    escalated: 'bg-red-100 text-red-800',
  }
  return colors[status] || colors.draft
}

export function getStatusIcon(status) {
  const icons = {
    draft: '⚪',
    sent: '🔵',
    opened: '🟢',
    paid: '✅',
    escalated: '🔴',
  }
  return icons[status] || icons.draft
} 