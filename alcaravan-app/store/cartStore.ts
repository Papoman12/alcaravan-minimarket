import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem, CartPayment, Customer, Product } from '@/types/database'

interface CartStore {
  // Carrito
  items: CartItem[]
  customer: Customer | null
  notes: string
  discount_percentage: number
  suspended_carts: { id: string; items: CartItem[]; customer: Customer | null; timestamp: string }[]

  // Acciones
  addItem: (product: Product, quantity?: number) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  updateItemDiscount: (productId: string, discount: number) => void
  updateItemNotes: (productId: string, notes: string) => void
  setCustomer: (customer: Customer | null) => void
  setNotes: (notes: string) => void
  setDiscount: (discount: number) => void
  clearCart: () => void
  suspendCart: () => void
  recoverCart: (id: string) => void

  // Computed
  getSubtotal: () => number
  getDiscountAmount: () => number
  getTaxAmount: () => number
  getTotal: () => number
  getItemCount: () => number
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      customer: null,
      notes: '',
      discount_percentage: 0,
      suspended_carts: [],

      addItem: (product, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.product.id === product.id)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product.id === product.id
                  ? {
                      ...i,
                      quantity: i.quantity + quantity,
                      subtotal: (i.quantity + quantity) * i.unit_price,
                      total: (i.quantity + quantity) * i.unit_price * (1 - i.discount_percentage / 100),
                    }
                  : i
              ),
            }
          }
          const newItem: CartItem = {
            product,
            quantity,
            unit_price: product.sale_price,
            discount_percentage: 0,
            discount_amount: 0,
            subtotal: product.sale_price * quantity,
            total: product.sale_price * quantity,
          }
          return { items: [...state.items, newItem] }
        })
      },

      removeItem: (productId) => {
        set((state) => ({
          items: state.items.filter((i) => i.product.id !== productId),
        }))
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId)
          return
        }
        set((state) => ({
          items: state.items.map((i) => {
            if (i.product.id !== productId) return i
            const subtotal = quantity * i.unit_price
            const discountAmt = subtotal * (i.discount_percentage / 100)
            return {
              ...i,
              quantity,
              subtotal,
              discount_amount: discountAmt,
              total: subtotal - discountAmt,
            }
          }),
        }))
      },

      updateItemDiscount: (productId, discount) => {
        set((state) => ({
          items: state.items.map((i) => {
            if (i.product.id !== productId) return i
            const discountAmt = i.subtotal * (discount / 100)
            return {
              ...i,
              discount_percentage: discount,
              discount_amount: discountAmt,
              total: i.subtotal - discountAmt,
            }
          }),
        }))
      },

      updateItemNotes: (productId, notes) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.product.id === productId ? { ...i, notes } : i
          ),
        }))
      },

      setCustomer: (customer) => set({ customer }),
      setNotes: (notes) => set({ notes }),
      setDiscount: (discount) => set({ discount_percentage: discount }),

      clearCart: () => set({ items: [], customer: null, notes: '', discount_percentage: 0 }),

      suspendCart: () => {
        const state = get()
        if (state.items.length === 0) return
        const suspended = {
          id: Date.now().toString(),
          items: state.items,
          customer: state.customer,
          timestamp: new Date().toISOString(),
        }
        set((s) => ({
          suspended_carts: [...s.suspended_carts, suspended],
          items: [],
          customer: null,
          notes: '',
          discount_percentage: 0,
        }))
      },

      recoverCart: (id) => {
        const state = get()
        const cart = state.suspended_carts.find((c) => c.id === id)
        if (!cart) return
        set({
          items: cart.items,
          customer: cart.customer,
          suspended_carts: state.suspended_carts.filter((c) => c.id !== id),
        })
      },

      getSubtotal: () => {
        return get().items.reduce((sum, i) => sum + i.subtotal, 0)
      },

      getDiscountAmount: () => {
        const state = get()
        const itemDiscounts = state.items.reduce((sum, i) => sum + i.discount_amount, 0)
        const globalDiscount = state.getSubtotal() * (state.discount_percentage / 100)
        return itemDiscounts + globalDiscount
      },

      getTaxAmount: () => {
        return get().items.reduce((sum, i) => {
          const taxable = i.total
          const taxRate = i.product.iva_rate || 0
          return sum + (taxable * taxRate) / 100
        }, 0)
      },

      getTotal: () => {
        const state = get()
        return state.getSubtotal() - state.getDiscountAmount() + state.getTaxAmount()
      },

      getItemCount: () => {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },
    }),
    {
      name: 'alcaravan-cart',
      partialize: (state) => ({
        suspended_carts: state.suspended_carts,
      }),
    }
  )
)
