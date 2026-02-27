# Starter Decks Folder

Put your base deck JSON files in this folder.

`starter-decks/index.json` is automatically generated on GitHub Pages deploy from all `*.json` files in this folder (except `index.json` itself).

If you run locally without GitHub Actions, you can still keep an `index.json` manually.

## Deck file formats supported

1. Export payload:

```json
{
  "version": 1,
  "decks": [
    { "name": "Deck Name", "cards": [] }
  ]
}
```

2. Array of decks:

```json
[
  { "name": "Deck Name", "cards": [] }
]
```

3. Single deck object:

```json
{ "name": "Deck Name", "cards": [] }
```

Use the in-app **Import / Export** tool to generate the exact JSON shape you want, then store those files here.
