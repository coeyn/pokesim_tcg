# Starter Decks Folder

Put your base deck JSON files in this folder, then list them in `starter-decks/index.json`.

## `index.json` format

```json
{
  "version": 1,
  "files": ["my-deck-a.json", "my-deck-b.json"]
}
```

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
