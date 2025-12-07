#!/bin/bash
# Merge preparation script - creates backup
# Universal script, automatically finds files by patterns
# No editing required when adding new files - adds them automatically

set -e

BACKUP_DIR="../merge_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR/category_a"
mkdir -p "$BACKUP_DIR/category_b"

echo "📦 Creating backup in $BACKUP_DIR..."

# Category A: Fully custom files
echo "📁 Backup category A (fully custom files)..."

# Create temporary file with file list for backup
TEMP_LIST=$(mktemp)

# API files (custom)
find crm/api -type f -name "*.py" \( \
  -name "avito.py" \
  -o -name "performance.py" \
  -o -name "system.py" \
  -o -name "cache_status.py" \
  -o -name "communication.py" \
  -o -name "address.py" \
  -o -name "assignment.py" \
  -o -name "telephony.py" \
\) 2>/dev/null | while read -r file; do
  if [ -f "$file" ]; then
    echo "$file" >> "$TEMP_LIST"
  fi
done

# permissions.py
if [ -f "crm/permissions.py" ]; then
  echo "crm/permissions.py" >> "$TEMP_LIST"
fi

# DocTypes (CRM Funnel, Sales Funnel reports)
for doctype in "crm_funnel" "sales_funnel_report_document"; do
  if [ -d "crm/fcrm/doctype/$doctype" ]; then
    find "crm/fcrm/doctype/$doctype" -type f >> "$TEMP_LIST" 2>/dev/null || true
  fi
done

# Sales Funnel Conversion report
if [ -d "crm/fcrm/report/sales_funnel_conversion" ]; then
  find "crm/fcrm/report/sales_funnel_conversion" -type f >> "$TEMP_LIST" 2>/dev/null || true
fi

# Frontend components
# SingleImageUploader
if [ -f "frontend/src/components/Controls/SingleImageUploader.vue" ]; then
  echo "frontend/src/components/Controls/SingleImageUploader.vue" >> "$TEMP_LIST"
fi

# Custom onboarding
if [ -d "frontend/src/components/custom-ui/onboarding" ]; then
  find "frontend/src/components/custom-ui/onboarding" -type f >> "$TEMP_LIST" 2>/dev/null || true
fi

# Avito components
find frontend/src/components -type f \( \
  -path "*/Activities/Avito*.vue" \
  -o -path "*/Icons/AvitoIcon.vue" \
  -o -path "*/Settings/AvitoSettings.vue" \
\) 2>/dev/null | while read -r file; do
  if [ -f "$file" ]; then
    echo "$file" >> "$TEMP_LIST"
  fi
done

# Avito composables
if [ -f "frontend/src/composables/avito.js" ]; then
  echo "frontend/src/composables/avito.js" >> "$TEMP_LIST"
fi

# Create tar.gz archive
if [ -s "$TEMP_LIST" ]; then
  tar -czf "$BACKUP_DIR/category_a/custom_files.tar.gz" -T "$TEMP_LIST" 2>/dev/null || true
  echo "  ✅ Found $(wc -l < "$TEMP_LIST" | tr -d ' ') files"
else
  echo "  ⚠️  No files found in category A"
fi
rm -f "$TEMP_LIST"

# Category B: Files with our changes
echo "📁 Backup category B (files with our changes)..."

mkdir -p "$BACKUP_DIR/category_b"

# List of category B files (files that need to be merged)
CATEGORY_B_FILES=(
    "crm/hooks.py"
    "crm/api/doc.py"
    "frontend/src/App.vue"
)

for file in "${CATEGORY_B_FILES[@]}"; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        dirname=$(dirname "$file" | tr '/' '_')
        backup_name="${dirname}_${filename}.backup"
        
        cp "$file" "$BACKUP_DIR/category_b/$backup_name" 2>/dev/null || true
        
        # Save originals from git
        git show "HEAD:$file" > "$BACKUP_DIR/category_b/${dirname}_${filename}.original" 2>/dev/null || true
        
        echo "  ✅ Backup: $file"
    else
        echo "  ⚠️  File not found: $file"
    fi
done

# Backup translation files (CRITICAL!)
echo "📁 Backup translation files..."
mkdir -p "$BACKUP_DIR/translations"
cp -r crm/translations "$BACKUP_DIR/translations/" 2>/dev/null || true
cp -r crm/locale "$BACKUP_DIR/translations/" 2>/dev/null || true
cp frontend/src/utils/*Translations.js "$BACKUP_DIR/translations/" 2>/dev/null || true

# Save translation statistics
wc -l crm/translations/ru.csv > "$BACKUP_DIR/translations/ru_lines.txt" 2>/dev/null || true
cat > "$BACKUP_DIR/translations/info.txt" <<EOF
Translation files (ru.csv): $(wc -l < crm/translations/ru.csv 2>/dev/null || echo "0") lines
Translation files (ru.po): $(wc -l < crm/locale/ru.po 2>/dev/null || echo "0") lines
EOF
echo "📋 Translation statistics saved to $BACKUP_DIR/translations/info.txt"

# Create file list for reference (dynamic)
echo "📋 Creating file list..."

cat > "$BACKUP_DIR/FILES_LIST.txt" <<EOF
CATEGORY A (fully custom files):
Found automatically by patterns:
EOF

# Add actual file list from archive
if [ -f "$BACKUP_DIR/category_a/custom_files.tar.gz" ]; then
  tar -tzf "$BACKUP_DIR/category_a/custom_files.tar.gz" >> "$BACKUP_DIR/FILES_LIST.txt" 2>/dev/null || true
fi

cat >> "$BACKUP_DIR/FILES_LIST.txt" <<EOF

CATEGORY B (needs manual merge):
- crm/hooks.py
- crm/api/doc.py
- frontend/src/App.vue

TRANSLATIONS:
- crm/translations/*.csv
- crm/locale/*.po
- frontend/src/utils/*Translations.js

Backup created: $BACKUP_DIR
Date: $(date)
EOF

echo "✅ Backup created in $BACKUP_DIR"
echo "📋 File list: $BACKUP_DIR/FILES_LIST.txt"
echo ""
echo "Next steps:"
echo "  git checkout -b merge-frappe-main develop"
echo "  git merge frappe/main --no-commit --no-ff"
echo "  ./merge-restore.sh category_a $BACKUP_DIR"
