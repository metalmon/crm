#!/bin/bash
# Script to find hardcoded strings in frontend
# Universal script, automatically scans all files
# Usage: ./find-hardcoded-strings.sh

echo "🔍 Searching for hardcoded strings in frontend..."

OUTPUT_FILE="hardcoded-strings-report.txt"

# Clear previous report
> "$OUTPUT_FILE"

echo "Searching for strings in quotes that are not wrapped in __()..." | tee -a "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Search for strings in quotes that are not wrapped in __()
find frontend/src -type f \( -name "*.vue" -o -name "*.js" -o -name "*.ts" \) \
  -exec grep -HnE "['\"][A-Z][a-z]{2,}" {} \; 2>/dev/null | \
  grep -v "__(" | \
  grep -v "_(" | \
  grep -v "\.__(" | \
  grep -v "translate" | \
  grep -v "console\." | \
  grep -v "throw new" | \
  grep -v "Error(" | \
  grep -v "import.*from" | \
  grep -v "export.*from" | \
  grep -v "^\s*//" | \
  head -200 >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "=== Statistics ===" >> "$OUTPUT_FILE"
TOTAL_LINES=$(wc -l < "$OUTPUT_FILE" 2>/dev/null || echo "0")
echo "Total potential hardcoded strings found: $((TOTAL_LINES - 10))" >> "$OUTPUT_FILE"

echo "✅ Results saved to $OUTPUT_FILE"
echo "📋 Check the file and wrap found strings in __()"
echo ""
echo "Example fix:"
echo "  BEFORE: label: \"New Deal\""
echo "  AFTER:  label: __(\"New Deal\")"
