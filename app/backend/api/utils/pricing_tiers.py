# pricing_tiers.py
"""
TarantulaHawk Pricing Structure
Tiered pricing based on monthly transaction volume
"""

from typing import Dict, Tuple, List
from decimal import Decimal
from pathlib import Path
import json

class PricingTier:
    """
    Pricing structure:
    - 1-2,000 transactions: $1.00 per transaction
    - 2,001-5,000: $0.75 per transaction  
    - 5,001-10,000: $0.50 per transaction
    - 10,001+: $0.35 per transaction
    - Enterprise custom: Contact sales team
    """
    
    # Load tiers from shared JSON config. Fallback to defaults if missing.
    @staticmethod
    def _load_tiers_from_config() -> List[Tuple[float, Decimal]]:
        try:
            # repo_root/config/pricing.json (utils -> api -> backend -> app -> repo root)
            config_path = Path(__file__).resolve().parents[4] / 'config' / 'pricing.json'
            with open(config_path, 'r', encoding='utf-8') as f:
                cfg = json.load(f)
            tiers = []
            prev = 0
            for t in cfg.get('tiers', []):
                upto = t['upto']
                limit = float('inf') if upto is None else int(upto)
                rate = Decimal(str(t['rate']))
                tiers.append((limit, rate))
            if tiers:
                return tiers
        except Exception:
            pass
        # Fallback defaults
        return [
            (2000, Decimal("1.00")),
            (5000, Decimal("0.75")),
            (10000, Decimal("0.50")),
            (float('inf'), Decimal("0.35"))
        ]

    TIERS = _load_tiers_from_config.__func__()
    
    ENTERPRISE_THRESHOLD = 50000  # Contact sales above 50k/month
    
    @classmethod
    def calculate_cost(cls, num_transactions: int, custom_rate: Decimal = None) -> Decimal:
        """
        Calculate cost based on tiered pricing
        
        Args:
            num_transactions: Number of transactions to process
            custom_rate: Custom rate for enterprise users (overrides tiers)
            
        Returns:
            Total cost in USD
        """
        if custom_rate is not None:
            return Decimal(num_transactions) * custom_rate
        
        total_cost = Decimal("0.00")
        remaining = num_transactions
        previous_limit = 0
        
        for limit, rate in cls.TIERS:
            tier_size = min(remaining, limit - previous_limit)
            if tier_size <= 0:
                break
                
            tier_cost = Decimal(tier_size) * rate
            total_cost += tier_cost
            remaining -= tier_size
            previous_limit = limit
            
            if remaining <= 0:
                break
        
        return total_cost
    
    @classmethod
    def get_rate_breakdown(cls, num_transactions: int) -> Dict[str, any]:
        """
        Get detailed breakdown of pricing by tier
        
        Returns:
            {
                'total_cost': Decimal,
                'breakdown': [
                    {'tier': '1-2000', 'transactions': 2000, 'rate': 1.00, 'subtotal': 2000.00},
                    ...
                ]
            }
        """
        breakdown = []
        remaining = num_transactions
        previous_limit = 0
        total_cost = Decimal("0.00")
        
        for limit, rate in cls.TIERS:
            tier_size = min(remaining, limit - previous_limit)
            if tier_size <= 0:
                break
            
            tier_cost = Decimal(tier_size) * rate
            total_cost += tier_cost
            
            tier_name = f"{previous_limit + 1:,}-{limit:,}" if limit != float('inf') else f"{previous_limit + 1:,}+"
            
            breakdown.append({
                'tier': tier_name,
                'transactions': tier_size,
                'rate': float(rate),
                'subtotal': float(tier_cost)
            })
            
            remaining -= tier_size
            previous_limit = limit
            
            if remaining <= 0:
                break
        
        return {
            'total_cost': float(total_cost),
            'total_transactions': num_transactions,
            'breakdown': breakdown,
            'average_rate': float(total_cost / num_transactions) if num_transactions > 0 else 0
        }
    
    @classmethod
    def requires_sales_contact(cls, num_transactions: int) -> bool:
        """Check if volume requires sales team contact"""
        return num_transactions > cls.ENTERPRISE_THRESHOLD
    
    @classmethod
    def get_pricing_summary(cls) -> str:
        """Get human-readable pricing summary"""
                return """
TarantulaHawk Pricing Structure:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tier 1:  1-2,000 txns     → $1.00/txn
Tier 2:  2,001-5,000 txns → $0.75/txn
Tier 3:  5,001-10,000 txns → $0.50/txn
Tier 4:  10,001+ txns     → $0.35/txn

Enterprise (50,000+ txns/month):
    Custom pricing available
    Contact: sales@tarantulahawk.cloud
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Examples:
    1,500 txns   = $1,500.00
    3,000 txns   = $2,750.00
    8,000 txns   = $5,750.00
    15,000 txns  = $8,500.00
"""


class BillingCycle:
    """
    Monthly billing cycle management
    End-of-month billing with accumulated charges
    """
    
    @staticmethod
    def calculate_monthly_bill(monthly_transactions: int, custom_rate: Decimal = None) -> Dict:
        """
        Calculate end-of-month bill
        
        Args:
            monthly_transactions: Total transactions processed this month
            custom_rate: Custom enterprise rate if applicable
            
        Returns:
            {
                'total_due': Decimal,
                'breakdown': [...],
                'billing_period': str
            }
        """
        pricing = PricingTier.get_rate_breakdown(monthly_transactions)
        
        if custom_rate:
            pricing['total_cost'] = float(Decimal(monthly_transactions) * custom_rate)
            pricing['custom_rate_applied'] = float(custom_rate)
        
        return {
            'total_due': pricing['total_cost'],
            'breakdown': pricing['breakdown'],
            'total_transactions': monthly_transactions,
            'average_rate': pricing['average_rate']
        }


# Examples and tests
if __name__ == "__main__":
    print(PricingTier.get_pricing_summary())
    
    test_volumes = [500, 1500, 3000, 8000, 15000, 100000]
    
    print("\nPricing Examples:")
    print("=" * 60)
    
    for volume in test_volumes:
        result = PricingTier.get_rate_breakdown(volume)
        print(f"\n{volume:,} transactions:")
        print(f"  Total Cost: ${result['total_cost']:,.2f}")
        print(f"  Avg Rate: ${result['average_rate']:.4f}/txn")
        
        if PricingTier.requires_sales_contact(volume):
            print(f"  ⚠️  Contact sales for enterprise pricing")
        
        print("  Breakdown:")
        for tier in result['breakdown']:
            print(f"    {tier['tier']:>15}: {tier['transactions']:>7,} × ${tier['rate']:.2f} = ${tier['subtotal']:>10,.2f}")
