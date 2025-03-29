import frappe
import time
from functools import wraps
from .cache_status import check_system_performance

class PerformanceMetrics:
    def __init__(self):
        self.error_count = 0
        self.last_error_reset = time.time()
        self.error_window = 300  # 5 minutes
        
    def record_error(self):
        current_time = time.time()
        # Reset error count if window has passed
        if current_time - self.last_error_reset > self.error_window:
            self.error_count = 0
            self.last_error_reset = current_time
        self.error_count += 1
        
    def get_error_count(self):
        current_time = time.time()
        # Reset if window has passed
        if current_time - self.last_error_reset > self.error_window:
            self.error_count = 0
            self.last_error_reset = current_time
        return self.error_count

# Global metrics tracker
metrics = PerformanceMetrics()

def should_check_cache(response_time=None, error_count=None):
    """
    Determine if cache check is needed based on system performance metrics
    
    Args:
        response_time (float): Time taken for request in seconds
        error_count (int): Number of recent errors
        
    Returns:
        bool: True if cache check is needed
    """
    try:
        # Get Redis connection
        redis_connection = frappe.cache()
        
        # Get last check timestamp
        last_check = redis_connection.get_value("last_cache_check")
        current_time = time.time()
        
        # Don't check too frequently (minimum 30 seconds between checks)
        if last_check and (current_time - float(last_check)) < 30:
            return False
            
        # Check if response time is too high (over 2 seconds)
        if response_time and response_time > 2:
            frappe.log(f"Cache check triggered by high response time: {response_time}s")
            return True
            
        # Check if there are too many errors (more than 3)
        if error_count and error_count > 3:
            frappe.log(f"Cache check triggered by high error count: {error_count}")
            return True
            
        # If check proceeds, update timestamp
        redis_connection.set_value("last_cache_check", current_time)
        return False
        
    except Exception as e:
        frappe.log_error(f"Error in should_check_cache: {str(e)}")
        return False

@frappe.whitelist()
def check_system_performance(response_time=None, error_count=None):
    """
    Check system performance and trigger cache check if needed
    
    Args:
        response_time (float): Time taken for request in seconds
        error_count (int): Number of recent errors
        
    Returns:
        dict: System status if check was performed, None otherwise
    """
    try:
        if should_check_cache(response_time, error_count):
            from .system import get_redis_cache_status
            return get_redis_cache_status()
        return None
    except Exception as e:
        frappe.log_error(f"Error checking system performance: {str(e)}")
        return None

def track_performance(f):
    """Decorator to track API performance"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = f(*args, **kwargs)
            response_time = time.time() - start_time
            
            # Check system performance if response time is high
            if response_time > 2:  # Over 2 seconds
                frappe.enqueue(
                    check_system_performance,
                    queue='short',
                    response_time=response_time,
                    error_count=metrics.get_error_count()
                )
                
            return result
            
        except Exception as e:
            # Record error and check system if error threshold exceeded
            metrics.record_error()
            error_count = metrics.get_error_count()
            
            if error_count > 3:  # More than 3 errors in window
                frappe.enqueue(
                    check_system_performance,
                    queue='short',
                    error_count=error_count
                )
            raise
            
    return wrapper 