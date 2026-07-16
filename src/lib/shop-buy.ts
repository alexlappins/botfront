import { API_BASE, ApiError, createStoreCheckout } from "@/lib/api"

/**
 * Buy click (TZ-1 §0/§4.1): go STRAIGHT to Stripe Checkout — no cart, no
 * interstitials. If the user isn't logged in, run Discord OAuth with
 * returnTo=/shop/<slug>?buy=1 so the product page auto-resumes checkout
 * right after login (no second Buy click).
 *
 * Throws for non-auth errors — caller shows the message.
 */
export async function buyProduct(productKey: string, slug: string): Promise<void> {
  try {
    const { url } = await createStoreCheckout(productKey)
    window.location.href = url
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      const returnTo = encodeURIComponent(`/shop/${slug}?buy=1`)
      window.location.href = `${API_BASE}/auth/discord?returnTo=${returnTo}`
      return
    }
    throw e
  }
}
