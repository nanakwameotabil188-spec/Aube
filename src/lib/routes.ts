/**
 * Central route table.
 *
 * Keeping URLs in one place means the eventual backend can own routing
 * without touching components, and prevents route drift between links.
 */

export const routes = {
  home: '/',
  shop: '/shop',
  search: '/search',
  cart: '/cart',
  checkout: '/checkout',
  /**
   * Guest order confirmation. The order number is a short sequence, so it cannot
   * identify the order on its own; the token minted at checkout is required
   * alongside it and is only known to whoever placed the order.
   */
  checkoutConfirmation: (orderNumber: string, accessToken?: string) =>
    accessToken
      ? `/checkout/confirmation/${orderNumber}?t=${encodeURIComponent(accessToken)}`
      : `/checkout/confirmation/${orderNumber}`,
  wishlist: '/wishlist',

  account: {
    root: '/account',
    login: '/account/login',
    register: '/account/register',
    forgotPassword: '/account/forgot-password',
    resetPassword: '/account/reset-password',
    /**
     * Consumes the token from the signup confirmation email.
     *
     * On this domain rather than the auth provider's, so the link works in local
     * development without adding a redirect URL to a dashboard, and so the flow
     * is this shop's rather than a provider's default page.
     */
    verifyEmail: '/account/verify-email',
    profile: '/account/profile',
    addresses: '/account/addresses',
    orders: '/account/orders',
    order: (id: string) => `/account/orders/${id}`,
    settings: '/account/settings',
  },

  product: (slug: string) => `/products/${slug}`,
  category: (slug: string) => `/category/${slug}`,
  collection: (slug: string) => `/collection/${slug}`,
  concern: (slug: string) => `/concern/${slug}`,
  skinType: (slug: string) => `/skin-type/${slug}`,
  ingredient: (slug: string) => `/ingredient/${slug}`,

  /** Index pages for each taxonomy, which the term pages breadcrumb back to. */
  concerns: '/concerns',
  skinTypes: '/skin-types',
  ingredients: '/ingredients',

  journal: {
    index: '/journal',
    post: (slug: string) => `/journal/${slug}`,
  },

  about: '/about',
  contact: '/contact',
  faq: '/faq',
  shipping: '/policies/shipping',
  returns: '/policies/returns',
  privacy: '/policies/privacy',
  terms: '/policies/terms',
  accessibility: '/policies/accessibility',
} as const;

/** Absolute URL helper for canonical tags, OG images and JSON-LD. */
export function absoluteUrl(path: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}
