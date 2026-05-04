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
      auth_email_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          last_sent_at: string
          purpose: string
          used: boolean
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          last_sent_at?: string
          purpose: string
          used?: boolean
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          last_sent_at?: string
          purpose?: string
          used?: boolean
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          product_id: string
          quantity: number
          updated_at: string
          user_id: string
          variant: Json | null
        }
        Insert: {
          product_id: string
          quantity: number
          updated_at?: string
          user_id: string
          variant?: Json | null
        }
        Update: {
          product_id?: string
          quantity?: number
          updated_at?: string
          user_id?: string
          variant?: Json | null
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
          email: string | null
          id: string
          name: string
          phone: string
          state: string
          user_id: string | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone: string
          state: string
          user_id?: string | null
        }
        Update: {
          active?: boolean
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string
          state?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_verification_links: {
        Row: {
          action_link: string
          consumed: boolean
          consumed_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          purpose: string
          token_hash: string
        }
        Insert: {
          action_link: string
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          purpose?: string
          token_hash: string
        }
        Update: {
          action_link?: string
          consumed?: boolean
          consumed_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          purpose?: string
          token_hash?: string
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
      login_attempts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          ip: string | null
          reason: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          reason: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          ip?: string | null
          reason?: string
          user_agent?: string | null
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
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          image: string | null
          kind: string
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          image?: string | null
          kind?: string
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          image?: string | null
          kind?: string
          read?: boolean
          title?: string
          user_id?: string | null
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
          variant: Json | null
        }
        Insert: {
          id?: string
          order_id: string
          price: number
          product_id: string
          product_image: string
          product_name: string
          quantity: number
          variant?: Json | null
        }
        Update: {
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          product_image?: string
          product_name?: string
          quantity?: number
          variant?: Json | null
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
          delivery_place: string | null
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
          delivery_place?: string | null
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
          delivery_place?: string | null
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
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          referred_by_code: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          referred_by_code?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          referred_by_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_devices: {
        Row: {
          created_at: string
          fingerprint: string
          hardware: Json | null
          id: string
          ip: string | null
          platform: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fingerprint: string
          hardware?: Json | null
          id?: string
          ip?: string | null
          platform?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fingerprint?: string
          hardware?: Json | null
          id?: string
          ip?: string | null
          platform?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          enrollment_id: string
          has_purchased: boolean
          id: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          has_purchased?: boolean
          id?: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          has_purchased?: boolean
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "reward_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_enrollments: {
        Row: {
          claimed_order_id: string | null
          claimed_product_id: string | null
          completed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          referral_code: string
          reward_id: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          claimed_order_id?: string | null
          claimed_product_id?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          referral_code: string
          reward_id: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          claimed_order_id?: string | null
          claimed_product_id?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          referral_code?: string
          reward_id?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_enrollments_claimed_product_id_fkey"
            columns: ["claimed_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_enrollments_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_task_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          reward_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          reward_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          reward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_task_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_task_products_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          created_at: string
          description: string
          expires_hours: number | null
          id: string
          image: string | null
          is_active: boolean
          is_free: boolean
          points: number
          product_amount: number | null
          purchase_percent: number | null
          referral_goal: number | null
          require_purchase: boolean
          reward_price: number | null
          task_type: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          expires_hours?: number | null
          id?: string
          image?: string | null
          is_active?: boolean
          is_free?: boolean
          points?: number
          product_amount?: number | null
          purchase_percent?: number | null
          referral_goal?: number | null
          require_purchase?: boolean
          reward_price?: number | null
          task_type?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          expires_hours?: number | null
          id?: string
          image?: string | null
          is_active?: boolean
          is_free?: boolean
          points?: number
          product_amount?: number | null
          purchase_percent?: number | null
          referral_goal?: number | null
          require_purchase?: boolean
          reward_price?: number | null
          task_type?: string
          title?: string
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string
          id: string
          query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          user_id?: string
        }
        Relationships: []
      }
      signup_verifications: {
        Row: {
          attempts: number
          code_hash: string
          consumed: boolean
          country: string | null
          created_at: string
          device_fp: string | null
          display_name: string | null
          email: string
          expires_at: string
          first_name: string | null
          id: string
          last_name: string | null
          last_sent_at: string
          password: string
          referral_code: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed?: boolean
          country?: string | null
          created_at?: string
          device_fp?: string | null
          display_name?: string | null
          email: string
          expires_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_sent_at?: string
          password: string
          referral_code?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed?: boolean
          country?: string | null
          created_at?: string
          device_fp?: string | null
          display_name?: string | null
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_sent_at?: string
          password?: string
          referral_code?: string | null
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          created_at: string
          device_cookie_id: string
          fingerprint: string | null
          id: string
          ip: string | null
          label: string | null
          last_seen_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          device_cookie_id: string
          fingerprint?: string | null
          id?: string
          ip?: string | null
          label?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          device_cookie_id?: string
          fingerprint?: string | null
          id?: string
          ip?: string | null
          label?: string | null
          last_seen_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_activity_days: {
        Row: {
          activity_date: string
          last_seen: string
          user_id: string
        }
        Insert: {
          activity_date: string
          last_seen?: string
          user_id: string
        }
        Update: {
          activity_date?: string
          last_seen?: string
          user_id?: string
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
      app_role: "admin" | "user" | "deliverer"
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
      app_role: ["admin", "user", "deliverer"],
    },
  },
} as const
