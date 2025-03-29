import frappe
import time
from frappe.utils import cint

def check_background_workers():
    """Check if background workers are running and processing jobs"""
    try:
        # Check if RQ workers are running
        workers_count = cint(frappe.db.get_single_value("System Settings", "background_workers") or 1)
        active_workers = len(frappe.utils.background_jobs.get_workers())
        
        # Check queue status
        queues = ["default", "long", "short"]
        total_jobs = 0
        
        for queue in queues:
            total_jobs += frappe.utils.background_jobs.get_queue(queue).count
            
        return active_workers >= workers_count and total_jobs == 0
        
    except Exception as e:
        frappe.log_error(f"Error checking workers status: {str(e)}")
        return False

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