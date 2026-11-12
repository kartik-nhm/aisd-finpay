// All money values are integer paise. Rates are percentages of the payment amount.
// These numbers mirror how real campus / wallet reward programmes work: small base
// rates, a minimum spend, a per-payment ceiling, and monthly caps.

export const TIERS = {
  // rateMultiplier scales the cashback %, capMultiplier scales per-payment + monthly category caps,
  // monthlyCeilingPaise is the most cashback a wallet can earn across ALL categories in a month.
  BASIC:   { rateMultiplier: 1,    capMultiplier: 1,   monthlyCeilingPaise: 15000 },
  PRIME:   { rateMultiplier: 1.25, capMultiplier: 1.5, monthlyCeilingPaise: 25000 },
  PREMIUM: { rateMultiplier: 1.5,  capMultiplier: 2,   monthlyCeilingPaise: 40000 }
};

export const CATEGORY_RULES = {
  CANTEEN:    { ratePercent: 1.5,  minTxnPaise: 2000,  perTxnCapPaise: 1000, monthlyCapPaise: 7500 },
  STATIONERY: { ratePercent: 2,    minTxnPaise: 5000,  perTxnCapPaise: 1500, monthlyCapPaise: 4000 },
  TRANSPORT:  { ratePercent: 1.5,  minTxnPaise: 1000,  perTxnCapPaise: 1000, monthlyCapPaise: 5000 },
  HOSTEL:     { ratePercent: 0.25, minTxnPaise: 50000, perTxnCapPaise: 5000, monthlyCapPaise: 10000 },
  ONLINE:     { ratePercent: 2,    minTxnPaise: 10000, perTxnCapPaise: 3000, monthlyCapPaise: 10000 }
};

// Wallet safety limits (similar to what a full-KYC prepaid wallet enforces).
export const LIMITS = {
  minTopUpPaise: 1000,        // ₹10
  maxTopUpPaise: 1000000,     // ₹10,000 per top-up
  maxBalancePaise: 2000000,   // ₹20,000 wallet balance ceiling
  maxPaymentPaise: 500000,    // ₹5,000 per payment
  dailySpendPaise: 1000000    // ₹10,000 per day
};

export const TOP_UP_METHODS = { UPI: 'UPI', CARD: 'Debit card', NETBANKING: 'Net banking' };
