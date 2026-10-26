'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/utils'
import type { Product, Customer, CartPayment, PaymentMethod, CartItem } from '@/types/database'

// ─── Datos del recibo ────────────────────────────────────────────────
interface ReceiptData {
  saleNumber: string
  date: Date
  items: {
    product_name: string
    quantity: number
    unit_price: number
    total: number
  }[]
  subtotal: number
  discount: number
  tax: number
  total: number
  payments: CartPayment[]
  customerName?: string
  notes?: string
}

// ─── Componente: Recibo / Ticket ─────────────────────────────────────
function ReceiptModal({ receipt, onClose }: { receipt: ReceiptData; onClose: () => void }) {
  const cashPayment = receipt.payments.find((p) => p.method === 'cash')
  const change = cashPayment?.received
    ? cashPayment.received - cashPayment.amount
    : 0

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Efectivo',
    card_debit: 'Débito',
    card_credit: 'Crédito',
    transfer: 'Transferencia',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    bancolombia: 'Bancolombia',
    other: 'Otro',
  }

  function handlePrint() {
    const w = window.open('', '_blank', 'width=400,height=700')
    if (!w) { window.print(); return }
    const cashPayment = receipt.payments.find((p) => p.method === 'cash')
    const changeAmt = cashPayment?.received ? cashPayment.received - cashPayment.amount : 0
