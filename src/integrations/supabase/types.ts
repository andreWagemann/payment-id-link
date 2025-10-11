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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      authorized_persons: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          customer_id: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          nationality: string | null
          phone: string | null
          postal_code: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          nationality?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          nationality?: string | null
          phone?: string | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorized_persons_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficial_owners: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          customer_id: string
          date_of_birth: string | null
          first_name: string
          id: string
          last_name: string
          nationality: string | null
          ownership_percentage: number | null
          postal_code: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id: string
          date_of_birth?: string | null
          first_name: string
          id?: string
          last_name: string
          nationality?: string | null
          ownership_percentage?: number | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          customer_id?: string
          date_of_birth?: string | null
          first_name?: string
          id?: string
          last_name?: string
          nationality?: string | null
          ownership_percentage?: number | null
          postal_code?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficial_owners_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_products: {
        Row: {
          created_at: string | null
          customer_id: string
          id: string
          monthly_rent: number | null
          product_type: Database["public"]["Enums"]["product_type"]
          quantity: number
          setup_fee: number | null
          shipping_fee: number | null
          transaction_fee: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          id?: string
          monthly_rent?: number | null
          product_type: Database["public"]["Enums"]["product_type"]
          quantity?: number
          setup_fee?: number | null
          shipping_fee?: number | null
          transaction_fee?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          id?: string
          monthly_rent?: number | null
          product_type?: Database["public"]["Enums"]["product_type"]
          quantity?: number
          setup_fee?: number | null
          shipping_fee?: number | null
          transaction_fee?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_transaction_fees: {
        Row: {
          created_at: string | null
          customer_id: string
          ecommerce_credit_card_fee_percent: number | null
          ecommerce_girocard_fee_percent: number | null
          id: string
          pos_credit_card_fee_percent: number | null
          pos_girocard_fee_percent: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          ecommerce_credit_card_fee_percent?: number | null
          ecommerce_girocard_fee_percent?: number | null
          id?: string
          pos_credit_card_fee_percent?: number | null
          pos_girocard_fee_percent?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          ecommerce_credit_card_fee_percent?: number | null
          ecommerce_girocard_fee_percent?: number | null
          id?: string
          pos_credit_card_fee_percent?: number | null
          pos_girocard_fee_percent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_transaction_fees_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          city: string | null
          commercial_register: string | null
          company_name: string
          completed_at: string | null
          country: string
          created_at: string
          created_by: string | null
          id: string
          legal_form: Database["public"]["Enums"]["legal_form"]
          magic_link_expires_at: string | null
          magic_link_token: string | null
          postal_code: string | null
          status: Database["public"]["Enums"]["onboarding_status"]
          street: string | null
          tax_id: string | null
          updated_at: string
          vat_id: string | null
        }
        Insert: {
          city?: string | null
          commercial_register?: string | null
          company_name: string
          completed_at?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          id?: string
          legal_form: Database["public"]["Enums"]["legal_form"]
          magic_link_expires_at?: string | null
          magic_link_token?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          street?: string | null
          tax_id?: string | null
          updated_at?: string
          vat_id?: string | null
        }
        Update: {
          city?: string | null
          commercial_register?: string | null
          company_name?: string
          completed_at?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          id?: string
          legal_form?: Database["public"]["Enums"]["legal_form"]
          magic_link_expires_at?: string | null
          magic_link_token?: string | null
          postal_code?: string | null
          status?: Database["public"]["Enums"]["onboarding_status"]
          street?: string | null
          tax_id?: string | null
          updated_at?: string
          vat_id?: string | null
        }
        Relationships: []
      }
      document_checklist: {
        Row: {
          created_at: string | null
          customer_id: string
          document_type: Database["public"]["Enums"]["document_type"]
          id: string
          marked_as_available: boolean | null
          person_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          document_type: Database["public"]["Enums"]["document_type"]
          id?: string
          marked_as_available?: boolean | null
          person_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          id?: string
          marked_as_available?: boolean | null
          person_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_checklist_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checklist_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "authorized_persons"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          customer_id: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          person_id: string | null
          uploaded_at: string
        }
        Insert: {
          customer_id: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          person_id?: string | null
          uploaded_at?: string
        }
        Update: {
          customer_id?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          person_id?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures: {
        Row: {
          customer_id: string
          document_hash: string | null
          id: string
          ip_address: string | null
          privacy_accepted: boolean
          signature_data: string
          terms_accepted: boolean
          timestamp: string
          user_agent: string | null
        }
        Insert: {
          customer_id: string
          document_hash?: string | null
          id?: string
          ip_address?: string | null
          privacy_accepted?: boolean
          signature_data: string
          terms_accepted?: boolean
          timestamp?: string
          user_agent?: string | null
        }
        Update: {
          customer_id?: string
          document_hash?: string | null
          id?: string
          ip_address?: string | null
          privacy_accepted?: boolean
          signature_data?: string
          terms_accepted?: boolean
          timestamp?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      document_type:
        | "commercial_register"
        | "transparency_register"
        | "articles_of_association"
        | "id_document"
        | "proof_of_address"
        | "other"
      legal_form:
        | "gmbh"
        | "ag"
        | "einzelunternehmen"
        | "ohg"
        | "kg"
        | "ug"
        | "andere"
      onboarding_status: "draft" | "invited" | "in_progress" | "completed"
      product_type:
        | "mobile_terminal"
        | "stationary_terminal"
        | "softpos"
        | "ecommerce"
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
      document_type: [
        "commercial_register",
        "transparency_register",
        "articles_of_association",
        "id_document",
        "proof_of_address",
        "other",
      ],
      legal_form: [
        "gmbh",
        "ag",
        "einzelunternehmen",
        "ohg",
        "kg",
        "ug",
        "andere",
      ],
      onboarding_status: ["draft", "invited", "in_progress", "completed"],
      product_type: [
        "mobile_terminal",
        "stationary_terminal",
        "softpos",
        "ecommerce",
      ],
    },
  },
} as const
