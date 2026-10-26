// Tipos TypeScript para la base de datos de Alcaraván

export type UserRole = 'admin' | 'cashier' | 'inventory' | 'kitchen' | 'delivery'

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

export type PaymentMethod =
  | 'cash'
  | 'card_debit'
  | 'card_credit'
  | 'transfer'
  | 'nequi'
  | 'daviplata'
  | 'bancolombia'
  | 'loyalty_points'
  | 'other'

export type SaleStatus = 'pending' | 'completed' | 'cancelled' | 'returned' | 'suspended'

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'delivered' | 'cancelled'

export type DeliveryStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'on_way'
  | 'delivered'
  | 'cancelled'

export interface Branch {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  is_main: boolean
  is_active: boolean
  created_at: string
}

export interface Role {
  id: string
  name: string
  display_name: string
  description?: string
  permissions: Record<string, unknown>
  is_system: boolean
}

export interface User {
  id: string
  email: string
  full_name: string
  phone?: string
  avatar_url?: string
  role_id?: string
  branch_id?: string
  is_active: boolean
  role?: Role
  branch?: Branch
}

export interface Category {
  id: string
  name: string
  slug: string
  parent_id?: string
  type: 'minimarket' | 'cafeteria' | 'both'
  icon?: string
  color?: string
  sort_order: number
  is_active: boolean
}

export interface Brand {
  id: string
  name: string
  is_active: boolean
}

export interface Supplier {
  id: string
  branch_id?: string
  name: string
  company_name?: string
  nit?: string
  contact_name?: string
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  city?: string
  payment_terms: number
  payment_terms_type: 'cash' | 'credit' | 'consignment'
  notes?: string
  is_active: boolean
  created_at: string
}

export interface UnitOfMeasure {
  id: string
  name: string
  abbreviation: string
  type: 'unit' | 'weight' | 'volume' | 'length'
}

export interface Product {
  id: string
  branch_id?: string
  code?: string
  barcode?: string
  name: string
  description?: string
  category_id?: string
  brand_id?: string
  supplier_id?: string
  unit_id?: string
  purchase_price: number
  sale_price: number
  min_sale_price: number
  iva_rate: number
  iva_included: boolean
  stock: number
  min_stock: number
  max_stock: number
  has_expiry: boolean
  product_type: 'physical' | 'prepared' | 'service'
  has_recipe: boolean
  allows_fractions: boolean
  is_featured: boolean
  is_active: boolean
  image_url?: string
  shelf_location?: string
  created_at: string
  updated_at: string
  // Joins
  category?: Category
  brand?: Brand
  supplier?: Supplier
  unit?: UnitOfMeasure
  // Computed
  stock_status?: StockStatus
  margin_percentage?: number
}

export interface Customer {
  id: string
  branch_id?: string
  document_type: 'CC' | 'NIT' | 'CE' | 'PA' | 'TI'
  document_number?: string
  first_name: string
  last_name?: string
  full_name: string
  name?: string
  phone?: string
  whatsapp?: string
  email?: string
  address?: string
  city?: string
  birth_date?: string
  notes?: string
  loyalty_points: number
  loyalty_tier: 'standard' | 'frequent' | 'vip'
  total_purchases: number
  purchase_count: number
  last_purchase_at?: string
  is_active: boolean
  created_at: string
}

export interface CashRegister {
  id: string
  branch_id?: string
  cashier_id?: string
  opened_at: string
  opening_amount: number
  opening_notes?: string
  closed_at?: string
  expected_cash?: number
  actual_cash?: number
  cash_difference?: number
  closing_notes?: string
  total_cash: number
  total_card: number
  total_transfer: number
  total_nequi: number
  total_daviplata: number
  total_other: number
  total_sales: number
  total_returns: number
  status: 'open' | 'closed'
  cashier?: User
}

export interface Sale {
  id: string
  branch_id?: string
  sale_number: string
  cashier_id?: string
  customer_id?: string
  cash_register_id?: string
  subtotal: number
  discount_amount: number
  discount_percentage: number
  tax_amount: number
  total: number
  status: SaleStatus
  notes?: string
  loyalty_points_earned: number
  loyalty_points_redeemed: number
  created_at: string
  // Joins
  customer?: Customer
  cashier?: User
  items?: SaleItem[]
  payments?: SalePayment[]
}

export interface SaleItem {
  id: string
  sale_id: string
  product_id?: string
  product_name: string
  product_code?: string
  quantity: number
  unit_price: number
  purchase_price: number
  discount_percentage: number
  discount_amount: number
  tax_rate: number
  tax_amount: number
  subtotal: number
  total: number
  notes?: string
  product?: Product
}

export interface SalePayment {
  id: string
  sale_id: string
  payment_method: PaymentMethod
  amount: number
  reference?: string
  received_amount?: number
  change_amount: number
}

export interface InventoryMovement {
  id: string
  branch_id?: string
  product_id?: string
  movement_type: string
  quantity: number
  stock_before: number
  stock_after: number
  unit_cost: number
  reference_id?: string
  reference_type?: string
  reason?: string
  notes?: string
  created_by?: string
  created_at: string
  product?: Product
  user?: User
}

// Cart types (POS)
export interface CartItem {
  product: Product
  quantity: number
  unit_price: number
  discount_percentage: number
  discount_amount: number
  subtotal: number
  total: number
  notes?: string
}

export interface CartPayment {
  method: PaymentMethod
  amount: number
  reference?: string
  received?: number
  change?: number
}

// Dashboard types
export interface DashboardStats {
  today_sales: number
  today_transactions: number
  today_profit: number
  avg_ticket: number
  month_sales: number
  month_transactions: number
  low_stock_count: number
  out_of_stock_count: number
  expiring_soon_count: number
  open_cash_register?: CashRegister
}
