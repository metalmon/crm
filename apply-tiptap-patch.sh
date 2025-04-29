#!/bin/bash

# Путь к файлу, который нужно исправить
# Проверьте, что у вас именно .js, а не .mjs
TARGET_FILE="./node_modules/@tiptap/extension-code/dist/index.js"

# Проверяем, существует ли файл
if [ -f "$TARGET_FILE" ]; then
  echo "Applying patch to $TARGET_FILE..."
  # Заменяем inputRegex, убирая lookbehind (?<!) и lookahead (?!)
  # Используем # как разделитель, чтобы не экранировать /
  # \1 ссылается на захваченную группу ([^`]+)
  sed -i 's#/(?<!`)`\([^`]+\)`\(?!`\)`/#/`\1`/#' "$TARGET_FILE"

  # Заменяем pasteRegex, убирая lookbehind (?<!) и lookahead (?!)
  sed -i 's#/(?<!`)`\([^`]+\)`\(?!`\)`/g#/`\1`/g#' "$TARGET_FILE"

  echo "Patch applied."
else
  echo "Warning: $TARGET_FILE not found. Skipping patch."
fi 