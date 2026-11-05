/**
 * cartStore.ts — Zustand store para el carrito del POS
 *
 * USA PERSISTENCIA EN localStorage:
 * - Las ventas suspendidas sobreviven recargas de página y navegación a otros módulos.
 * - El carrito activo también se recupera si el cajero cierra el navegador accidentalmente.
 *
 * Clave en localStorage: 'alcaravan-cart'
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Product, Customer, CartItem } from '@/types/database'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SuspendedCart {
  id: string
  items: CartItem[]
  customer: Customer | null
  notes: string
  suspended_at: string  // ISO string para mostrar cuándo se suspendió
  label?: string        // Nombre opcional (ej: "Mesa 3", "Cliente Pérez")
}

interface CartState {
  // Carrito activo
  items: CartItem[]
  customer: Customer | null
  notes: string
  // Ventas suspendidas (persisten en localStorage)
  suspended_carts: SuspendedCart[]
}

interface CartActions {
  // Carrito activo
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateItemDiscount: (productId: string, discountPercentage: number) => void
  setCustomer: (customer: Customer | null) => void
  setNotes: (notes: string) => void
  clearCart: () => void
  // Suspender / Recuperar
  suspendCart: (label?: string) => void
  recoverCart: (id: string) => void
  deleteCart: (id: string) => void
  // Totales (calculados)
  getSubtotal: () => number
  getDiscountAmount: () => number
  getTaxAmount: () => number
  getTotal: () => number
  getItemCount: () => number
}

// ─── Helpers de cálculo ───────────────────────────────────────────────────────

function calcItem(item: CartItem): CartItem {
  const subtotal = item.unit_price * item.quantity
  const discountAmount = subtotal * (item.discount_percentage / 100)
  const base = subtotal - discountAmount
  const taxAmount = item.product.iva_included
    ? base - base / (1 + item.product.iva_rate / 100)
    : base * (item.product.iva_rate / 100)
  return {
    ...item,
    discount_amount: discountAmount,
    subtotal,
    total: item.product.iva_included ? base : base + taxAmount,
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      // ── Estado inicial ─────────────────────────────────────────────────────
      items: [],
      customer: null,
      notes: '',
      suspended_carts: [],

      // ── Agregar producto ───────────────────────────────────────────────────
      addItem: (product: Product) => {
        set((state) => {
          const existing = state.items.find((i) => i.product.id === product.id)
          if (existing) {
            // Ya está en el carrito → aumentar cantidad
            return {
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? calcItem({ ...i, quantity: i.quantity + 1 })
                  : i
              ),
            }
          }
          // Producto nuevo
          const newItem: CartItem = calcItem({
            product,
            quantity: 1,
            unit_price: product.sale_price,
            discount_percentage: 0,
            discount_amount: 0,
            subtotal: product.sale_price,
            total: product.sale_price,
          })
          return { items: [...state.items, newItem] }
        })
      },

      // ── Quitar producto ────────────────────────────────────────────────────
      removeItem: (productId: string) => {
        set((state) => ({
          items: state.items.filter((i) => i.product.id !== productId),
        }))
      },

      // ── Cambiar cantidad ───────────────────────────────────────────────────
      updateQuantity: (productId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === productId
              ? calcItem({ ...i, quantity })
              : i
          ),
        }))
      },

      // ── Cambiar descuento de un ítem ───────────────────────────────────────
      updateItemDiscount: (productId: string, discountPercentage: number) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === productId
              ? calcItem({ ...i, discount_percentage: discountPercentage })
              : i
          ),
        }))
      },

      // ── Cliente y notas ────────────────────────────────────────────────────
      setCustomer: (customer) => set({ customer }),
      setNotes: (notes) => set({ notes }),

      // ── Limpiar carrito ────────────────────────────────────────────────────
      clearCart: () => set({ items: [], customer: null, notes: '' }),

      // ── Suspender carrito actual ───────────────────────────────────────────
      // Mueve el carrito activo a la lista de suspendidos y limpia el activo.
      suspendCart: (label?: string) => {
        const { items, customer, notes } = get()
        if (items.length === 0) return
        const suspended: SuspendedCart = {
          id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          items,
          customer,
          notes,
          suspended_at: new Date().toISOString(),
          label,
        }
        set((state) => ({
          suspended_carts: [...state.suspended_carts, suspended],
          items: [],
          customer: null,
          notes: '',
        }))
      },

      // ── Recuperar carrito suspendido ──────────────────────────────────────
      // Si hay items en el carrito activo, los suspende primero para no perderlos.
      recoverCart: (id: string) => {
        const state = get()
        const target = state.suspended_carts.find((sc) => sc.id === id)
        if (!target) return

        // Si hay carrito activo con items, suspenderlo antes de recuperar
        if (state.items.length > 0) {
          const tempSuspended: SuspendedCart = {
            id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            items: state.items,
            customer: state.customer,
            notes: state.notes,
            suspended_at: new Date().toISOString(),
          }
          set({
            suspended_carts: [
              ...state.suspended_carts.filter((sc) => sc.id !== id),
              tempSuspended,
            ],
            items: target.items,
            customer: target.customer,
            notes: target.notes,
          })
        } else {
          set({
            suspended_carts: state.suspended_carts.filter((sc) => sc.id !== id),
            items: target.items,
            customer: target.customer,
            notes: target.notes,
          })
        }
      },

      // ── Eliminar carrito suspendido sin recuperar ──────────────────────────
      deleteCart: (id: string) => {
        set((state) => ({
          suspended_carts: state.suspended_carts.filter((sc) => sc.id !== id),
        }))
      },

      // ── Totales ────────────────────────────────────────────────────────────
      getSubtotal: () =>
        get().items.reduce((s, i) => s + i.subtotal, 0),

      getDiscountAmount: () =>
        get().items.reduce((s, i) => s + i.discount_amount, 0),

      getTaxAmount: () =>
        get().items.reduce((s, i) => {
          const base = i.subtotal - i.discount_amount
          if (i.product.iva_rate === 0) return s
          if (i.product.iva_included) {
            return s + (base - base / (1 + i.product.iva_rate / 100))
          }
          return s + base * (i.product.iva_rate / 100)
        }, 0),

      getTotal: () =>
        get().items.reduce((s, i) => s + i.total, 0),

      getItemCount: () =>
        get().items.reduce((s, i) => s + i.quantity, 0),
    }),

    // ── Configuración de persistencia ──────────────────────────────────────
    {
      name: 'alcaravan-cart',           // clave en localStorage
      storage: createJSONStorage(() => {
        // Uso seguro de localStorage (puede fallar en modo privado)
        try {
          return localStorage
        } catch {
          // Si localStorage no está disponible, usar almacenamiento en memoria
          const mem: Record<string, string> = {}
          return {
            getItem: (k) => mem[k] ?? null,
            setItem: (k, v) => { mem[k] = v },
            removeItem: (k) => { delete mem[k] },
          }
        }
      }),
      // Solo persistir lo que debe sobrevivir recargas.
      // Los suspended_carts DEBEN persistir. El carrito activo también.
      partialize: (state) => ({
        items: state.items,
        customer: state.customer,
        notes: state.notes,
        suspended_carts: state.suspended_carts,
      }),
    }
  )
)
