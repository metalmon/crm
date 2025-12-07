#!/bin/bash
# Script to restore files after merge
# Universal script, automatically finds the latest backup
# Usage: ./merge-restore.sh <category_a|category_b|translations> [backup_dir]

set -e

CATEGORY=$1
BACKUP_DIR=${2:-""}

if [ -z "$CATEGORY" ]; then
    echo "Usage: $0 <category_a|category_b|translations> [backup_dir]"
    echo ""
    echo "Categories:"
    echo "  category_a - fully custom files (restore from backup)"
    echo "  category_b - files with our changes (manual merge, but backup for reference)"
    echo "  translations - translation files (ru.csv, ru.po, etc.)"
    exit 1
fi

# Find latest backup if not specified
if [ -z "$BACKUP_DIR" ]; then
    BACKUP_DIR=$(ls -td ../merge_backup_* 2>/dev/null | head -1)
    if [ -z "$BACKUP_DIR" ]; then
        echo "❌ Backup not found. Run ./merge-prepare.sh first"
        exit 1
    fi
    echo "📦 Using latest backup: $BACKUP_DIR"
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ Backup not found: $BACKUP_DIR"
    exit 1
fi

echo "📦 Restoring from $BACKUP_DIR..."

if [ "$CATEGORY" = "category_a" ]; then
    echo "📁 Restoring category A (fully custom files)..."
    
    if [ ! -f "$BACKUP_DIR/category_a/custom_files.tar.gz" ]; then
        echo "❌ Backup file not found: $BACKUP_DIR/category_a/custom_files.tar.gz"
        exit 1
    fi
    
    # Show file list before restoration
    FILE_COUNT=$(tar -tzf "$BACKUP_DIR/category_a/custom_files.tar.gz" 2>/dev/null | wc -l | tr -d ' ')
    echo "  📋 Files found in backup: $FILE_COUNT"
    
    tar -xzf "$BACKUP_DIR/category_a/custom_files.tar.gz"
    
    echo "✅ Category A files restored"
    echo ""
    echo "Next step: manually merge category B:"
    echo "  - crm/hooks.py (our hooks + their schedulers)"
    echo "  - crm/api/doc.py (our on_doc_update + their changes)"
    echo "  - frontend/src/App.vue (our Redis warmup + their NotPermitted)"
    
elif [ "$CATEGORY" = "category_b" ]; then
    echo "📁 Category B backup for reference:"
    
    # Find all category B backup files
    for backup_file in "$BACKUP_DIR/category_b"/*.backup; do
        if [ -f "$backup_file" ]; then
            echo "  - $(basename "$backup_file")"
        fi
    done
    
    echo ""
    echo "⚠️  Category B requires manual merge!"
    echo "Use backup files as reference during manual merge."
    echo "Backup files are located in: $BACKUP_DIR/category_b/"
    
elif [ "$CATEGORY" = "translations" ]; then
    echo "📁 Restoring translation files..."
    
    if [ -d "$BACKUP_DIR/translations/translations" ]; then
        echo "  Restoring crm/translations/..."
        cp -r "$BACKUP_DIR/translations/translations"/* crm/translations/ 2>/dev/null || true
    fi
    
    if [ -d "$BACKUP_DIR/translations/locale" ]; then
        echo "  Restoring crm/locale/..."
        cp -r "$BACKUP_DIR/translations/locale"/* crm/locale/ 2>/dev/null || true
    fi
    
    # Restore custom status translation files
    if [ -f "$BACKUP_DIR/translations/dealStatusTranslations.js" ]; then
        cp "$BACKUP_DIR/translations/dealStatusTranslations.js" frontend/src/utils/ 2>/dev/null || true
    fi
    if [ -f "$BACKUP_DIR/translations/leadStatusTranslations.js" ]; then
        cp "$BACKUP_DIR/translations/leadStatusTranslations.js" frontend/src/utils/ 2>/dev/null || true
    fi
    if [ -f "$BACKUP_DIR/translations/taskPriorityTranslations.js" ]; then
        cp "$BACKUP_DIR/translations/taskPriorityTranslations.js" frontend/src/utils/ 2>/dev/null || true
    fi
    
    echo "✅ Translation files restored"
    
else
    echo "❌ Unknown category: $CATEGORY"
    exit 1
fi
