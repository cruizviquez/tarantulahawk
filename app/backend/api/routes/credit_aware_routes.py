# credit_aware_routes.py
"""
Enhanced routes that integrate with Supabase credit system
Drop-in replacement for existing enhanced_main_api.py routes
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Header, BackgroundTasks
from fastapi.responses import JSONResponse
import pandas as pd
from pathlib import Path
import uuid
from datetime import datetime
from typing import Optional

from .utils.supabase_integration import (
    verify_user_credits,
    deduct_user_credits,
    calculate_analysis_cost
)

router = APIRouter()

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

# Import your existing processing functions
# from enhanced_main_api import procesar_transacciones_core

@router.post("/portal/upload")
async def upload_with_credit_check(
    file: UploadFile = File(...),
    user_id: str = Header(..., alias="X-User-ID")
):
    """
    Portal upload endpoint with Supabase credit integration
    
    Flow:
    1. Validate file
    2. Check user credits
    3. If sufficient: deduct and process
    4. If insufficient: return payment required
    """
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. Only CSV files are supported."
        )
    
    # Save uploaded file temporarily
    analysis_id = str(uuid.uuid4())
    temp_path = UPLOAD_DIR / f"{analysis_id}_{file.filename}"
    
    try:
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Read file to get transaction count
        df = pd.read_csv(temp_path)
        
        num_transactions = len(df)
        
        # Calculate cost using tiered pricing model
        cost = calculate_analysis_cost(num_transactions, pricing_model="tiered")
        
        # Check user balance
        balance_check = await verify_user_credits(user_id, cost)
        
        if not balance_check["success"]:
            return JSONResponse(
                status_code=500,
                content={
                    "success": False,
                    "error": "Failed to verify user balance",
                    "details": balance_check.get("error")
                }
            )
        
        current_balance = balance_check["balance"]
        
        # If insufficient balance, return payment required
        if not balance_check["sufficient"]:
            return JSONResponse(
                status_code=402,
                content={
                    "success": False,
                    "requires_payment": True,
                    "analysis_id": analysis_id,
                    "cost": cost,
                    "current_balance": current_balance,
                    "amount_needed": cost - current_balance,
                    "num_transactions": num_transactions,
                    "message": f"Insufficient credits. You need ${cost:.2f} but have ${current_balance:.2f}"
                }
            )
        
        # Sufficient balance - deduct credits
        deduction_result = await deduct_user_credits(
            user_id=user_id,
            amount=cost,
            transaction_type="aml_report",
            description=f"AML analysis of {num_transactions} transactions",
            metadata={
                "analysis_id": analysis_id,
                "filename": file.filename,
                "num_transactions": num_transactions
            }
        )
        
        if not deduction_result["success"]:
            return JSONResponse(
                status_code=402,
                content={
                    "success": False,
                    "error": "Failed to deduct credits",
                    "details": deduction_result.get("message")
                }
            )
        
        # Process the file (call your existing ML pipeline)
        # In production, replace this mock with your actual processing:
        # from enhanced_main_api import procesar_transacciones_core
        # results = procesar_transacciones_core(df, user_tier="free")
        
        # MOCK RESULTS (replace with actual processing)
        results = {
            "success": True,
            "analysis_id": analysis_id,
            "resumen": {
                "total_transacciones": num_transactions,
                "preocupante": int(num_transactions * 0.008),
                "inusual": int(num_transactions * 0.035),
                "relevante": int(num_transactions * 0.15),
                "limpio": num_transactions - int(num_transactions * 0.193),
                "false_positive_rate": 8.2,
                "processing_time_ms": num_transactions * 0.15
            },
            "cost": cost,
            "credits_deducted": cost,
            "new_balance": deduction_result["new_balance"],
            "transaction_id": deduction_result["transaction_id"],
            "timestamp": datetime.now().isoformat(),
            "file_info": {
                "filename": file.filename,
                "size_bytes": len(content),
                "num_transactions": num_transactions
            }
        }
        
        return JSONResponse(content=results)
        
    except pd.errors.EmptyDataError:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")
    finally:
        # Clean up temporary file
        if temp_path.exists():
            temp_path.unlink()

@router.get("/analysis/{analysis_id}")
async def get_analysis_results(
    analysis_id: str,
    user_id: str = Header(..., alias="X-User-ID")
):
    """
    Retrieve analysis results by ID
    """
    # In production, fetch from database
    # For now, return mock data
    return {
        "success": True,
        "analysis_id": analysis_id,
        "status": "completed",
        "results": {
            "resumen": {
                "total_transacciones": 1500,
                "preocupante": 12,
                "inusual": 52,
                "relevante": 225,
                "limpio": 1211
            }
        },
        "timestamp": datetime.now().isoformat()
    }

@router.get("/history")
async def get_user_history(
    user_id: str = Header(..., alias="X-User-ID"),
    limit: int = 50
):
    """
    Get user's analysis history
    """
    # In production, fetch from database
    # For now, return empty list
    return {
        "success": True,
        "historial": [],
        "total": 0
    }

@router.post("/payment/process")
async def process_payment(
    payment_id: str,
    method: str,
    payment_token: Optional[str] = None,
    user_id: str = Header(..., alias="X-User-ID")
):
    """
    Process payment for insufficient credits
    This would integrate with your existing PayPal flow
    """
    # In production, this would:
    # 1. Validate payment with PayPal
    # 2. Add credits to user account
    # 3. Resume the analysis
    
    return {
        "success": True,
        "message": "Payment processed successfully",
        "analysis_id": payment_id
    }
