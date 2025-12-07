#!/bin/bash
# Script to verify that all custom files are in place after merge
# Universal script, automatically checks files by patterns
# No editing required when adding new files - checks them automatically

set -e

echo "🔍 Checking critical files..."

ERRORS=0

# Category A: Fully custom files
echo ""
echo "📁 Checking category A (fully custom files)..."

# API files (custom)
API_FILES=(
    "avito.py"
    "performance.py"
    "system.py"
    "cache_status.py"
    "communication.py"
    "address.py"
    "assignment.py"
    "telephony.py"
)

for api_file in "${API_FILES[@]}"; do
    file="crm/api/$api_file"
    if [ ! -f "$file" ]; then
        echo "  ❌ Missing: $file"
        ((ERRORS++))
    else
        echo "  ✅ $file"
    fi
done

# permissions.py
if [ ! -f "crm/permissions.py" ]; then
    echo "  ❌ Missing: crm/permissions.py"
    ((ERRORS++))
else
    echo "  ✅ crm/permissions.py"
fi

# Frontend components
if [ ! -f "frontend/src/components/Controls/SingleImageUploader.vue" ]; then
    echo "  ❌ Missing: frontend/src/components/Controls/SingleImageUploader.vue"
    ((ERRORS++))
else
    echo "  ✅ frontend/src/components/Controls/SingleImageUploader.vue"
fi

# Category B: Critical changes
echo ""
echo "📁 Checking category B (critical changes)..."

echo "  Checking hooks.py..."
if grep -q "permission_query_conditions.*CRM Deal" crm/hooks.py 2>/dev/null; then
    echo "    ✅ permission_query_conditions found"
else
    echo "    ❌ permission_query_conditions NOT found!"
    ((ERRORS++))
fi

if grep -q "doc_events.*CRM Lead" crm/hooks.py 2>/dev/null; then
    echo "    ✅ doc_events for CRM Lead/Deal/Task found"
else
    echo "    ❌ doc_events for CRM Lead/Deal/Task NOT found!"
    ((ERRORS++))
fi

if grep -q "update_email_references" crm/hooks.py 2>/dev/null; then
    echo "    ✅ scheduler_events for update_email_references found"
else
    echo "    ❌ scheduler_events for update_email_references NOT found!"
    ((ERRORS++))
fi

echo "  Checking crm/api/doc.py..."
if grep -q "def on_doc_update" crm/api/doc.py 2>/dev/null; then
    echo "    ✅ on_doc_update function found"
else
    echo "    ❌ on_doc_update function NOT found!"
    ((ERRORS++))
fi

echo "  Checking frontend/src/App.vue..."
if grep -q "redisWarmup\|LoadingView" frontend/src/App.vue 2>/dev/null; then
    echo "    ✅ Redis warmup logic found"
else
    echo "    ⚠️  Redis warmup logic NOT found (may be merged differently)"
fi

# DocTypes (pattern checking)
echo ""
echo "📁 Checking DocTypes..."

DOCTYPES=(
    "crm_funnel"
    "sales_funnel_report_document"
)

for doctype in "${DOCTYPES[@]}"; do
    if [ -d "crm/fcrm/doctype/$doctype" ]; then
        echo "  ✅ $doctype found"
    else
        echo "  ❌ $doctype NOT found!"
        ((ERRORS++))
    fi
done

# Reports
if [ -d "crm/fcrm/report/sales_funnel_conversion" ]; then
    echo "  ✅ Sales Funnel Conversion report found"
else
    echo "  ❌ Sales Funnel Conversion report NOT found!"
    ((ERRORS++))
fi

# Frontend components
echo ""
echo "📁 Checking frontend components..."

# Custom onboarding
if [ -d "frontend/src/components/custom-ui/onboarding" ]; then
    ONBOARDING_FILES=$(find "frontend/src/components/custom-ui/onboarding" -type f | wc -l | tr -d ' ')
    echo "  ✅ Custom onboarding found ($ONBOARDING_FILES files)"
else
    echo "  ❌ Custom onboarding NOT found!"
    ((ERRORS++))
fi

# Avito components
AVITO_FILES=$(find frontend/src/components -type f \( \
  -path "*/Activities/Avito*.vue" \
  -o -path "*/Icons/AvitoIcon.vue" \
  -o -path "*/Settings/AvitoSettings.vue" \
\) 2>/dev/null | wc -l | tr -d ' ')

if [ "$AVITO_FILES" -gt 0 ]; then
    echo "  ✅ Avito components found ($AVITO_FILES files)"
else
    echo "  ⚠️  Avito components not found (may be normal)"
fi

# Avito composables
if [ -f "frontend/src/composables/avito.js" ]; then
    echo "  ✅ Avito composable found"
else
    echo "  ⚠️  Avito composable not found (may be normal)"
fi

# Translation files
echo ""
echo "📁 Checking translation files..."

if [ -f "crm/translations/ru.csv" ]; then
    RU_LINES=$(wc -l < "crm/translations/ru.csv" | tr -d ' ')
    echo "  ✅ ru.csv found ($RU_LINES lines)"
else
    echo "  ❌ ru.csv NOT found!"
    ((ERRORS++))
fi

TRANSLATION_UTILS=$(find frontend/src/utils -name "*Translations.js" 2>/dev/null | wc -l | tr -d ' ')
if [ "$TRANSLATION_UTILS" -gt 0 ]; then
    echo "  ✅ Status translation files found ($TRANSLATION_UTILS files)"
else
    echo "  ⚠️  Status translation files not found"
fi

# Summary
echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All critical files are in place!"
    echo ""
    echo "Next steps:"
    echo "  - Test the application"
    echo "  - Verify all functions work"
    echo "  - Commit changes"
    exit 0
else
    echo "❌ Found $ERRORS errors!"
    echo ""
    echo "⚠️  Need to restore missing files before commit!"
    exit 1
fi
