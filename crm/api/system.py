import frappe
import time
import random
from frappe.utils.redis_wrapper import RedisWrapper
from frappe.utils.caching import redis_cache
from frappe.utils import cint
from frappe.utils.background_jobs import enqueue
from .performance import track_performance
from .cache_status import check_background_workers

# Critical DocTypes required for basic functionality
CRITICAL_DOCTYPES = [
    "Contact",
    "CRM Lead",
    "CRM Deal"
]

# Non-critical DocTypes that can be loaded in background
BACKGROUND_DOCTYPES = [
    "Address",
    "Communication",
    "File",
    "Note",
    "ToDo"
]

REQUIRED_CACHE_KEYS = [
    "document_cache::System Settings::System Settings",
    "merged_translations",
    "doctype_modules",
    "notification_config"
]

def cleanup_temp_tables():
    """Background job to check and cleanup temporary tables"""
    try:
        db = frappe.db
        # Get list of all tables
        tables = db.sql("SHOW TABLES")
        
        # Convert to simple list
        table_names = [t[0] for t in tables]
        
        # Filter temporary tables
        temp_tables = [
            name for name in table_names
            if name.startswith(('tmp', 'temp', '#sql'))
        ]
        
        cleaned_tables = []
        for table_name in temp_tables:
            try:
                # Drop the table
                db.sql(f"DROP TABLE IF EXISTS `{table_name}`")
                cleaned_tables.append({
                    "name": table_name,
                    "cleaned_at": frappe.utils.now_datetime()
                })
                frappe.log(f"Dropped temporary table: {table_name}")
            except Exception as e:
                frappe.log_error(f"Error cleaning temporary table {table_name}: {str(e)}")
        
        # Store results in cache
        frappe.cache().set_value(
            "temp_tables_cleanup_result",
            {
                "total": len(temp_tables),
                "cleaned": len(cleaned_tables),
                "cleaned_tables": cleaned_tables,
                "timestamp": frappe.utils.now_datetime()
            },
            expires_in_sec=300  # Cache for 5 minutes
        )
        
    except Exception as e:
        frappe.log_error(f"Error in cleanup_temp_tables job: {str(e)}")

def check_database():
    """Check database connectivity and health
    
    Returns:
        dict: Database health status with detailed information
    """
    try:
        db = frappe.db
        details = {
            "checks": {},
            "initialization_status": "unknown"
        }
        
        # Check 1: Basic connectivity
        try:
            # First just check if we can connect at all
            db.sql("SELECT 1")
            details["checks"]["basic_connectivity"] = True
            
            # Get current database name
            current_db = db.sql("SELECT DATABASE()", as_dict=True)[0]['DATABASE()']
            details["current_database"] = current_db
            
            # Get table count in current database
            tables = db.sql("""
                SELECT COUNT(*) as table_count 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
            """)[0][0]
            
            details["initialization_status"] = "initialized" if tables > 0 else "empty"
            details["total_tables"] = tables
            
            # Get list of all tables for debugging
            all_tables = db.sql("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
                ORDER BY table_name
            """)
            all_table_names = [t[0] for t in all_tables]
            
        except Exception as e:
            details["checks"]["basic_connectivity"] = False
            return {
                "status": "unhealthy",
                "error": f"Cannot connect to database: {str(e)}",
                "details": details
            }

        # If database is empty, return early
        if details["initialization_status"] == "empty":
            return {
                "status": "needs_initialization",
                "error": "Database exists but no tables are present. Site needs to be initialized.",
                "details": details
            }
            
        # Start temporary tables cleanup in background
        frappe.enqueue(
            cleanup_temp_tables,
            queue='short',
            timeout=300,  # 5 minutes timeout
            now=True  # Start immediately
        )
        
        # Try to get previous cleanup results from cache
        cleanup_results = frappe.cache().get_value("temp_tables_cleanup_result")
        if cleanup_results:
            details["temporary_tables"] = cleanup_results
            
        # Get connection statistics and kill hanging connections
        try:
            # Get all connections
            connections = db.sql("""
                SELECT 
                    ID,
                    USER,
                    HOST,
                    DB,
                    COMMAND,
                    TIME,
                    STATE,
                    INFO
                FROM information_schema.processlist
                WHERE COMMAND != 'Sleep'
                  AND TIME > 30  -- Connections hanging for more than 30 seconds
                  AND DB = DATABASE()
            """, as_dict=True)
            
            # Kill hanging connections
            killed_connections = []
            for conn in connections:
                if conn.STATE in ['Locked', 'User sleep', 'Copying to tmp table'] or conn.TIME > 300:  # 5 minutes
                    try:
                        db.sql(f"KILL {conn.ID}")
                        killed_connections.append({
                            "id": conn.ID,
                            "user": conn.USER,
                            "state": conn.STATE,
                            "time": conn.TIME,
                            "info": conn.INFO
                        })
                        frappe.log(f"Killed hanging connection {conn.ID} ({conn.STATE}) running for {conn.TIME} seconds")
                    except Exception as e:
                        frappe.log_error(f"Failed to kill connection {conn.ID}: {str(e)}")
            
            # Get updated statistics
            stats = db.sql("""
                SELECT 
                    COUNT(*) as total_connections,
                    SUM(CASE WHEN COMMAND != 'Sleep' THEN 1 ELSE 0 END) as active_connections,
                    @@max_connections as max_connections
                FROM information_schema.processlist
            """, as_dict=True)[0]
            
            details.update({
                "open_connections": stats.total_connections,
                "active_connections": stats.active_connections,
                "max_connections": stats.max_connections,
                "killed_connections": killed_connections
            })
            
            # Log warning if too many connections
            if stats.total_connections > (stats.max_connections * 0.8):  # More than 80% of max connections
                frappe.log_error(
                    f"High number of database connections: {stats.total_connections}/{stats.max_connections}",
                    "Database Connection Warning"
                )
                
        except Exception as e:
            frappe.log_error(f"Error managing database connections: {str(e)}")
            
        # Check system tables
        table_checks = {
            "DocType": "modified",
            "User": "modified",
            "Role": "modified",
            "__Auth": "name"
        }
        missing_tables = []
        found_tables = []
        
        # First check core system tables
        for doctype, check_column in table_checks.items():
            try:
                if doctype == "__Auth":
                    table_name = "__Auth"
                else:
                    table_name = f"tab{doctype}"
                
                # Check if table exists in current database
                table_exists = table_name in all_table_names
                
                if not table_exists:
                    missing_tables.append(f"{doctype} (missing)")
                    frappe.log(f"Table {table_name} does not exist in database {current_db}")
                    continue
                
                # Check if we can access data
                try:
                    result = db.sql(f"SELECT {check_column} FROM `{table_name}` LIMIT 1")
                    if not result and table_name != "__Auth":
                        missing_tables.append(f"{doctype} (empty)")
                        frappe.log(f"Table {table_name} exists but is empty in database {current_db}")
                    else:
                        found_tables.append(doctype)
                        frappe.log(f"Table {table_name} exists and has data in database {current_db}")
                except Exception as e:
                    missing_tables.append(f"{doctype} (error: {str(e)})")
                    frappe.log(f"Error accessing table {table_name} in database {current_db}: {str(e)}")
                    
            except Exception as e:
                missing_tables.append(f"{doctype} (error: {str(e)})")
                frappe.log(f"Error checking table {doctype} in database {current_db}: {str(e)}")
                
        details["checks"]["required_tables"] = not bool(missing_tables)
        details["found_tables"] = found_tables
        if missing_tables:
            return {
                "status": "unhealthy",
                "error": f"Missing or inaccessible tables: {', '.join(missing_tables)}",
                "details": details
            }
            
        # All checks passed
        return {
            "status": "healthy",
            "details": details
        }
        
    except Exception as e:
        error_msg = f"Database check failed: {str(e)}"
        frappe.log_error(error_msg)
        return {
            "status": "unhealthy",
            "error": error_msg,
            "details": {
                "checks": {
                    "basic_connectivity": False,
                    "required_tables": False
                },
                "initialization_status": "error"
            }
        }

def check_websocket():
    """Check WebSocket server connectivity
    
    Returns:
        dict: WebSocket health status
    """
    try:
        # Get Redis server used by Socket.IO
        sock_server = frappe.cache()
        
        # Check connection
        sock_server.ping()
        
        # Get basic stats
        stats = {
            "connected": True,
            "pubsub_channels": len(sock_server.get_keys("events:*") or [])
        }
        
        return {
            "status": "healthy",
            "details": stats
        }
        
    except Exception as e:
        error_msg = f"WebSocket check failed: {str(e)}"
        frappe.log_error(error_msg)
        return {
            "status": "unhealthy",
            "error": error_msg
        }

def ensure_doctypes_loaded():
    """Background job to ensure all required DocTypes are loaded into cache"""
    try:
        start_time = time.time()
        frappe.log("Starting DocTypes cache warmup")
        
        # Load all DocTypes in a single transaction
        for doctype in CRITICAL_DOCTYPES + BACKGROUND_DOCTYPES:
            try:
                if not frappe.cache().exists(f"doctype_meta::{doctype}"):
                    meta = frappe.get_meta(doctype, cached=False)
                    if not meta:
                        frappe.log_error(f"Failed to load DocType: {doctype}")
            except Exception as e:
                frappe.log_error(f"Error loading DocType {doctype}: {str(e)}")
                
        frappe.log(f"Completed DocTypes cache warmup in {time.time() - start_time:.2f} seconds")
        
    except Exception as e:
        frappe.log_error(f"Error in ensure_doctypes_loaded: {str(e)}")
    finally:
        frappe.cache().delete_key("cache_warmup_in_progress")

@frappe.whitelist()
@track_performance
def get_redis_cache_status():
    """Check actual system readiness status
    Only called when system performance degrades
    
    Returns:
        dict: Status of system initialization including cache and metadata readiness
    """
    try:
        # Initialize status
        status = {
            "is_warming_up": True,
            "progress": 0,
            "details": {
                "warming_up_reasons": []
            }
        }

        # Get Redis connection and check basic connectivity
        try:
            redis_connection = frappe.cache()
            redis_connection.ping()
        except Exception as e:
            frappe.log_error(f"Redis connection failed: {str(e)}")
            return {
                "status": "error",
                "message": "Cannot connect to system cache",
                "error_type": "redis_connection",
                "error_details": str(e)
            }
        
        # Check if warmup is in progress
        if redis_connection.exists('cache_warmup_in_progress'):
            return {
                "status": "success",
                "data": status
            }

        # Get all metadata keys in one call
        all_meta_keys = redis_connection.get_keys("*doctype_meta*") or []
        all_meta_keys = {key.decode('utf-8') if isinstance(key, bytes) else key for key in all_meta_keys}
        
        # Get database tables in one call
        db_tables = set(t[0] for t in frappe.db.sql("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE()
        """))

        # Check DocTypes status
        missing_critical = []
        missing_background = []
        cached_critical = 0
        cached_background = 0

        # Helper function to check DocType status
        def check_doctype(doctype):
            # Check table
            table_name = f"tab{doctype}"
            if table_name not in db_tables:
                return False, "missing_table"
            
            # Check cache - match any key containing this doctype
            if any(f"doctype_meta::{doctype}" in key for key in all_meta_keys):
                return True, None
                
            return False, "missing_cache"

        # Check critical DocTypes
        for doctype in CRITICAL_DOCTYPES:
            is_cached, reason = check_doctype(doctype)
            if is_cached:
                cached_critical += 1
            else:
                missing_critical.append(f"{doctype} ({reason})")

        # Check background DocTypes
        for doctype in BACKGROUND_DOCTYPES:
            is_cached, reason = check_doctype(doctype)
            if is_cached:
                cached_background += 1
            else:
                missing_background.append(f"{doctype} ({reason})")

        # Check WebSocket and workers status
        ws_status = check_websocket()
        workers_ready = check_background_workers()

        # Calculate progress
        total_checks = len(CRITICAL_DOCTYPES) * 2 + len(BACKGROUND_DOCTYPES) + 2  # +2 for WebSocket and workers
        completed_checks = (
            cached_critical * 2 + 
            cached_background + 
            (1 if ws_status["status"] == "healthy" else 0) +
            (1 if workers_ready else 0)
        )
        progress = int((completed_checks / total_checks) * 100)

        # Start warmup if needed
        if missing_critical or missing_background:
            try:
                if not redis_connection.exists('cache_warmup_in_progress'):
                    redis_connection.set_value('cache_warmup_in_progress', 1, expires_in_sec=30)
                frappe.enqueue(
                    ensure_doctypes_loaded,
                    queue='long',
                    timeout=300,
                    now=True
                )
            except Exception as e:
                frappe.log_error(f"Failed to start cache warmup: {str(e)}")

        # System is considered warming up if:
        # - Any critical DocTypes are missing
        # - WebSocket is unhealthy
        # - Workers are not ready
        is_warming_up = (
            bool(missing_critical) or
            ws_status["status"] != "healthy" or
            not workers_ready
        )

        # Update status
        status.update({
            "is_warming_up": is_warming_up,
            "progress": progress,
            "details": {
                "critical_doctypes_ready": f"{cached_critical}/{len(CRITICAL_DOCTYPES)}",
                "background_doctypes_ready": f"{cached_background}/{len(BACKGROUND_DOCTYPES)}",
                "missing_critical": missing_critical,
                "missing_background": missing_background,
                "websocket_status": ws_status["status"],
                "workers_ready": workers_ready,
                "ws_details": ws_status.get("details"),
                "warming_up_reasons": [
                    *(["missing_critical_doctypes"] if missing_critical else []),
                    *(["missing_background_doctypes"] if missing_background else []),
                    *(["websocket_unhealthy"] if ws_status["status"] != "healthy" else []),
                    *(["workers_not_ready"] if not workers_ready else [])
                ]
            }
        })

        return {
            "status": "success",
            "data": status
        }
    
    except Exception as e:
        error_msg = f"Error checking system status: {str(e)}"
        frappe.log_error(error_msg)
        return {
            "status": "error",
            "message": error_msg
        }

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

def simulate_cache_warmup():
    """Simulates cache warmup process for demonstration purposes"""
    try:
        redis_connection = frappe.cache()
        cache_key = "redis_cache_warmup_status"
        
        # Initial state
        status = redis_connection.get_value(cache_key) or {
            "is_warming_up": True,
            "progress": 0,
            "estimated_seconds_remaining": 60,
            "started_at": time.time()
        }
        
        # Simulate progress
        total_steps = 20
        for step in range(1, total_steps + 1):
            # Update status
            progress = int((step / total_steps) * 100)
            remaining_time = int((total_steps - step) * 3)  # 3 seconds per step
            
            status.update({
                "is_warming_up": progress < 100,
                "progress": progress,
                "estimated_seconds_remaining": remaining_time,
                "last_updated": time.time()
            })
            
            redis_connection.set_value(cache_key, status, expires_in_sec=3600)
            
            # Random delay between 2 and 5 seconds to simulate work
            time.sleep(random.uniform(2, 5))
        
        # Final state - cache is warmed up
        status.update({
            "is_warming_up": False,
            "progress": 100,
            "estimated_seconds_remaining": 0,
            "completed_at": time.time()
        })
        
        redis_connection.set_value(cache_key, status, expires_in_sec=3600)
    
    except Exception as e:
        frappe.log_error(f"Error in cache warmup: {str(e)}")


@frappe.whitelist()
def reset_redis_cache_status():
    """Reset Redis cache warmup status for testing purposes
    Only available for System Manager role
    
    Returns:
        dict: Status of operation
    """
    if "System Manager" not in frappe.get_roles():
        frappe.throw("Only System Manager can reset cache status", frappe.PermissionError)
    
    try:
        redis_connection = frappe.cache()
        cache_key = "redis_cache_warmup_status"
        
        # Delete key
        redis_connection.delete_key(cache_key)
        
        return {
            "status": "success",
            "message": "Cache status reset successfully"
        }
    
    except Exception as e:
        frappe.log_error(f"Error resetting Redis cache status: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        } 

@frappe.whitelist()
@track_performance
def warm_up_cache():
    """Force cache warm up by loading required data
    
    Returns:
        dict: Status of warm up operation
    """
    try:
        # Clear existing cache first
        frappe.cache().delete_keys('*')
        
        # Load critical system data
        system_settings = frappe.get_doc("System Settings")
        system_settings.reload()
        
        # Load translations silently
        frappe.translate.get_full_dict()
        
        # Load DocType metadata
        for doctype in REQUIRED_CACHE_KEYS:
            frappe.get_meta(doctype)
            
        # Load modules info
        frappe.get_active_modules()
        
        # Load notification settings
        frappe.get_cached_doc("Notification Settings")
        
        # Start cleanup in background
        frappe.enqueue(
            cleanup_temp_tables,
            queue='long',
            timeout=300,
            now=False,
            at_front=False
        )
        
        return {
            "status": "success",
            "message": "Core cache warmed up, background tasks scheduled",
            "details": {
                "critical_loaded": True,
                "background_scheduled": True
            }
        }
        
    except Exception as e:
        error_msg = f"Error during cache warm up: {str(e)}"
        frappe.log_error(error_msg)
        frappe.log_error(frappe.get_traceback())
        return {
            "status": "error",
            "message": error_msg
        }

@frappe.whitelist()
def debug_system_state():
    """Debug function to print Redis keys and database tables"""
    try:
        result = {
            "redis_keys": [],
            "database_tables": [],
            "errors": []
        }
        
        # Get Redis keys
        try:
            redis_connection = frappe.cache()
            raw_keys = redis_connection.get_keys("*doctype_meta*")
            result["redis_keys"] = [key.decode('utf-8') if isinstance(key, bytes) else key for key in (raw_keys or [])]
        except Exception as e:
            result["errors"].append(f"Redis error: {str(e)}")
            
        # Get database tables
        try:
            tables = frappe.db.sql("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
                AND table_name LIKE 'tab%'
                ORDER BY table_name
            """)
            result["database_tables"] = [t[0] for t in tables]
        except Exception as e:
            result["errors"].append(f"Database error: {str(e)}")
            
        frappe.log(f"Debug system state: {result}")
        return result
        
    except Exception as e:
        frappe.log_error(f"Error in debug_system_state: {str(e)}")
        return {"error": str(e)} 

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
        if response_time and response_time > 3:
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
            return get_redis_cache_status()
        return None
    except Exception as e:
        frappe.log_error(f"Error checking system performance: {str(e)}")
        return None 