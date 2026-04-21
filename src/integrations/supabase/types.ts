export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line: string
          city: string
          country: string
          created_at: string
          first_name: string
          id: string
          is_default: boolean
          last_name: string
          phone: string
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          city: string
          country: string
          created_at?: string
          first_name: string
          id?: string
          is_default?: boolean
          last_name: string
          phone: string
          state: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string
          country?: string
          created_at?: string
          first_name?: string
          id?: string
          is_default?: boolean
          last_name?: string
          phone?: string
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          payload: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          payload: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          payload?: Json
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
        }
        Insert: {
          product_id: string
          quantity: number
          updated_at?: string
          user_id: string
        }
        Update: {
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverers: {
        Row: {
          active: boolean
          city: string | null
          created_at: string
          id: string
          name: string
          phone: string
          state: string
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          name: string
          phone: string
          state: string
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string
          state?: string
        }
        Relationships: []
      }
      lga_delivery_prices: {
        Row: {
          id: string
          lga: string
          price: number
          state: string
          updated_at: string
        }
        Insert: {
          id?: string
          lga: string
          price?: number
          state: string
          updated_at?: string
        }
        Update: {
          id?: string
          lga?: string
          price?: number
          state?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_by_admin: boolean
          read_by_user: boolean
          sender: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_by_admin?: boolean
          read_by_user?: boolean
          sender: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_by_admin?: boolean
          read_by_user?: boolean
          sender?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          price: number
          product_id: string
          product_image: string
          product_name: string
          quantity: number
        }
        Insert: {
          id?: string
          order_id: string
          price: number
          product_id: string
          product_image: string
          product_name: string
          quantity: number
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          product_image?: string
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          deliverer_id: string | null
          delivery_stage: string
          id: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
          shipping: number
          shipping_address: Json
          status: string
          subtotal: number
          tax: number
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          deliverer_id?: string | null
          delivery_stage?: string
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          shipping?: number
          shipping_address: Json
          status?: string
          subtotal: number
          tax?: number
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          deliverer_id?: string | null
          delivery_stage?: string
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          shipping?: number
          shipping_address?: Json
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_deliverer_id_fkey"
            columns: ["deliverer_id"]
            isOneToOne: false
            referencedRelation: "deliverers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          authorization_code: string | null
          brand: string
          card_holder: string
          created_at: string
          email: string | null
          exp_month: string
          exp_year: string
          id: string
          is_default: boolean
          last4: string
          paystack_customer_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          authorization_code?: string | null
          brand: string
          card_holder: string
          created_at?: string
          email?: string | null
          exp_month: string
          exp_year: string
          id?: string
          is_default?: boolean
          last4: string
          paystack_customer_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          authorization_code?: string | null
          brand?: string
          card_holder?: string
          created_at?: string
          email?: string | null
          exp_month?: string
          exp_year?: string
          id?: string
          is_default?: boolean
          last4?: string
          paystack_customer_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string
          category: string
          colors: Json
          created_at: string
          delivery_price: number
          description: string
          details: Json
          discount_price: number | null
          id: string
          image: string
          images: Json
          is_active: boolean
          name: string
          price: number
          rating: number
          review_count: number
          reviews: Json
          sizes: Json
          stock: number
        }
        Insert: {
          brand: string
          category: string
          colors?: Json
          created_at?: string
          delivery_price?: number
          description: string
          details?: Json
          discount_price?: number | null
          id: string
          image: string
          images?: Json
          is_active?: boolean
          name: string
          price: number
          rating?: number
          review_count?: number
          reviews?: Json
          sizes?: Json
          stock?: number
        }
        Update: {
          brand?: string
          category?: string
          colors?: Json
          created_at?: string
          delivery_price?: number
          description?: string
          details?: Json
          discount_price?: number | null
          id?: string
          image?: string
          images?: Json
          is_active?: boolean
          name?: string
          price?: number
          rating?: number
          review_count?: number
          reviews?: Json
          sizes?: Json
          stock?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          created_at: string
          description: string
          id: string
          image: string | null
          is_free: boolean
          points: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          image?: string | null
          is_free?: boolean
          points?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image?: string | null
          is_free?: boolean
          points?: number
          title?: string
        }
        Relationships: []
      }
      user_interests: {
        Row: {
          created_at: string
          id: string
          kind: string
          product_id: string | null
          query: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          product_id?: string | null
          query?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          product_id?: string | null
          query?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
