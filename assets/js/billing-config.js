/*
 * SimuPLC V15 - Google Play Billing.
 * Compra única + suscripción mensual + suscripción anual.
 * Nunca coloques credenciales privadas en este archivo.
 */
window.SIMUPLC_BILLING_CONFIG = Object.freeze({
  packageName: 'com.pasir.simuplc',
  backendUrl: 'https://simuplc-play-billing-275066504779.us-central1.run.app',
  products: Object.freeze({
    lifetime: Object.freeze({ id: 'simuplc_pro_lifetime', kind: 'lifetime', label: 'PRO de por vida' }),
    monthly:  Object.freeze({ id: 'simuplc_pro_monthly',  kind: 'subscription', label: 'PRO Mensual' }),
    annual:   Object.freeze({ id: 'simuplc_pro_annual',   kind: 'subscription', label: 'PRO Anual' })
  }),
  // Compatibilidad con versiones anteriores del frontend.
  productId: 'simuplc_pro_lifetime',
  requireBackend: true,
  verifyOnStartup: true
});
