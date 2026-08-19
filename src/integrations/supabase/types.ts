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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      business_settings: {
        Row: {
          business_name: string
          created_at: string
          id: string
          logo_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          business_name?: string
          created_at?: string
          id?: string
          logo_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          business_name?: string
          created_at?: string
          id?: string
          logo_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payout_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string
          payout_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type: string
          payout_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string
          payout_id?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_attachments_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_counters: {
        Row: {
          last_number: number
          user_id: string
        }
        Insert: {
          last_number?: number
          user_id: string
        }
        Update: {
          last_number?: number
          user_id?: string
        }
        Relationships: []
      }
      payout_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          line_total_pence: number
          name: string
          position: number
          quantity: number
          payout_id: string
          unit_price_pence: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          line_total_pence: number
          name: string
          position?: number
          quantity: number
          payout_id: string
          unit_price_pence: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          line_total_pence?: number
          name?: string
          position?: number
          quantity?: number
          payout_id?: string
          unit_price_pence?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_items_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          business_name_snapshot: string | null
          created_at: string
          currency: string
          worker_number_snapshot: number | null
          worker_phone_snapshot: string | null
          deleted_at: string | null
          id: string
          issue_date: string
          logo_path_snapshot: string | null
          notes: string | null
          pa_order_id: string | null
          pdf_path: string | null
          payout_number: string
          service_id: string | null
          service_name_snapshot: string | null
          status: string
          subtotal_pence: number
          total_pence: number
          updated_at: string
          user_id: string
          updated_by: string | null
          worker_id: string | null
        }
        Insert: {
          business_name_snapshot?: string | null
          created_at?: string
          currency?: string
          worker_number_snapshot?: number | null
          worker_phone_snapshot?: string | null
          deleted_at?: string | null
          id?: string
          issue_date?: string
          logo_path_snapshot?: string | null
          notes?: string | null
          pa_order_id?: string | null
          pdf_path?: string | null
          payout_number: string
          service_id?: string | null
          service_name_snapshot?: string | null
          status?: string
          subtotal_pence?: number
          total_pence?: number
          updated_at?: string
          user_id: string
          updated_by?: string | null
          worker_id?: string | null
        }
        Update: {
          business_name_snapshot?: string | null
          created_at?: string
          currency?: string
          worker_number_snapshot?: number | null
          worker_phone_snapshot?: string | null
          deleted_at?: string | null
          id?: string
          issue_date?: string
          logo_path_snapshot?: string | null
          notes?: string | null
          pa_order_id?: string | null
          pdf_path?: string | null
          payout_number?: string
          service_id?: string | null
          service_name_snapshot?: string | null
          status?: string
          subtotal_pence?: number
          total_pence?: number
          updated_at?: string
          user_id?: string
          updated_by?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_creator_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_updater_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_admin: boolean
          preferred_locale: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean
          preferred_locale?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          preferred_locale?: string
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          is_admin: boolean
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          is_admin?: boolean
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          is_admin?: boolean
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      receipt_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string
          receipt_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type: string
          receipt_id: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string
          receipt_id?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_attachments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_counters: {
        Row: {
          last_number: number
          user_id: string
        }
        Insert: {
          last_number?: number
          user_id: string
        }
        Update: {
          last_number?: number
          user_id?: string
        }
        Relationships: []
      }
      receipt_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          line_total_pence: number
          name: string
          position: number
          quantity: number
          receipt_id: string
          unit_price_pence: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          line_total_pence: number
          name: string
          position?: number
          quantity: number
          receipt_id: string
          unit_price_pence: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          line_total_pence?: number
          name?: string
          position?: number
          quantity?: number
          receipt_id?: string
          unit_price_pence?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          business_name_snapshot: string | null
          created_at: string
          currency: string
          customer_email: string | null
          deleted_at: string | null
          customer_name: string | null
          id: string
          issue_date: string
          logo_path_snapshot: string | null
          notes: string | null
          pa_order_id: string | null
          pdf_path: string | null
          receipt_number: string
          service_id: string | null
          service_name_snapshot: string | null
          status: string
          subtotal_pence: number
          total_pence: number
          updated_at: string
          user_id: string
          updated_by: string | null
        }
        Insert: {
          business_name_snapshot?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          deleted_at?: string | null
          customer_name?: string | null
          id?: string
          issue_date?: string
          logo_path_snapshot?: string | null
          notes?: string | null
          pa_order_id?: string | null
          pdf_path?: string | null
          receipt_number: string
          service_id?: string | null
          service_name_snapshot?: string | null
          status?: string
          subtotal_pence?: number
          total_pence?: number
          updated_at?: string
          user_id: string
          updated_by?: string | null
        }
        Update: {
          business_name_snapshot?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          deleted_at?: string | null
          customer_name?: string | null
          id?: string
          issue_date?: string
          logo_path_snapshot?: string | null
          notes?: string | null
          pa_order_id?: string | null
          pdf_path?: string | null
          receipt_number?: string
          service_id?: string | null
          service_name_snapshot?: string | null
          status?: string
          subtotal_pence?: number
          total_pence?: number
          updated_at?: string
          user_id?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_creator_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_updater_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          }
        ]
      }
      service_prices: {
        Row: {
          amount_pence: number
          created_at: string
          currency: string
          id: string
          service_id: string
          updated_at: string
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          amount_pence: number
          created_at?: string
          currency?: string
          id?: string
          service_id: string
          updated_at?: string
          user_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          amount_pence?: number
          created_at?: string
          currency?: string
          id?: string
          service_id?: string
          updated_at?: string
          user_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workers: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          phone: string
          updated_at: string
          user_id: string
          worker_number: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          phone: string
          updated_at?: string
          user_id: string
          worker_number?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          phone?: string
          updated_at?: string
          user_id?: string
          worker_number?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_payout: {
        Args: {
          _issue_date: string
          _items: Json
          _notes: string
          _pa_order_id?: string
          _service_id: string
          _worker_id: string
        }
        Returns: string
      }
      create_receipt: {
        Args: {
          _customer_email: string
          _customer_name: string
          _issue_date: string
          _items: Json
          _notes: string
          _pa_order_id?: string
          _service_id: string
        }
        Returns: string
      }
      resolve_service_price: {
        Args: { _at: string; _service_id: string }
        Returns: number
      }
      set_service_price: {
        Args: {
          _amount_pence: number
          _service_id: string
          _valid_from: string
        }
        Returns: {
          amount_pence: number
          created_at: string
          currency: string
          id: string
          service_id: string
          updated_at: string
          user_id: string
          valid_from: string
          valid_to: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_prices"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
