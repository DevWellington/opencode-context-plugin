#!/usr/bin/env bash
# Automated API Export Inventory
# Generates a report of all exported symbols and their usage
set -euo pipefail

SRCDIR="${1:-src}"
OUTFILE="${2:-.planning/api-inventory.generated.md}"

echo "# API Export Inventory (Auto-Generated)" > "$OUTFILE"
echo "" >> "$OUTFILE"
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUTFILE"
echo "Source: $SRCDIR" >> "$OUTFILE"
echo "" >> "$OUTFILE"

# Find all exported symbols with file and line
echo "## Exports Found" >> "$OUTFILE"
echo "" >> "$OUTFILE"
echo "| Export | File | Line | Type |" >> "$OUTFILE"
echo "|--------|------|------|------|" >> "$OUTFILE"

EXPORTS=$(grep -rn "^export " "$SRCDIR" --include="*.js" | grep -v "export default" | grep -v "node_modules" || true)

echo "$EXPORTS" | while IFS=: read -r file line content; do
  name=$(echo "$content" | sed -n 's/^export \(function\|const\|class\|let\|var\) \([a-zA-Z0-9_$]*\).*/\2/p')
  etype=$(echo "$content" | sed -n 's/^export \(function\|const\|class\|let\|var\).*/\1/p')
  [ -z "$name" ] && name="$content"
  echo "| $name | $file | $line | $etype |" >> "$OUTFILE"
done

echo "" >> "$OUTFILE"

# Check each export for usage counts
echo "## Export Usage Analysis" >> "$OUTFILE"
echo "" >> "$OUTFILE"

echo "$EXPORTS" | while IFS=: read -r file line content; do
  name=$(echo "$content" | sed -n 's/^export \(function\|const\|class\|let\|var\) \([a-zA-Z0-9_$]*\).*/\2/p')
  [ -z "$name" ] && continue
  
  # Count imports (excluding the defining file)
  import_count=$(grep -rn "import.*$name" "$SRCDIR" --include="*.js" 2>/dev/null | grep -v "$file" | wc -l | tr -d ' ')
  [ -z "$import_count" ] && import_count=0
  
  # Check test imports
  test_import_count=$(grep -rn "import.*$name" "tests" --include="*.js" 2>/dev/null | wc -l | tr -d ' ')
  [ -z "$test_import_count" ] && test_import_count=0
  
  total=$((import_count + test_import_count))
  
  if [ "$total" -eq 0 ]; then
    status="⚠️ UNUSED"
  elif [ "$test_import_count" -gt 0 ] && [ "$import_count" -eq 0 ]; then
    status="test-only"
  else
    status="used ($total imports)"
  fi
  
  echo "- \`$name\` from $file → $status" >> "$OUTFILE"
done

echo "" >> "$OUTFILE"

# Summary
total_exports=$(echo "$EXPORTS" | wc -l | tr -d ' ')
unused_count=$(grep -c "UNUSED" "$OUTFILE" || echo "0")

echo "## Summary" >> "$OUTFILE"
echo "" >> "$OUTFILE"
echo "- **Total exports:** $total_exports" >> "$OUTFILE"
echo "- **Potentially unused:** $unused_count" >> "$OUTFILE"

echo "Inventory written to $OUTFILE"
