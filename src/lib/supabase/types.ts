/**
 * Supabase database types.
 *
 * Hand-written to match `supabase/migrations/0001_init.sql`. Regenerate with
 * the CLI once a project exists, and this file should be replaced wholesale:
 *
 *   supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 *
 * Kept in the generated shape (`Database['public']['Tables'][...]`) so the
 * client's generic parameter and the result of that command are compatible.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

interface Table<Row, Insert = Partial<Row>, Update = Partial<Row>> {
  Row: Row;
  Insert: Insert & { id?: string };
  Update: Update;
  Relationships: [];
}

export interface Database {
  public: {
    Tables: {
      taxonomy_terms: Table<{
        id: string;
        kind: string;
        slug: string;
        name: string;
        short_description: string;
        description: string | null;
        aka: string[];
        concentration: string | null;
        benefits: string[];
        origin: string | null;
        hero_product_id: string | null;
        promise: string | null;
        seo_title: string | null;
        seo_description: string | null;
        image_id: string | null;
        icon: string | null;
        position: number;
        visible: boolean;
        created_at: string;
        updated_at: string;
      }>;

      images: Table<{
        id: string;
        url: string;
        alt: string;
        width: number | null;
        height: number | null;
        blur_data_url: string | null;
        created_at: string;
        /* 0002: storage provenance for admin uploads */
        storage_path: string | null;
        mime_type: string | null;
        byte_size: number | null;
        uploaded_by: string | null;
        updated_at: string;
      }>;

      /* 0002: who may use the admin panel, and with what role */
      admin_users: Table<{
        user_id: string;
        email: string;
        full_name: string;
        role: 'admin' | 'editor';
        active: boolean;
        created_at: string;
        updated_at: string;
      }>;

      /* 0005: newsletter subscribers. Public may insert only. */
      newsletter_subscribers: Table<{
        id: string;
        email: string;
        confirmed_at: string | null;
        source: string;
        created_at: string;
        updated_at: string;
      }>;

      /* 0002: first-visit onboarding slides */
      onboarding_slides: Table<{
        id: string;
        eyebrow: string | null;
        title: string;
        body: string;
        image_id: string | null;
        icon: string | null;
        cta_label: string | null;
        cta_href: string | null;
        position: number;
        enabled: boolean;
        created_at: string;
        updated_at: string;
      }>;

      products: Table<{
        id: string;
        slug: string;
        name: string;
        subtitle: string;
        brand: string;
        short_description: string;
        description: string;
        highlights: string[];
        benefits: string[];
        usage: string[];
        ingredients_text: string;
        warnings: string[] | null;
        price: number;
        compare_at_price: number | null;
        currency: string;
        category_id: string;
        product_type: Database['public']['Enums']['product_type'];
        size: string;
        stock_quantity: number;
        available_for_sale: boolean;
        low_stock_threshold: number;
        dispatch_estimate: string | null;
        is_featured: boolean;
        is_best_seller: boolean;
        is_new_arrival: boolean;
        related_product_ids: string[];
        frequently_bought_with_ids: string[];
        position: number;
        visible: boolean;
        seo_title: string | null;
        seo_description: string | null;
        created_at: string;
        updated_at: string;
      }>;

      product_images: Table<{
        product_id: string;
        image_id: string;
        position: number;
        is_primary: boolean;
      }>;

      product_variants: Table<{
        id: string;
        product_id: string;
        sku: string;
        name: string;
        size: string;
        price: number;
        compare_at_price: number | null;
        stock_quantity: number;
        image_id: string | null;
        position: number;
        is_default: boolean;
        created_at: string;
        updated_at: string;
      }>;

      product_badges: Table<{
        id: string;
        product_id: string;
        label: string;
        tone: Database['public']['Enums']['badge_tone'];
        position: number;
      }>;

      product_key_ingredients: Table<{
        product_id: string;
        ingredient_id: string;
        note: string;
        position: number;
      }>;

      product_collections: Table<{
        product_id: string;
        collection_id: string;
        position: number;
      }>;

      product_skin_types: Table<{
        product_id: string;
        skin_type_id: string;
        position: number;
      }>;

      product_skin_concerns: Table<{
        product_id: string;
        skin_concern_id: string;
        position: number;
      }>;

      product_ingredients: Table<{
        product_id: string;
        ingredient_id: string;
        position: number;
      }>;

      product_hero_ingredients: Table<{
        product_id: string;
        ingredient_id: string;
        position: number;
      }>;

      reviews: Table<{
        id: string;
        product_id: string;
        author: string;
        verified: boolean;
        rating: number;
        title: string;
        body: string;
        skin_type_id: string | null;
        helpful_count: number;
        created_at: string;
        /* 0002: moderation. A review is public only when approved AND published. */
        customer_id: string | null;
        moderation_status: 'pending' | 'approved' | 'rejected';
        published: boolean;
        moderated_by: string | null;
        moderated_at: string | null;
        updated_at: string;
      }>;

      review_skin_concerns: Table<{
        review_id: string;
        skin_concern_id: string;
      }>;

      review_images: Table<{
        review_id: string;
        image_id: string;
        position: number;
      }>;

      customers: Table<{
        id: string;
        email: string;
        full_name: string;
        phone: string | null;
        /** Auth identity this profile belongs to. See 0006_customer_auth.sql. */
        user_id: string | null;
        created_at: string;
        updated_at: string;
      }>;

      addresses: Table<{
        id: string;
        customer_id: string | null;
        full_name: string;
        line1: string;
        line2: string | null;
        city: string;
        region: string | null;
        postal_code: string;
        country: string;
        phone: string | null;
        is_default_shipping: boolean;
        is_default_billing: boolean;
        created_at: string;
      }>;

      orders: Table<{
        id: string;
        number: string;
        status: Database['public']['Enums']['order_status'];
        customer_id: string | null;
        customer_email: string;
        customer_name: string;
        /**
         * Unguessable second factor for a guest order's confirmation URL. The
         * order number is a short sequence and cannot identify the order on its
         * own. See 0006_customer_auth.sql.
         */
        access_token: string;
        shipping_address_id: string;
        billing_address_id: string;
        shipping_method_id: string;
        shipping_method_name: string;
        subtotal: number;
        discount_total: number;
        shipping_total: number;
        tax_total: number;
        total: number;
        currency: string;
        payment_method_label: string;
        payment_last4: string | null;
        tracking_number: string | null;
        tracking_url: string | null;
        placed_at: string;
        updated_at: string;
      }>;

      order_lines: Table<{
        id: string;
        order_id: string;
        product_id: string | null;
        variant_id: string | null;
        product_name: string;
        variant_name: string;
        sku: string | null;
        image_id: string | null;
        quantity: number;
        unit_price: number;
        line_total: number;
        position: number;
      }>;

      order_discounts: Table<{
        id: string;
        order_id: string;
        code: string;
        label: string;
        amount: number;
        position: number;
      }>;

      order_events: Table<{
        id: string;
        order_id: string;
        label: string;
        status: Database['public']['Enums']['order_status'] | null;
        occurred_at: string;
      }>;

      settings: Table<{ key: string; value: Json; updated_at: string }>;

      shipping_methods: Table<{
        id: string;
        name: string;
        description: string;
        price: number;
        currency: string;
        position: number;
        visible: boolean;
      }>;

      home_sections: Table<{
        id: string;
        kind: string;
        payload: Json;
        position: number;
        visible: boolean;
        /* 0002: explicit columns the admin form edits for every section type */
        eyebrow: string | null;
        title: string | null;
        subtitle: string | null;
        body: string | null;
        cta_label: string | null;
        cta_href: string | null;
        cta_style: 'primary' | 'secondary' | 'text' | null;
        image_id: string | null;
        enabled: boolean;
        created_at: string;
        updated_at: string;
      }>;

      journal_posts: Table<{
        id: string;
        slug: string;
        title: string;
        excerpt: string;
        body: string;
        category: string;
        author: string;
        read_minutes: number;
        image_id: string | null;
        related_product_ids: string[];
        seo_title: string | null;
        seo_description: string | null;
        published_at: string | null;
        position: number;
        visible: boolean;
        created_at: string;
        updated_at: string;
      }>;

      policies: Table<{
        id: string;
        slug: string;
        title: string;
        summary: string;
        body: string;
        position: number;
        updated_at: string;
      }>;

      faq_items: Table<{
        id: string;
        scope: string;
        question: string;
        answer: string;
        position: number;
        visible: boolean;
      }>;

      navigation_links: Table<{
        id: string;
        parent_id: string | null;
        label: string;
        href: string;
        position: number;
        visible: boolean;
      }>;

      promotions: Table<{
        id: string;
        code: string;
        label: string;
        kind: string;
        value: number;
        min_subtotal: number | null;
        starts_at: string | null;
        ends_at: string | null;
        visible: boolean;
      }>;

      /* 0010_integrations.sql — provider configuration, secrets encrypted. */
      integrations: Table<{
        id: string;
        provider: string;
        secrets_ciphertext: string | null;
        config: Json;
        enabled: boolean;
        updated_by: string | null;
        updated_at: string;
      }>;

      email_templates: Table<{
        key: string;
        subject: string;
        body_html: string;
        body_text: string;
        enabled: boolean;
        updated_by: string | null;
        updated_at: string;
      }>;

      email_automations: Table<{
        event: string;
        template_key: string;
        enabled: boolean;
        updated_at: string;
      }>;

      /* 0011_notifications.sql — one row per recipient, so `read_at` is per-person. */
      notifications: Table<{
        id: string;
        customer_id: string;
        tone: string;
        title: string;
        body: string;
        image_id: string | null;
        link: string | null;
        read_at: string | null;
        created_at: string;
      }>;

      email_log: Table<{
        id: string;
        event: string;
        template_key: string | null;
        recipient: string;
        subject: string;
        provider: string;
        status: string;
        detail: string | null;
        created_at: string;
      }>;

      /* 0012_email_flow.sql — verification tokens and rate limit counters. */
      email_verifications: Table<{
        id: string;
        email: string;
        token_hash: string;
        user_id: string | null;
        expires_at: string;
        consumed_at: string | null;
        created_at: string;
      }>;

      rate_limit_counters: Table<{
        bucket: string;
        window_start: string;
        count: number;
      }>;
    };

    Views: {
      product_rating_summary: {
        Row: { product_id: string; average: number; count: number; distribution: number[] };
      };
    };

    Functions: {
      current_customer_id: { Args: Record<PropertyKey, never>; Returns: string | null };
      is_admin: { Args: { required_role?: string }; Returns: boolean };
      /** Atomic stock decrement with a floor test. See 0007_stock_reservation.sql. */
      decrement_variant_stock: {
        Args: { p_variant_id: string; p_quantity: number };
        Returns: boolean;
      };
      /** Atomic stock increment, used when an order is cancelled. See 0016. */
      restore_variant_stock: {
        Args: { p_variant_id: string; p_quantity: number };
        Returns: boolean;
      };
      /** Fan-out delivery helper. `null` ids means every customer. */
      create_notification: {
        Args: {
          p_customer_ids: string[] | null;
          p_title: string;
          p_body?: string;
          p_tone?: string;
          p_image_id?: string;
          p_link?: string;
        };
        Returns: number;
      };
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      prune_rate_limits: { Args: Record<PropertyKey, never>; Returns: undefined };
    };

    Enums: {
      /**
       * 'packed' exists in the database but not in `OrderStatus`; see
       * 0008_order_status_processing.sql. It is kept here so a row carrying it
       * still typechecks rather than becoming an `any`.
       */
      order_status:
        | 'pending'
        | 'paid'
        | 'processing'
        | 'packed'
        | 'shipped'
        | 'delivered'
        | 'cancelled'
        | 'refunded';
      product_type:
        | 'cleanser'
        | 'essence'
        | 'serum'
        | 'moisturiser'
        | 'eye'
        | 'mask'
        | 'oil'
        | 'sunscreen'
        | 'tool';
      badge_tone: 'neutral' | 'moss' | 'clay' | 'danger' | 'ink';
    };

    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
