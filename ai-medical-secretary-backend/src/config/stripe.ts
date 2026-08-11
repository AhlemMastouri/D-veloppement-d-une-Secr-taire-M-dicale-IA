import Stripe from 'stripe';

// ─── Variables d'environnement requises ────────────────────────────────────
// STRIPE_SECRET_KEY      : clé secrète Stripe (sk_test_... / sk_live_...)
// STRIPE_WEBHOOK_SECRET  : secret de signature du webhook (whsec_...)

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

if (!STRIPE_SECRET_KEY) {
  console.warn(
    "⚠️  STRIPE_SECRET_KEY manquant dans les variables d'environnement. " +
    'Le serveur démarre quand même, mais tout appel aux endpoints /payments/stripe/* échouera ' +
    'tant qu\'une vraie clé n\'est pas configurée dans le fichier .env.'
  );
}

// Le SDK Stripe exige une chaîne non vide au constructeur, sinon il lève une exception
// qui ferait planter tout le process au démarrage (et pas seulement les routes Stripe).
// On utilise donc une clé factice en son absence : le serveur démarre normalement,
// et seuls les appels réels à l'API Stripe échoueront (avec une erreur d'authentification
// claire), sans jamais bloquer PayPal, Cabinet ou le reste de l'application.
const stripeClient = new Stripe(STRIPE_SECRET_KEY || 'sk_test_missing_key_placeholder', {
  apiVersion: '2024-06-20',
});

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
export default stripeClient;