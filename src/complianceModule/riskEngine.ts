export function mockRiskEngine(payment: {
    // tx_hash: string;
    chain: string;
    amount: string;
    intermediary_wallet: string;
  }): {
    risk_level: 'low' | 'medium' | 'high';
    score: number;
    flags: string[];
  } {
    const flags: string[] = [];
    let score = 0;
  
    const amt = parseFloat(payment.amount);
    if (amt > 9) {
      score += 30;
      flags.push('High value transaction');
    }
  
    if (payment.chain === 'arbitrum') {
      score += 10;
      flags.push('Chain with known mixer risk');
    }

    if (payment.intermediary_wallet === '0x04D1d7a0A6854b68b7092F95237771A0e55E8543') {
      score += 50;
      flags.push('address in ofac list');
    }
  
    let risk_level: 'low' | 'medium' | 'high' = 'low';
    if (score >= 70) risk_level = 'high';
    else if (score >= 30) risk_level = 'medium';
  
    return { risk_level, score, flags };
  }
  