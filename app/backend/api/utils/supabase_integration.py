# supabase_integration.py
"""
Integration between FastAPI backend and Next.js Supabase
Handles credit deduction and user validation
"""

import httpx
import os
from typing import Dict, Optional
from datetime import datetime

NEXTJS_API_URL = os.getenv("NEXTJS_API_URL", "http://localhost:3000/api")

async def verify_user_credits(user_id: str, required_amount: float) -> Dict:
    """
    Check if user has sufficient credits in Supabase
    Returns user profile with balance info
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{NEXTJS_API_URL}/credits/balance",
                params={"userId": user_id},
                timeout=10.0
            )
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": "Failed to fetch user balance",
                    "balance": 0
                }
            
            data = response.json()
            balance = data.get("balance", 0)
            
            return {
                "success": True,
                "balance": balance,
                "sufficient": balance >= required_amount,
                "user": data.get("user", {})
            }
    except Exception as e:
        print(f"Error verifying credits: {e}")
        return {
            "success": False,
            "error": str(e),
            "balance": 0
        }

async def deduct_user_credits(
    user_id: str,
    amount: float,
    transaction_type: str,
    description: str,
    metadata: Dict = None
) -> Dict:
    """
    Deduct credits from user account in Supabase
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{NEXTJS_API_URL}/credits/deduct",
                json={
                    "userId": user_id,
                    "amount": amount,
                    "transactionType": transaction_type,
                    "description": description,
                    "metadata": metadata or {}
                },
                timeout=10.0
            )
            
            if response.status_code == 402:
                # Insufficient balance
                data = response.json()
                return {
                    "success": False,
                    "error": "insufficient_balance",
                    "message": data.get("error", "Insufficient credits"),
                    "current_balance": data.get("currentBalance", 0)
                }
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": "deduction_failed",
                    "message": f"Failed to deduct credits: {response.status_code}"
                }
            
            data = response.json()
            return {
                "success": True,
                "new_balance": data.get("newBalance"),
                "transaction_id": data.get("transactionId"),
                "message": data.get("message")
            }
    except Exception as e:
        print(f"Error deducting credits: {e}")
        return {
            "success": False,
            "error": "exception",
            "message": str(e)
        }

async def add_user_credits(
    user_id: str,
    amount: float,
    transaction_type: str,
    description: str,
    metadata: Dict = None
) -> Dict:
    """
    Add credits to user account (for refunds, promotions, etc.)
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{NEXTJS_API_URL}/credits/add",
                json={
                    "userId": user_id,
                    "amount": amount,
                    "transactionType": transaction_type,
                    "description": description,
                    "metadata": metadata or {}
                },
                timeout=10.0
            )
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": "addition_failed",
                    "message": f"Failed to add credits: {response.status_code}"
                }
            
            data = response.json()
            return {
                "success": True,
                "new_balance": data.get("newBalance"),
                "transaction_id": data.get("transactionId"),
                "message": data.get("message")
            }
    except Exception as e:
        print(f"Error adding credits: {e}")
        return {
            "success": False,
            "error": "exception",
            "message": str(e)
        }

def calculate_analysis_cost(num_transactions: int, pricing_model: str = "tiered", custom_rate: float = None) -> float:
    """
    Calculate cost for analysis based on pricing model
    
    Args:
        num_transactions: Number of transactions to analyze
        pricing_model: "tiered" (default), "flat", or "custom"
        custom_rate: Custom rate for enterprise users (USD per transaction)
    
    Returns:
        Cost in USD
        
    Pricing Structure (tiered):
        - 1-2,000 txns: $1.00/txn
        - 2,001-5,000: $0.75/txn
        - 5,001-10,000: $0.50/txn
        - 10,001+: $0.35/txn
    """
    from decimal import Decimal
    
    if pricing_model == "custom" and custom_rate is not None:
        return float(Decimal(str(num_transactions)) * Decimal(str(custom_rate)))
    
    if pricing_model == "flat":
        # Legacy flat rate: $1 per analysis
        return 1.00
    
    # Tiered pricing (default)
    tiers = [
        (2000, Decimal("1.00")),
        (5000, Decimal("0.75")),
        (10000, Decimal("0.50")),
        (float('inf'), Decimal("0.35"))
    ]
    
    total_cost = Decimal("0.00")
    remaining = num_transactions
    previous_limit = 0
    
    for limit, rate in tiers:
        tier_size = min(remaining, limit - previous_limit)
        if tier_size <= 0:
            break
        
        tier_cost = Decimal(tier_size) * rate
        total_cost += tier_cost
        remaining -= tier_size
        previous_limit = limit
        
        if remaining <= 0:
            break
    
    return float(total_cost)
