# Illustration style — locked 2026-09-13

Approved by Wahyu after two rejected directions:

1. Flat vector kawaii — rejected: faces on planets and objects read as ages 3–5,
   too babyish for Matthew.
2. Modern science-book vector — not tested; superseded.
3. **Ink-and-watercolour picture book — approved.**

Every illustration uses the block below, unchanged. Consistency across the
library matters more than making any single picture better.

## Style block (paste verbatim into every prompt)

```
Hand-drawn children's picture-book illustration. Pen-and-ink linework with fine
cross-hatching and stippling for shadow, coloured with soft watercolour and
gouache washes that layer and bleed slightly. Warm muted natural palette: sage
green, ochre, dusty red, cream, slate blue. Gentle directional light, painterly
loose backgrounds with atmospheric depth, visible paper grain and texture.
Accurate proportions with only light stylisation. Warm, curious, grown-up
enough for a 10-year-old.
STRICTLY NO cute faces, NO eyes or smiles on animals, planets, organs or
objects. Not kawaii, not chibi, not flat vector, not for toddlers.
```

## Grid block (paste verbatim into every prompt)

```
Create ONE square image, 2048 x 2048 pixels, containing FOUR separate
illustrations arranged in a 2x2 grid.

GRID RULES
- Four completely separate illustrations, each self-contained. Do NOT make one
  continuous scene split into four parts.
- Separate the panels with thin white gaps, about 3% of the image width.
- Each panel is a perfect square.
- Centre the main subject and leave about 12% empty margin on all four sides.
- NO text, letters, numbers, labels, speech bubbles or panel borders anywhere.
```

## Per-panel rules learned so far

- **Name the fact the picture must prove.** "Three hearts" alone produced one
  heart. Write "THREE hearts: two smaller ones beside the gills, one larger in
  the centre" and say it is a cutaway.
- **Count things explicitly.** "EXACTLY EIGHT arms — count them" still produced
  six on the first attempt. Always verify counts in the delivered image.
- **Give technology a human setting.** A router floating alone looks odd in this
  style; a router on a shelf in a cut-away room looks right and teaches more.
- **Borrow a plate genre per subject:** natural-history plate for animals,
  vintage astronomy plate for space, anatomical plate for the body, cosy
  domestic cross-section for technology.

## Before slicing, always look at the source image

Check the collage against the `--ids` list by eye, panel by panel, before
running the slicer. On 2026-09-13 a collage was saved twice under different
names, and then re-generated from the old prompt under a third name; both times
the slicer happily wrote animals into history articles. Nothing downstream can
catch it — the files are valid, the paths are valid, only the meaning is wrong.
The hash check in slice-collage.py stops an identical file being reused, but a
fresh generation of the same subjects defeats it.

## Processing

Tiles are cropped from the collage, upscaled if the source was 1024, then
written as WebP at quality 85 — higher than usual, because this style's paper
grain turns blotchy under heavier compression.
