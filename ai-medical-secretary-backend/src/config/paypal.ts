import paypal from '@paypal/checkout-server-sdk';

// ─── Variables d'environnement requises ────────────────────────────────────
// PAYPAL_CLIENT_ID       : Client ID de l'application PayPal
// PAYPAL_CLIENT_SECRET   : Secret de l'application PayPal
// PAYPAL_MODE            : 'sandbox' | 'live' (défaut : 'sandbox')

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_MODE = process.env.PAYPAL_MODE || 'sandbox';

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.warn('⚠️  PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET manquants dans les variables d\'environnement.');
}

function environment() {
  if (PAYPAL_MODE === 'live') {
    return new paypal.core.LiveEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
  }
  return new paypal.core.SandboxEnvironment(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET);
}

const paypalClient = new paypal.core.PayPalHttpClient(environment());

export default paypalClient;
export { paypal };
