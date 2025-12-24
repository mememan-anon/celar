export type PaymentRow = {
    id: string;
    status: string;
    chain: string;
    tx_hash: string;
    merchant_id: string;
    amount: string;
    intermediary_wallet: string;
  };

export type PaymentCustomer={
  payment_id: string;
  merchant_id: string;
  amount: string;
  currency: string;
  chain: string;
  status: string;
  confirmed_at?: string;
  magic_link_url: string;
  created_at: string;
  updated_at: string;
  token_address: string;
  intermediary_wallet: string;
}
  
  export type RiskCheckRow = {
    risk_level: 'low' | 'medium' | 'high';
    score: number;
    flags: string; // JSON string
    checked_at: string;
  };

  export type Psp = {
    id: string;
    name: string;
    contact_email: string;
    api_key_hash: string;
    approval_status: string;
  }