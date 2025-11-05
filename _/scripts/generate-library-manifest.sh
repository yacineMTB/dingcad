#!/bin/bash
# Generate library-manifest.json from library directory structure
# Outputs to _/config/library-manifest.json

# Get the directory where this script is located, then go to repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

LIBRARY_DIR="library"
MANIFEST_FILE="_/config/library-manifest.json"
EXCLUDE_FOLDERS="util"

# Ensure config directory exists
mkdir -p "$(dirname "$MANIFEST_FILE")"

# Start JSON
echo '{' > "$MANIFEST_FILE"
echo '  "files": [' >> "$MANIFEST_FILE"

first=true

# Find all .js files in library directory, excluding util folder
find "$LIBRARY_DIR" -name "*.js" -type f ! -path "*/util/*" | sort | while read -r file; do
    # Get relative path from library directory
    rel_path="${file#$LIBRARY_DIR/}"
    
    # Extract folder and filename
    if [[ "$rel_path" == */* ]]; then
        folder="${rel_path%%/*}"
        filename="${rel_path##*/}"
    else
        folder=""
        filename="$rel_path"
    fi
    
    # Generate description from filename (remove .js, replace underscores with spaces)
    desc="${filename%.js}"
    desc="${desc//_/ }"  # Replace underscores with spaces
    # Capitalize first letter (portable method)
    first_char=$(echo "$desc" | cut -c1 | tr '[:lower:]' '[:upper:]')
    rest_chars=$(echo "$desc" | cut -c2-)
    desc="$first_char$rest_chars"
    
    # Add comma if not first item
    if [ "$first" = true ]; then
        first=false
    else
        echo ',' >> "$MANIFEST_FILE"
    fi
    
    # Write file entry
    echo -n '    {' >> "$MANIFEST_FILE"
    echo -n "\"name\": \"$filename\"," >> "$MANIFEST_FILE"
    echo -n " \"desc\": \"$desc\"," >> "$MANIFEST_FILE"
    echo -n " \"path\": \"./$file\"," >> "$MANIFEST_FILE"
    echo -n " \"folder\": \"$folder\"" >> "$MANIFEST_FILE"
    echo -n '}' >> "$MANIFEST_FILE"
done

echo '' >> "$MANIFEST_FILE"
echo '  ],' >> "$MANIFEST_FILE"
echo "  \"excludeFolders\": [\"$EXCLUDE_FOLDERS\"]" >> "$MANIFEST_FILE"
echo '}' >> "$MANIFEST_FILE"

echo "✓ Generated $MANIFEST_FILE"
