"""
VidyaRaksha — SMS Service
Supports both Fast2SMS (India) and Twilio (International).
Includes retry mechanism and logging.
"""
import os
import json
import time
import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass
class SMSResult:
    """Result of an SMS sending attempt"""
    success: bool
    provider: str
    response_id: Optional[str] = None
    error: Optional[str] = None


def send_sms(phone: str, message: str, max_retries: int = 3) -> SMSResult:
    """
    Send SMS using the configured provider.
    Includes retry mechanism with exponential backoff.
    """
    provider = os.environ.get('SMS_PROVIDER', 'fast2sms')
    
    if not phone:
        return SMSResult(success=False, provider=provider, error='No phone number provided')
    
    # Clean phone number
    phone = phone.replace(' ', '').replace('-', '').replace('+91', '')
    
    for attempt in range(max_retries):
        try:
            if provider == 'fast2sms':
                result = _send_via_fast2sms(phone, message)
            elif provider == 'twilio':
                result = _send_via_twilio(phone, message)
            else:
                # Simulate sending for development
                result = _simulate_sms(phone, message)
            
            if result.success:
                logger.info(f"SMS sent successfully to {phone} via {provider}")
                return result
            
            logger.warning(f"SMS attempt {attempt+1} failed: {result.error}")
            
        except Exception as e:
            logger.error(f"SMS attempt {attempt+1} error: {str(e)}")
            result = SMSResult(success=False, provider=provider, error=str(e))
        
        # Exponential backoff
        if attempt < max_retries - 1:
            time.sleep(2 ** attempt)
    
    return result


def _send_via_fast2sms(phone: str, message: str) -> SMSResult:
    """Send SMS via Fast2SMS API"""
    import requests
    
    api_key = os.environ.get('FAST2SMS_API_KEY', '')
    if not api_key:
        return SMSResult(
            success=False,
            provider='fast2sms',
            error='Fast2SMS API key not configured. Set FAST2SMS_API_KEY environment variable.'
        )
    
    url = "https://www.fast2sms.com/dev/bulkV2"
    headers = {
        "authorization": api_key,
        "Content-Type": "application/json"
    }
    payload = {
        "route": "q",
        "message": message,
        "flash": 0,
        "numbers": phone
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        data = response.json()
        
        if data.get('return'):
            return SMSResult(
                success=True,
                provider='fast2sms',
                response_id=str(data.get('request_id', ''))
            )
        else:
            return SMSResult(
                success=False,
                provider='fast2sms',
                error=data.get('message', 'Unknown Fast2SMS error')
            )
    except requests.RequestException as e:
        return SMSResult(
            success=False,
            provider='fast2sms',
            error=f'Network error: {str(e)}'
        )


def _send_via_twilio(phone: str, message: str) -> SMSResult:
    """Send SMS via Twilio API"""
    try:
        from twilio.rest import Client
    except ImportError:
        return SMSResult(
            success=False,
            provider='twilio',
            error='Twilio library not installed. Run: pip install twilio'
        )
    
    account_sid = os.environ.get('TWILIO_ACCOUNT_SID', '')
    auth_token = os.environ.get('TWILIO_AUTH_TOKEN', '')
    from_number = os.environ.get('TWILIO_PHONE_NUMBER', '')
    
    if not all([account_sid, auth_token, from_number]):
        return SMSResult(
            success=False,
            provider='twilio',
            error='Twilio credentials not configured'
        )
    
    try:
        client = Client(account_sid, auth_token)
        
        # Ensure phone has country code
        if not phone.startswith('+'):
            phone = '+91' + phone
        
        msg = client.messages.create(
            body=message,
            from_=from_number,
            to=phone
        )
        
        return SMSResult(
            success=True,
            provider='twilio',
            response_id=msg.sid
        )
    except Exception as e:
        return SMSResult(
            success=False,
            provider='twilio',
            error=str(e)
        )


def _simulate_sms(phone: str, message: str) -> SMSResult:
    """Simulate SMS sending for development/testing"""
    logger.info(f"[SIMULATED SMS] To: {phone} | Message: {message[:80]}...")
    return SMSResult(
        success=True,
        provider='simulator',
        response_id=f'SIM-{int(time.time())}'
    )
