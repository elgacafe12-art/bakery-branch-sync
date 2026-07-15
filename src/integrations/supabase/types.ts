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
      admin_notes: {
        Row: {
          archived: boolean
          category: Database["public"]["Enums"]["note_category"]
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          last_reminded_at: string | null
          owner_id: string
          pinned: boolean
          priority: Database["public"]["Enums"]["note_priority"]
          reminder_at: string | null
          reminder_dismissed: boolean
          status: Database["public"]["Enums"]["note_status"]
          title: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          category?: Database["public"]["Enums"]["note_category"]
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          last_reminded_at?: string | null
          owner_id: string
          pinned?: boolean
          priority?: Database["public"]["Enums"]["note_priority"]
          reminder_at?: string | null
          reminder_dismissed?: boolean
          status?: Database["public"]["Enums"]["note_status"]
          title: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          category?: Database["public"]["Enums"]["note_category"]
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          last_reminded_at?: string | null
          owner_id?: string
          pinned?: boolean
          priority?: Database["public"]["Enums"]["note_priority"]
          reminder_at?: string | null
          reminder_dismissed?: boolean
          status?: Database["public"]["Enums"]["note_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          new_value: Json | null
          previous_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      damage_logs: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          item_type: Database["public"]["Enums"]["item_type"] | null
          location: Database["public"]["Enums"]["location_type"]
          photo_url: string | null
          quantity: number | null
          reason: string
          reporter_id: string
          request_id: string | null
          resolved: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          location: Database["public"]["Enums"]["location_type"]
          photo_url?: string | null
          quantity?: number | null
          reason: string
          reporter_id: string
          request_id?: string | null
          resolved?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          location?: Database["public"]["Enums"]["location_type"]
          photo_url?: string | null
          quantity?: number | null
          reason?: string
          reporter_id?: string
          request_id?: string | null
          resolved?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "damage_logs_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean
          can_go_to_branch: boolean
          category: string | null
          created_at: string
          deleted_at: string | null
          id: string
          min_stock: number
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          can_go_to_branch?: boolean
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          min_stock?: number
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          can_go_to_branch?: boolean
          category?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          min_stock?: number
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          location: Database["public"]["Enums"]["location_type"]
          quantity: number
          updated_at: string
          ingredients: {
            active: boolean
            can_go_to_branch: boolean
            category: string | null
            created_at: string
            deleted_at: string | null
            id: string
            min_stock: number
            name: string
            unit: string
            updated_at: string
          } | null
          products: {
            active: boolean
            created_at: string
            deleted_at: string | null
            id: string
            min_stock: number
            name: string
            unit: string
            updated_at: string
          } | null
        }
        Insert: {
          id?: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          location: Database["public"]["Enums"]["location_type"]
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          location?: Database["public"]["Enums"]["location_type"]
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          location: Database["public"]["Enums"]["location_type"]
          movement: Database["public"]["Enums"]["movement_type"]
          notes: string | null
          performed_by: string | null
          quantity: number
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: Database["public"]["Enums"]["item_type"]
          location: Database["public"]["Enums"]["location_type"]
          movement: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          performed_by?: string | null
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          location?: Database["public"]["Enums"]["location_type"]
          movement?: Database["public"]["Enums"]["movement_type"]
          notes?: string | null
          performed_by?: string | null
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          push_enabled: boolean
          sound_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          push_enabled?: boolean
          sound_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          push_enabled?: boolean
          sound_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          item_type: Database["public"]["Enums"]["item_type"] | null
          link: string | null
          location: Database["public"]["Enums"]["location_type"] | null
          message: string
          metadata: Json
          priority: string
          pushed_at: string | null
          quantity: number | null
          read: boolean
          related_id: string | null
          related_type: string | null
          target_role: Database["public"]["Enums"]["app_role"] | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          link?: string | null
          location?: Database["public"]["Enums"]["location_type"] | null
          message: string
          metadata?: Json
          priority?: string
          pushed_at?: string | null
          quantity?: number | null
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          item_type?: Database["public"]["Enums"]["item_type"] | null
          link?: string | null
          location?: Database["public"]["Enums"]["location_type"] | null
          message?: string
          metadata?: Json
          priority?: string
          pushed_at?: string | null
          quantity?: number | null
          read?: boolean
          related_id?: string | null
          related_type?: string | null
          target_role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      portal_pins: {
        Row: {
          created_at: string
          pin: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          pin: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          pin?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      production_ingredients: {
        Row: {
          id: string
          ingredient_id: string
          production_id: string
          quantity_used: number
        }
        Insert: {
          id?: string
          ingredient_id: string
          production_id: string
          quantity_used: number
        }
        Update: {
          id?: string
          ingredient_id?: string
          production_id?: string
          quantity_used?: number
        }
        Relationships: [
          {
            foreignKeyName: "production_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_ingredients_production_id_fkey"
            columns: ["production_id"]
            isOneToOne: false
            referencedRelation: "productions"
            referencedColumns: ["id"]
          },
        ]
      }
      productions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          produced_by: string | null
          product_id: string
          quantity_produced: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          produced_by?: string | null
          product_id: string
          quantity_produced: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          produced_by?: string | null
          product_id?: string
          quantity_produced?: number
        }
        Relationships: [
          {
            foreignKeyName: "productions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          deleted_at: string | null
          id: string
          min_stock: number
          name: string
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          min_stock?: number
          name: string
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          deleted_at?: string | null
          id?: string
          min_stock?: number
          name?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
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
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      request_items: {
        Row: {
          approved_quantity: number | null
          damaged_quantity: number | null
          delivered_quantity: number | null
          id: string
          item_id: string
          missing_quantity: number | null
          notes: string | null
          quantity: number
          request_id: string
        }
        Insert: {
          approved_quantity?: number | null
          damaged_quantity?: number | null
          delivered_quantity?: number | null
          id?: string
          item_id: string
          missing_quantity?: number | null
          notes?: string | null
          quantity: number
          request_id: string
        }
        Update: {
          approved_quantity?: number | null
          damaged_quantity?: number | null
          delivered_quantity?: number | null
          id?: string
          item_id?: string
          missing_quantity?: number | null
          notes?: string | null
          quantity?: number
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "request_items_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_man_id: string | null
          from_location: Database["public"]["Enums"]["location_type"]
          id: string
          item_type: Database["public"]["Enums"]["item_type"]
          notes: string | null
          picked_up_at: string | null
          rejection_reason: string | null
          request_number: string
          requested_by: string
          status: Database["public"]["Enums"]["request_status"]
          to_location: Database["public"]["Enums"]["location_type"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_man_id?: string | null
          from_location: Database["public"]["Enums"]["location_type"]
          id?: string
          item_type: Database["public"]["Enums"]["item_type"]
          notes?: string | null
          picked_up_at?: string | null
          rejection_reason?: string | null
          request_number?: string
          requested_by: string
          status?: Database["public"]["Enums"]["request_status"]
          to_location: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_man_id?: string | null
          from_location?: Database["public"]["Enums"]["location_type"]
          id?: string
          item_type?: Database["public"]["Enums"]["item_type"]
          notes?: string | null
          picked_up_at?: string | null
          rejection_reason?: string | null
          request_number?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["request_status"]
          to_location?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
        }
        Relationships: []
      }
      supplier_deliveries: {
        Row: {
          created_at: string
          delivery_date: string
          id: string
          invoice_number: string | null
          notes: string | null
          received_by: string | null
          supplier_id: string
          total_amount: number
        }
        Insert: {
          created_at?: string
          delivery_date?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          received_by?: string | null
          supplier_id: string
          total_amount?: number
        }
        Update: {
          created_at?: string
          delivery_date?: string
          id?: string
          invoice_number?: string | null
          notes?: string | null
          received_by?: string | null
          supplier_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_deliveries_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_delivery_items: {
        Row: {
          delivery_id: string
          expiry_date: string | null
          id: string
          ingredient_id: string
          notes: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          delivery_id: string
          expiry_date?: string | null
          id?: string
          ingredient_id: string
          notes?: string | null
          quantity: number
          unit_price?: number
        }
        Update: {
          delivery_id?: string
          expiry_date?: string | null
          id?: string
          ingredient_id?: string
          notes?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "supplier_deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_delivery_items_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          address: string | null
          contact_person: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          supplies_raw_ingredients: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_person?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          supplies_raw_ingredients?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_person?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          supplies_raw_ingredients?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      emit_note_reminders: { Args: never; Returns: undefined }
      emit_reminders: { Args: never; Returns: undefined }
      ingredients: {
        Args: { "": Database["public"]["Tables"]["inventory"]["Row"] }
        Returns: {
          active: boolean
          can_go_to_branch: boolean
          category: string | null
          created_at: string
          deleted_at: string | null
          id: string
          min_stock: number
          name: string
          unit: string
          updated_at: string
        }
        SetofOptions: {
          from: "inventory"
          to: "ingredients"
          isOneToOne: true
          isSetofReturn: true
        }
      }
      item_display_name: {
        Args: { _id: string; _type: Database["public"]["Enums"]["item_type"] }
        Returns: string
      }
      notify_users: {
        Args: {
          _item_id?: string
          _item_type?: Database["public"]["Enums"]["item_type"]
          _link?: string
          _location?: Database["public"]["Enums"]["location_type"]
          _message: string
          _metadata?: Json
          _priority: string
          _quantity?: number
          _related_id?: string
          _related_type?: string
          _roles: Database["public"]["Enums"]["app_role"][]
          _title: string
          _type: string
          _user_ids: string[]
        }
        Returns: undefined
      }
      products: {
        Args: { "": Database["public"]["Tables"]["inventory"]["Row"] }
        Returns: {
          active: boolean
          created_at: string
          deleted_at: string | null
          id: string
          min_stock: number
          name: string
          unit: string
          updated_at: string
        }
        SetofOptions: {
          from: "inventory"
          to: "products"
          isOneToOne: true
          isSetofReturn: true
        }
      }
      role_for_location: {
        Args: { _loc: Database["public"]["Enums"]["location_type"] }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "central_store"
        | "central_bakery"
        | "delivery_man"
        | "branch_1"
        | "branch_2"
      item_type: "ingredient" | "product"
      location_type:
        | "central_store"
        | "central_bakery"
        | "branch_1"
        | "branch_2"
      movement_type:
        | "supplier_in"
        | "delivery_out"
        | "delivery_in"
        | "production_in"
        | "production_out"
        | "damage"
        | "adjustment"
        | "usage"
      note_category:
        | "inventory"
        | "suppliers"
        | "finance"
        | "staff"
        | "maintenance"
        | "branch_operations"
        | "central_store"
        | "central_bakery"
        | "general"
      note_priority: "low" | "medium" | "high"
      note_status: "pending" | "completed"
      request_status:
        | "pending"
        | "approved"
        | "rejected"
        | "assigned"
        | "picked_up"
        | "delivered"
        | "completed"
        | "cancelled"
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
      app_role: [
        "admin",
        "central_store",
        "central_bakery",
        "delivery_man",
        "branch_1",
        "branch_2",
      ],
      item_type: ["ingredient", "product"],
      location_type: [
        "central_store",
        "central_bakery",
        "branch_1",
        "branch_2",
      ],
      movement_type: [
        "supplier_in",
        "delivery_out",
        "delivery_in",
        "production_in",
        "production_out",
        "damage",
        "adjustment",
        "usage",
      ],
      note_category: [
        "inventory",
        "suppliers",
        "finance",
        "staff",
        "maintenance",
        "branch_operations",
        "central_store",
        "central_bakery",
        "general",
      ],
      note_priority: ["low", "medium", "high"],
      note_status: ["pending", "completed"],
      request_status: [
        "pending",
        "approved",
        "rejected",
        "assigned",
        "picked_up",
        "delivered",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
