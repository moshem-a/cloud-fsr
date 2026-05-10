# Fonts

Bundled fonts for Sally's PDF export. Embedded via `@pdf-lib/fontkit` so the
generated PDFs render Hebrew + Latin glyphs correctly (the default pdf-lib
`StandardFonts.Helvetica` cannot encode anything outside Latin-1).

## Files

- `NotoSansHebrew-Regular.ttf` — Noto Sans Hebrew, Regular weight
- `NotoSansHebrew-Bold.ttf` — Noto Sans Hebrew, Bold weight

Both downloaded from Google Fonts (gstatic.com) v50.

## License

SIL Open Font License 1.1 (OFL). See https://scripts.sil.org/OFL for terms.
Source: https://fonts.google.com/noto/specimen/Noto+Sans+Hebrew

## Known limitation: RTL rendering

`pdf-lib` has no Bidi engine. Hebrew glyphs are placed left-to-right (visually
mirrored) instead of true RTL. Hebrew text is still readable but the line order
within a paragraph is reversed. A future sprint can pre-process strings via
`bidi-js` before passing them to `page.drawText` to fix this.
